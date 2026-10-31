// tests/story-controller-hardening.test.js
// Regression cover for commit 1138037 ("fix(stories): comment privacy gates,
// settings enforcement, close_friends schema split") — that commit hardened
// feed.controller.js but its agent died before writing tests. Behaviour covered
// (feed.controller.js is NOT re-edited):
//   - getStoryComments: 403 for a close_friends story the viewer is not close
//     to (the fake-pool canViewStory probe returns no row), 200 for public,
//     comments_enabled=0 blocks non-owners while the owner keeps their thread.
//   - toggleStoryComments: a NULL comments_enabled row reads as the DEFAULT 1
//     it is, so the first toggle turns comments OFF (0).
//   - shareStory: 403 when the story row has allow_sharing = 0.
// Uses the fake-pool pattern from tests/story-audience-privacy.test.js
// (node:test, installFakePool, mockRes) — no real database required.
const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-route-only';

const pool = require('../backend/config/database');
const feed = require('../backend/controllers/feed.controller');
const redisService = require('../backend/services/redis.service');

const AUTHOR = 'author-1';
const VIEWER = 'viewer-1';
// A story row inside the 24h window so storyInteractionError never 404s it.
const FRESH = new Date().toISOString();

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

// shareStory takes a redis action lock — no redis in tests, make sure the
// service never reaches for a client (and silence any cache side effects).
const prevRedisClient = redisService.client;
const prevRedisGet = redisService.get;
const prevRedisSet = redisService.set;
const prevRedisDel = redisService.del;

before(() => {
    redisService.client = null;
    redisService.get = async () => null;
    redisService.set = async () => null;
    redisService.del = async () => null;
});

after(() => {
    redisService.client = prevRedisClient;
    redisService.get = prevRedisGet;
    redisService.set = prevRedisSet;
    redisService.del = prevRedisDel;
});

