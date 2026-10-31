// tests/story-privacy-gaps.test.js
// Coverage for the story-privacy gap fixes in this branch:
//   - GET /api/share/:id?type=story: 403s a private (only_me/close_friends/
//     followers) story instead of leaking its caption/media_url; response
//     shape is unchanged for viewers who may see it.
//   - createMoment share-to-story: the story INSERT carries the moment's
//     audience (moments' 'friends' maps onto stories' 'followers'; anything
//     missing/unknown falls back to 'public').
//   - createHighlight: 400s when any story_id does not belong to the caller.
//   - getHighlight: 403s a stranger when the highlight contains a story they
//     may not view; the owner bypasses the gate; user_id/audience bookkeeping
//     never leaks into the payload.
// Fake pool.query router — no real database required.
const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-route-only';

const pool = require('../backend/config/database');
const shareRouter = require('../backend/routes/api/share.routes');
const moments = require('../backend/controllers/moments.controller');
const highlights = require('../backend/controllers/highlight.controller');
const NotificationService = require('../backend/services/notification.service');

const AUTHOR = 'author-1';
const VIEWER = 'viewer-1';

function mockRes() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
    };
}

function installFakePool(impl) {
    const calls = [];
    const original = pool.query;
    pool.query = async (sql, params = []) => {
        const text = String(sql).replace(/\s+/g, ' ').trim();
        calls.push({ sql: text, params });
        return impl(text, params);
    };
    return { calls, restore() { pool.query = original; } };
}

// Pull the terminal handler out of an express route layer.
const routeHandler = (router, method, path) => {
    const layer = router.stack.find(
        l => l.route && l.route.path === path
            && Object.keys(l.route.methods)[0].toUpperCase() === method.toUpperCase()
    );
    if (!layer) throw new Error(`route not registered: ${method} ${path}`);
    return layer.route.stack[layer.route.stack.length - 1].handle;
};

// createMoment's share-to-story branch fires a notification — keep it inert.
const prevSend = NotificationService.send;
before(() => { NotificationService.send = async () => ({}); });
after(() => { NotificationService.send = prevSend; });

// ── share route — story branch privacy gate ─────────────────────────────────

describe('GET /share/:id?type=story — audience gate', () => {
    const getShareContent = routeHandler(shareRouter, 'GET', '/:id');
    let fake;
    afterEach(() => { fake?.restore(); fake = null; });

    // story: the SELECT s.* row; probes toggle the permission rows.
    const routerWith = (story, probes = {}) => installFakePool((text) => {
        if (text.includes('FROM stories s JOIN users u')) return [[story]];
        if (text.includes('SELECT 1 FROM close_friends')) return [probes.close ? [{ 1: 1 }] : []];
        if (text.includes('SELECT 1 FROM follows')) return [probes.follows ? [{ 1: 1 }] : []];
        return [[]];
    });

    const call = async (user) => {
        const res = mockRes();
        await getShareContent({ params: { id: 'story-1' }, query: { type: 'story' }, user }, res);
        return res;
    };

    it('403s an only_me story', async () => {
        fake = routerWith({
            story_id: 'story-1', user_id: AUTHOR, audience: 'only_me',
            caption: 'secret diary', media_url: 'https://cdn/private.jpg', username: 'author'
        });
        const res = await call({ user_id: VIEWER });
        assert.equal(res.statusCode, 403);
        assert.match(res.body.error, /private/i);
    });

    it('403s a close_friends story for a viewer who is not close', async () => {
        fake = routerWith({
            story_id: 'story-1', user_id: AUTHOR, audience: 'close_friends',
            caption: 'secret diary', media_url: 'https://cdn/private.jpg', username: 'author'
        }, { close: false });
        const res = await call({ userId: VIEWER });
        assert.equal(res.statusCode, 403);
    });

    it('403s a followers-only story for a non-follower', async () => {
        fake = routerWith({
            story_id: 'story-1', user_id: AUTHOR, audience: 'followers',
            caption: 'x', media_url: 'https://cdn/x.jpg', username: 'author'
        }, { follows: false });
        const res = await call({ user_id: VIEWER });
        assert.equal(res.statusCode, 403);
    });

    it('200s a public story with the response shape unchanged', async () => {
        fake = routerWith({
            story_id: 'story-1', user_id: AUTHOR, audience: 'public',
            caption: 'hello world', media_url: 'https://cdn/hello.jpg', username: 'author'
        });
        const res = await call({ user_id: VIEWER });
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.caption, 'hello world');
        assert.equal(res.body.image_url, 'https://cdn/hello.jpg');
        assert.equal(res.body.type, 'story');
        assert.equal(res.body.url, '/dashboard');
        assert.deepEqual(Object.keys(res.body).sort(), ['caption', 'image_url', 'title', 'type', 'url']);
    });

    it('200s a followers-only story for a follower', async () => {
        fake = routerWith({
            story_id: 'story-1', user_id: AUTHOR, audience: 'followers',
            caption: 'x', media_url: 'https://cdn/x.jpg', username: 'author'
        }, { follows: true });
        const res = await call({ user_id: VIEWER });
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.caption, 'x');
    });

    it('404s an unknown story', async () => {
        fake = routerWith(null);
        const res = await call({ user_id: VIEWER });
        assert.equal(res.statusCode, 404);
    });
});

