// tests/media-failure-paths.test.js
// Behavioral failure-path coverage for the confirmed-unavailable media skip.
// Everything here drives the real modules with a fake pool and a fake fetch —
// a dead rendition is simulated, not asserted into existence by source text:
//   - the health job probes video_url/streaming_url, not just media_url
//   - a moment is flagged 'failing' only after the second consecutive failure
//   - a healed moment is un-flagged (skip applies to *confirmed* unavailability)
//   - non-moments surfaces keep their old action (posts null the column)
//   - the upload gate rejects a dead/0-byte rendition before it is persisted
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-failure-paths';

const pool = require('../backend/config/database');
const healthJob = require('../backend/jobs/media-health.job');
const moments = require('../backend/controllers/moments.controller');

const hashUrl = (url) => crypto.createHash('sha256').update(url).digest('hex');

const aliveResponse = () => ({
    status: 200,
    headers: { get: (k) => (k === 'content-length' ? '2048' : 'video/mp4') },
});
const deadResponse = () => ({ status: 404, headers: { get: () => null } });
const zeroByteResponse = () => ({
    status: 200,
    headers: { get: (k) => (k === 'content-length' ? '0' : 'video/mp4') },
});

// Fake the shared pool's query surface and record every statement, the same
// way story-privacy-gaps does. `failByHash` stands in for the stored
// media_health_checks state so the two-strike rule can be driven precisely.
function installFakePool({ momentRows = [], postRows = [], failByHash = new Map() } = {}) {
    const log = [];
    const original = pool.query;
    pool.query = async (sql, params = []) => {
        const text = String(sql).replace(/\s+/g, ' ').trim();
        log.push({ text, params });
        if (/CREATE TABLE IF NOT EXISTS media_health_checks/.test(text)) return [[], []];
        if (/SELECT url_hash, fail_count FROM media_health_checks/.test(text)) {
            return [params[0].map((h) => ({ url_hash: h, fail_count: failByHash.get(h) || 0 })), []];
        }
        if (/^INSERT INTO media_health_checks/.test(text)) return [[], []];
        if (/UPDATE media_health_checks/.test(text)) return [{ affectedRows: 1 }, []];
        if (/FROM `moments`/.test(text)) return [momentRows, []];
        if (/UPDATE moments SET media_status/.test(text)) return [{ affectedRows: 1 }, []];
        if (/FROM `posts`/.test(text)) return [postRows, []];
        if (/UPDATE `posts` SET/.test(text)) return [{ affectedRows: 1 }, []];
        return [[], []];
    };
    return { log, restore: () => { pool.query = original; } };
}