describe('feed.getStoryComments — privacy gates', () => {
    let fake;
    afterEach(() => { fake?.restore(); fake = null; });

    // Route every statement the handler (and canViewStory) can issue.
    // probes.close / probes.follows toggle the audience permission rows.
    const routerWith = (story, probes = {}) => installFakePool((text) => {
        if (text.startsWith('SELECT user_id, audience, created_at, comments_enabled FROM stories')) {
            return [[story]];
        }
        if (text.includes('SELECT 1 FROM close_friends')) return [probes.close ? [{ 1: 1 }] : []];
        if (text.includes('SELECT 1 FROM follows')) return [probes.follows ? [{ 1: 1 }] : []];
        if (text.includes('FROM story_comments sc')) {
            return [[{
                comment_id: 'c-1', story_id: 'story-1', user_id: VIEWER,
                username: 'viewer', avatar_url: 'https://cdn/a.png', content: 'nice'
            }]];
        }
        return [[]];
    });

    it('403s a close_friends story for a viewer who is not close', async () => {
        fake = routerWith({ user_id: AUTHOR, audience: 'close_friends', comments_enabled: 1 }, { close: false });
        const res = mockRes();
        await feed.getStoryComments({ params: { id: 'story-1' }, user: { userId: VIEWER } }, res);
        assert.equal(res.statusCode, 403);
        assert.match(res.body.error, /private/i);
        // The thread itself must never be queried for a gated viewer
        assert.equal(fake.calls.some(c => c.sql.includes('FROM story_comments sc')), false);
    });

    it('serves the thread to a close friend on a close_friends story', async () => {
        fake = routerWith({ user_id: AUTHOR, audience: 'close_friends', comments_enabled: 1 }, { close: true });
        const res = mockRes();
        await feed.getStoryComments({ params: { id: 'story-1' }, user: { userId: VIEWER } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.length, 1);
    });

    it('200s the comment thread of a public story', async () => {
        fake = routerWith({ user_id: AUTHOR, audience: 'public', comments_enabled: 1 });
        const res = mockRes();
        await feed.getStoryComments({ params: { id: 'story-1' }, user: { userId: VIEWER } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.length, 1);
        assert.equal(res.body[0].username, 'viewer');
    });

    it('403s a non-owner when comments_enabled is off', async () => {
        fake = routerWith({ user_id: AUTHOR, audience: 'public', comments_enabled: 0 });
        const res = mockRes();
        await feed.getStoryComments({ params: { id: 'story-1' }, user: { userId: VIEWER } }, res);
        assert.equal(res.statusCode, 403);
        assert.match(res.body.error, /comments/i);
        assert.equal(fake.calls.some(c => c.sql.includes('FROM story_comments sc')), false);
    });

    it('lets the owner read their own thread with comments off', async () => {
        fake = routerWith({ user_id: AUTHOR, audience: 'public', comments_enabled: 0 });
        const res = mockRes();
        await feed.getStoryComments({ params: { id: 'story-1' }, user: { userId: AUTHOR } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.length, 1);
    });
});

describe('feed.toggleStoryComments — NULL reads as the DEFAULT 1', () => {
    let fake;
    afterEach(() => { fake?.restore(); fake = null; });

    const rowRouter = (commentsEnabled) => installFakePool((text) => {
        if (text.startsWith('SELECT comments_enabled FROM stories')) {
            return [[{ comments_enabled: commentsEnabled }]];
        }
        return [[]];
    });

    it('first toggle on a NULL comments_enabled row turns comments OFF', async () => {
        fake = rowRouter(null);
        const res = mockRes();
        await feed.toggleStoryComments({ params: { id: 'story-1' }, user: { userId: AUTHOR } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.comments_enabled, 0);
        const update = fake.calls.find(c => c.sql.startsWith('UPDATE stories SET comments_enabled'));
        assert.ok(update, 'UPDATE stories SET comments_enabled ran');
        assert.deepEqual(update.params, [0, 'story-1']);
    });

    it('toggling an explicit 0 turns comments back ON', async () => {
        fake = rowRouter(0);
        const res = mockRes();
        await feed.toggleStoryComments({ params: { id: 'story-1' }, user: { userId: AUTHOR } }, res);
        assert.equal(res.body.comments_enabled, 1);
    });

    it('404s when the owner-scoped SELECT finds no story', async () => {
        fake = installFakePool(() => [[]]);
        const res = mockRes();
        await feed.toggleStoryComments({ params: { id: 'story-1' }, user: { userId: VIEWER } }, res);
        assert.equal(res.statusCode, 404);
        assert.equal(fake.calls.some(c => c.sql.startsWith('UPDATE stories SET comments_enabled')), false);
    });
});

describe('feed.shareStory — allow_sharing switch', () => {
    let fake;
    afterEach(() => { fake?.restore(); fake = null; });

    const storyRouter = (allowSharing) => installFakePool((text) => {
        if (text.startsWith('SELECT story_id, user_id, created_at, allow_sharing FROM stories')) {
            return [[{ story_id: 'story-1', user_id: AUTHOR, created_at: FRESH, allow_sharing: allowSharing }]];
        }
        if (text.includes('SELECT 1 FROM story_privacy_blocks')) return [[]];
        if (text.startsWith('SELECT share_count FROM stories')) return [[{ share_count: 3 }]];
        return [[], []];
    });

    it('403s when the owner turned sharing off', async () => {
        fake = storyRouter(0);
        const res = mockRes();
        await feed.shareStory({ params: { id: 'story-1' }, user: { userId: VIEWER } }, res);
        assert.equal(res.statusCode, 403);
        assert.match(res.body.error, /sharing/i);
        // Rejected before any transaction — no share row may be written
        assert.equal(fake.calls.some(c => c.sql.includes('INSERT INTO story_shares')), false);
    });

    it('shares when allow_sharing was never set (NULL = DEFAULT 1)', async () => {
        fake = storyRouter(null);
        const conn = {
            async beginTransaction() {},
            async query() { return [{}, []]; },
            async commit() {},
            async release() {},
            async rollback() {},
        };
        const originalGetConnection = pool.getConnection;
        pool.getConnection = async () => conn;
        try {
            const res = mockRes();
            await feed.shareStory({ params: { id: 'story-1' }, user: { userId: VIEWER } }, res);
            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, true);
            assert.equal(res.body.share_count, 3);
        } finally {
            pool.getConnection = originalGetConnection;
        }
    });
});