// ── moment -> story share carries the audience ──────────────────────────────

describe('moments.createMoment — share-to-story audience', () => {
    let fake;
    afterEach(() => { fake?.restore(); fake = null; });

    // Drive the whole publish path: moment INSERT on the transaction
    // connection, story INSERT + shared_to_story UPDATE on the pool.
    const runCreateMoment = async (body) => {
        const conn = {
            async beginTransaction() {},
            async commit() {},
            async release() {},
            async rollback() {},
            async query() { return [{}, []]; },
        };
        const originalGetConnection = pool.getConnection;
        pool.getConnection = async () => conn;
        const fakeLocal = installFakePool((text) => {
            if (text.startsWith('SELECT m.*, u.username')) {
                return [[{
                    moment_id: 'moment-1', user_id: AUTHOR,
                    audience: body.audience ?? 'public', caption: body.caption || ''
                }]];
            }
            if (text.startsWith('INSERT INTO stories')) return [{ insertId: 1 }, []];
            return [[], []];
        });
        try {
            const res = mockRes();
            await moments.createMoment(
                { body: { media_url: 'https://cdn/reel.mp4', caption: 'reel', ...body }, user: { user_id: AUTHOR } },
                res
            );
            return { insert: fakeLocal.calls.find(c => c.sql.startsWith('INSERT INTO stories')), res };
        } finally {
            fakeLocal.restore();
            pool.getConnection = originalGetConnection;
        }
    };

    it('carries each supported moment audience into the story INSERT', async () => {
        const cases = [
            { audience: 'public', expected: 'public' },
            { audience: 'friends', expected: 'followers' },
            { audience: 'close_friends', expected: 'close_friends' },
            { audience: 'only_me', expected: 'only_me' },
        ];
        for (const { audience, expected } of cases) {
            const { insert, res } = await runCreateMoment({ audience, shared_to_story: '1' });
            assert.equal(res.statusCode, 201, audience);
            assert.equal(res.body.story_created, true, `story branch ran for ${audience}`);
            assert.ok(insert, `story INSERT executed for ${audience}`);
            assert.match(insert.sql, /audience/, `INSERT names the audience column for ${audience}`);
            const placeholders = (insert.sql.match(/\?/g) || []).length;
            assert.equal(insert.params.length, placeholders, 'params align with placeholders');
            assert.equal(insert.params[insert.params.length - 1], expected, `${audience} -> ${expected}`);
        }
    });

    it('falls back to public when the moment audience is NULL or missing', async () => {
        const nulled = await runCreateMoment({ audience: null, shared_to_story: '1' });
        assert.equal(nulled.insert.params[nulled.insert.params.length - 1], 'public');

        const { audience, ...withoutAudience } = { audience: undefined };
        const missing = await runCreateMoment({ ...withoutAudience, shared_to_story: '1' });
        assert.equal(missing.insert.params[missing.insert.params.length - 1], 'public');
    });

    it('falls back to public for an unrecognised audience', async () => {
        const { insert } = await runCreateMoment({ audience: 'everybody-please', shared_to_story: '1' });
        assert.equal(insert.params[insert.params.length - 1], 'public');
    });

    it('never inserts a story when shared_to_story is off', async () => {
        const { insert, res } = await runCreateMoment({ audience: 'close_friends' });
        assert.equal(insert, undefined);
        assert.equal(res.body.story_created, false);
    });
});

// ── highlights ──────────────────────────────────────────────────────────────

