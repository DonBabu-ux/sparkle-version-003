// tests/media-probe-and-moments-skip.test.js
// Contracts for skipping confirmed-unavailable media:
//   1. probeMediaUrl only calls a URL alive when it actually serves media
//      bytes (zero-length bodies and HTML error pages are dead).
//   2. createMoment gates a publish on that probe.
//   3. The health job probes every moments URL column, paginates the whole
//      table, and flags rather than deletes.
//   4. Every feed/discover/search query filters the flag.
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const ROOT = join(__dirname, '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

const { probeMediaUrl } = require('../backend/utils/mediaProbe');

const res = (status, headers = {}) => ({
    status,
    headers: { get: (k) => (k in headers ? headers[k] : null) },
});

describe('probeMediaUrl', () => {
    const realFetch = globalThis.fetch;
    const calls = [];
    beforeEach(() => { calls.length = 0; });
    afterEach(() => { globalThis.fetch = realFetch; });

    const stub = (...responses) => {
        globalThis.fetch = async (url, init) => {
            calls.push({ url, method: init.method });
            const next = responses.shift();
            if (next instanceof Error) throw next;
            return next;
        };
    };

    it('treats a HEAD 200 with a real content-length and media type as alive', async () => {
        stub(res(200, { 'content-length': '2048576', 'content-type': 'video/mp4' }));
        const out = await probeMediaUrl('https://cdn.example/m.mp4');
        assert.equal(out.alive, true);
        assert.equal(calls[0].method, 'HEAD');
    });

    it('treats a 200 with content-length 0 as dead (the 0-byte tile)', async () => {
        stub(res(200, { 'content-length': '0', 'content-type': 'video/mp4' }));
        const out = await probeMediaUrl('https://cdn.example/empty.mp4');
        assert.equal(out.alive, false);
        assert.equal(out.reason, 'zero-length');
    });

    it('treats a 200 serving text/html as dead (CDN error page)', async () => {
        stub(res(200, { 'content-type': 'text/html', 'content-length': '512' }));
        const out = await probeMediaUrl('https://cdn.example/gone.mp4');
        assert.equal(out.alive, false);
        assert.equal(out.reason, 'html');
    });

    it('treats 404 as dead', async () => {
        stub(res(404));
        const out = await probeMediaUrl('https://cdn.example/missing.mp4');
        assert.equal(out.alive, false);
        assert.equal(out.status, 404);
    });

    it('falls back to a ranged GET when HEAD is rejected (403)', async () => {
        stub(res(403), res(206));
        const out = await probeMediaUrl('https://cdn.example/no-head.mp4');
        assert.equal(out.alive, true);
        assert.equal(calls[1].method, 'GET');
    });

    it('verifies the body with a ranged GET when verifyBody is set and length is unknown', async () => {
        stub(res(200, { 'content-type': 'video/mp4' }), res(404));
        const out = await probeMediaUrl('https://cdn.example/chunked.mp4', { verifyBody: true });
        assert.equal(out.alive, false);
        assert.equal(calls.length, 2);
    });

    it('skips the ranged GET by default when the status is 200 and length is unknown', async () => {
        stub(res(200, { 'content-type': 'video/mp4' }));
        const out = await probeMediaUrl('https://cdn.example/chunked.mp4');
        assert.equal(out.alive, true);
        assert.equal(calls.length, 1);
    });

    it('reports a network failure as dead with status 0', async () => {
        stub(new Error('ECONNREFUSED'));
        const out = await probeMediaUrl('https://cdn.example/down.mp4');
        assert.equal(out.alive, false);
        assert.equal(out.status, 0);
    });

    it('retries transient failures and returns alive on a later attempt', async () => {
        stub(new Error('timeout'), res(200, { 'content-length': '10', 'content-type': 'video/mp4' }));
        const out = await probeMediaUrl('https://cdn.example/flaky.mp4', { attempts: 2 });
        assert.equal(out.alive, true);
        assert.equal(calls.length, 2);
    });

    it('gives up after the configured attempts', async () => {
        stub(new Error('timeout'), res(503));
        const out = await probeMediaUrl('https://cdn.example/flaky.mp4', { attempts: 2 });
        assert.equal(out.alive, false);
        assert.equal(out.status, 503);
    });
});

describe('moments unavailable-media skip wiring', () => {
    const controller = read('backend/controllers/moments.controller.js');
    const job = read('backend/jobs/media-health.job.js');
    const ranking = read('backend/services/moments-ranking.service.js');
    const discover = read('backend/services/discover.service.js');

    it('createMoment verifies the upload before persisting', () => {
        assert.match(controller, /await probeMediaUrl\(media_url, \{ attempts: 2, verifyBody: true \}\)/);
        assert.match(controller, /Upload could not be verified/);
    });

    it('the health job probes every moments url column', () => {
        assert.match(job, /moments:\s+\{ idCol: 'moment_id',\s+urlCols: \['media_url', 'video_url', 'streaming_url'\], onDead: 'flag_unavailable' \}/);
    });

    it('the health job keyset-paginates instead of a bare LIMIT', () => {
        assert.match(job, /keyset-paginated/);
        assert.match(job, /keyset = `AND /);
    });

    it('the health job flags instead of deleting moments', () => {
        assert.match(job, /UPDATE moments SET media_status = 'failing' WHERE moment_id IN \(\?\)/);
        assert.match(job, /UPDATE moments SET media_status = 'ok' WHERE moment_id IN \(\?\) AND media_status = 'failing'/);
    });

    it('every ranked/discovered moments query skips flagged rows', () => {
        const predicate = /m\.media_status IS NULL OR m\.media_status = 'ok'/g;
        assert.equal((ranking.match(predicate) || []).length, 5);
        assert.equal((discover.match(predicate) || []).length, 4);
        assert.equal((controller.match(predicate) || []).length, 1);
    });

    it('the skip column is created by a registered migration', () => {
        assert.match(
            read('backend/migrations/20261126_moments_media_status.js'),
            /ADD COLUMN media_status ENUM\('ok','failing'\) NOT NULL DEFAULT 'ok'/
        );
        assert.match(
            read('backend/utils/database/schemaLedger.js'),
            /\{ file: '20261126_moments_media_status\.js', verify: \['moments\.media_status'\] \}/
        );
    });
});