describe('media health job — failure paths', () => {
    const realFetch = globalThis.fetch;
    let fake;
    let fetched;

    beforeEach(() => {
        fetched = [];
        globalThis.fetch = async (url, init) => {
            fetched.push(String(url));
            return aliveResponse();
        };
        fake = installFakePool();
    });
    afterEach(() => {
        fake.restore();
        globalThis.fetch = realFetch;
    });

    const stubResponses = (responder) => {
        globalThis.fetch = async (url, init) => {
            fetched.push(String(url));
            return responder(String(url), init);
        };
    };

    it('probes video_url and streaming_url, not only media_url', async () => {
        fake.restore();
        fake = installFakePool({
            momentRows: [{ row_id: 'moment-1', media_url: null, video_url: 'https://cdn/v.mp4', streaming_url: 'https://cdn/v.m3u8' }],
        });
        await healthJob.runHealthCheck();
        assert.ok(fetched.includes('https://cdn/v.mp4'), 'video_url is probed');
        assert.ok(fetched.includes('https://cdn/v.m3u8'), 'streaming_url is probed');
    });

    it('does not flag a moment on its first failure (two-strike rule)', async () => {
        const dead = 'https://cdn/dead.mp4';
        fake.restore();
        fake = installFakePool({
            momentRows: [{ row_id: 'moment-1', media_url: dead, video_url: null, streaming_url: null }],
            failByHash: new Map([[hashUrl(dead), 1]]),
        });
        stubResponses(() => deadResponse());
        await healthJob.runHealthCheck();
        const flagged = fake.log.filter((q) => /UPDATE moments SET media_status = 'failing'/.test(q.text));
        assert.equal(flagged.length, 0, 'one strike is not enough to skip the moment');
    });

    it('flags the moment as failing on the second consecutive failure', async () => {
        const dead = 'https://cdn/dead.mp4';
        fake.restore();
        fake = installFakePool({
            momentRows: [{ row_id: 'moment-1', media_url: dead, video_url: null, streaming_url: null }],
            failByHash: new Map([[hashUrl(dead), 2]]),
        });
        stubResponses(() => deadResponse());
        await healthJob.runHealthCheck();
        const flagged = fake.log.filter((q) => /UPDATE moments SET media_status = 'failing'/.test(q.text));
        assert.equal(flagged.length, 1);
        assert.deepEqual(flagged[0].params, [['moment-1']]);
    });

    it('un-flags a moment whose media is alive again', async () => {
        const url = 'https://cdn/healed.mp4';
        fake.restore();
        fake = installFakePool({
            momentRows: [{ row_id: 'moment-1', media_url: url, video_url: null, streaming_url: null }],
        });
        await healthJob.runHealthCheck();
        const recovered = fake.log.filter((q) => /UPDATE moments SET media_status = 'ok'/.test(q.text));
        assert.equal(recovered.length, 1);
        assert.deepEqual(recovered[0].params, [['moment-1']]);
    });

    it('keeps the old action for non-moments surfaces (posts null the media column)', async () => {
        const dead = 'https://cdn/dead.jpg';
        fake.restore();
        fake = installFakePool({
            postRows: [{ row_id: 'post-1', media_url: dead }],
            failByHash: new Map([[hashUrl(dead), 2]]),
        });
        stubResponses(() => deadResponse());
        await healthJob.runHealthCheck();
        const nulled = fake.log.filter((q) => /UPDATE `posts` SET/.test(q.text));
        assert.equal(nulled.length, 1, 'dead post media is nulled, not skipped');
        assert.equal(
            fake.log.filter((q) => /UPDATE moments SET media_status/.test(q.text)).length,
            0,
            'posts never touch the moments skip flag'
        );
    });
});

describe('createMoment — upload gate failure paths', () => {
    const realFetch = globalThis.fetch;
    let fake;
    let originalGetConnection;

    const conn = {
        async beginTransaction() {},
        async commit() {},
        async release() {},
        async rollback() {},
        async query() { return [{}, []]; },
    };

    const publish = async (responder) => {
        const res = {
            statusCode: 200, body: null,
            status(code) { this.statusCode = code; return this; },
            json(payload) { this.body = payload; return this; },
        };
        globalThis.fetch = async () => responder();
        await moments.createMoment(
            { body: { media_url: 'https://cdn/reel.mp4', caption: 'reel' }, user: { user_id: 'author-1' } },
            res
        );
        return res;
    };

    beforeEach(() => {
        fake = installFakePool();
        originalGetConnection = pool.getConnection;
        pool.getConnection = async () => conn;
    });
    afterEach(() => {
        fake.restore();
        pool.getConnection = originalGetConnection;
        globalThis.fetch = realFetch;
    });

    it('422s when the uploaded rendition 404s, and inserts nothing', async () => {
        const res = await publish(deadResponse);
        assert.equal(res.statusCode, 422);
        assert.match(res.body.error, /verified/i);
        assert.equal(fake.log.some((q) => /INSERT INTO stories/.test(q.text)), false);
    });

    it('422s when the rendition serves 0 bytes (the original "media unavailable" shape)', async () => {
        const res = await publish(zeroByteResponse);
        assert.equal(res.statusCode, 422);
    });

    it('publishes normally when the rendition serves real media bytes', async () => {
        const res = await publish(aliveResponse);
        assert.equal(res.statusCode, 201);
        assert.equal(res.body.status, 'success');
    });
});