describe('highlight.createHighlight — story ownership', () => {
    let fake;
    afterEach(() => { fake?.restore(); fake = null; });

    it('400s when any story_id is foreign and writes nothing', async () => {
        fake = installFakePool((text) => {
            if (text.startsWith('SELECT story_id FROM stories WHERE story_id IN')) {
                return [[{ story_id: 'mine-1' }]]; // foreign-1 missing
            }
            return [[]];
        });
        const res = mockRes();
        await highlights.createHighlight(
            { body: { title: 'Trip', story_ids: ['mine-1', 'foreign-1'] }, user: { userId: AUTHOR } },
            res
        );
        assert.equal(res.statusCode, 400);
        assert.match(res.body.error, /belong/i);
        assert.equal(fake.calls.some(c => c.sql.startsWith('INSERT INTO highlights')), false);
        assert.equal(fake.calls.some(c => c.sql.startsWith('INSERT INTO highlight_stories')), false);
    });

    it('creates the highlight when every story belongs to the caller', async () => {
        fake = installFakePool((text) => {
            if (text.startsWith('SELECT story_id FROM stories WHERE story_id IN')) {
                return [[{ story_id: 'mine-1' }, { story_id: 'mine-2' }]];
            }
            return [[]];
        });
        const res = mockRes();
        await highlights.createHighlight(
            { body: { title: 'Trip', story_ids: ['mine-1', 'mine-2'] }, user: { userId: AUTHOR } },
            res
        );
        assert.equal(res.statusCode, 201);
        assert.equal(res.body.story_count, 2);
        const attach = fake.calls.find(c => c.sql.startsWith('INSERT INTO highlight_stories'));
        assert.ok(attach, 'highlight_stories insert ran');
        assert.equal(attach.params[0].length, 2);
    });
});

describe('highlight.getHighlight — contained-story visibility', () => {
    let fake;
    afterEach(() => { fake?.restore(); fake = null; });

    const routerWith = (story, probes = {}) => installFakePool((text) => {
        if (text.includes('FROM highlights h WHERE')) {
            return [[{ highlight_id: 'hl-1', title: 'Trip', cover_url: null, user_id: AUTHOR }]];
        }
        if (text.includes('FROM highlight_stories hs')) return [[story]];
        if (text.includes('SELECT 1 FROM close_friends')) return [probes.close ? [{ 1: 1 }] : []];
        if (text.includes('SELECT 1 FROM follows')) return [probes.follows ? [{ 1: 1 }] : []];
        return [[]];
    });

    const call = async (user) => {
        const res = mockRes();
        await highlights.getHighlight({ params: { id: 'hl-1' }, user }, res);
        return res;
    };

    it('403s a stranger when a contained story is only_me', async () => {
        fake = routerWith({
            id: 'story-1', user_id: AUTHOR, audience: 'only_me',
            media_url: 'https://cdn/x.jpg', media_type: 'image', caption: 'private', created_at: '2026-11-01T00:00:00Z'
        });
        const res = await call({ user_id: VIEWER });
        assert.equal(res.statusCode, 403);
        assert.match(res.body.error, /private/i);
    });

    it('403s a stranger when a contained story is close_friends-only', async () => {
        fake = routerWith({
            id: 'story-1', user_id: AUTHOR, audience: 'close_friends',
            media_url: 'https://cdn/x.jpg', media_type: 'image', caption: 'private', created_at: '2026-11-01T00:00:00Z'
        }, { close: false });
        const res = await call({ user_id: VIEWER });
        assert.equal(res.statusCode, 403);
    });

    it('lets the owner through whatever the contained audience', async () => {
        fake = routerWith({
            id: 'story-1', user_id: AUTHOR, audience: 'only_me',
            media_url: 'https://cdn/x.jpg', media_type: 'image', caption: 'private', created_at: '2026-11-01T00:00:00Z'
        });
        const res = await call({ user_id: AUTHOR });
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.stories.length, 1);
        assert.equal(res.body.stories[0].id, 'story-1');
    });

    it('200s a stranger for a highlight of public stories', async () => {
        fake = routerWith({
            id: 'story-1', user_id: AUTHOR, audience: 'public',
            media_url: 'https://cdn/x.jpg', media_type: 'image', caption: 'hi', created_at: '2026-11-01T00:00:00Z'
        });
        const res = await call({ user_id: VIEWER });
        assert.equal(res.statusCode, 200);
        // Response shape unchanged: no privacy bookkeeping in the payload
        assert.deepEqual(Object.keys(res.body.stories[0]).sort(), ['caption', 'created_at', 'id', 'media_type', 'media_url']);
    });
});
