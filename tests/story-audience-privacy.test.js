// tests/story-audience-privacy.test.js
// AfterGlow story privacy contract:
//   - resolveStoryAudience: unknown/missing values fall back to 'public'.
//   - canViewStory: the four audience levels enforced per viewer.
//   - createStory: persists the client audience into stories.audience and the
//     INSERT never ships a placeholder/param mismatch.
//   - getStories: feeds only show stories the viewer may see (audience is
//     part of the WHERE clause, params stay aligned).
//   - user routes expose the close-friends CRUD.
// Uses a fake pool.query router — no real database required.
const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-route-only';

const pool = require('../backend/config/database');
const audienceService = require('../backend/services/story-audience.service');
const feed = require('../backend/controllers/feed.controller');
const User = require('../backend/models/User');
const userController = require('../backend/controllers/user.controller');
const userRouter = require('../backend/routes/api/user.routes');

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

describe('resolveStoryAudience', () => {
    it('passes through the four supported levels', () => {
        assert.equal(audienceService.resolveStoryAudience('public'), 'public');
        assert.equal(audienceService.resolveStoryAudience('followers'), 'followers');
        assert.equal(audienceService.resolveStoryAudience('close_friends'), 'close_friends');
        assert.equal(audienceService.resolveStoryAudience('only_me'), 'only_me');
    });

    it('falls back to public for unknown, empty or junk values', () => {
        assert.equal(audienceService.resolveStoryAudience(undefined), 'public');
        assert.equal(audienceService.resolveStoryAudience(null), 'public');
        assert.equal(audienceService.resolveStoryAudience(''), 'public');
        assert.equal(audienceService.resolveStoryAudience('world'), 'public');
        assert.equal(audienceService.resolveStoryAudience({ audience: 'public' }), 'public');
    });
});

describe('canViewStory', () => {
    let fake;

    // Helper: install a router where the given permission probe(s) hit.
    const routerWith = (hits) => installFakePool((text) => {
        if (text.includes('SELECT 1 FROM follows')) return [hits.follows ? [{ 1: 1 }] : []];
        if (text.includes('SELECT 1 FROM close_friends')) return [hits.close ? [{ 1: 1 }] : []];
        return [[]];
    });

    afterEach(() => { fake?.restore(); fake = null; });

    it('owner always sees their own story, whatever the audience', async () => {
        fake = routerWith({ follows: false, close: false });
        for (const audience of ['public', 'followers', 'close_friends', 'only_me']) {
            const ok = await audienceService.canViewStory(pool, { user_id: 'me', audience }, 'me');
            assert.equal(ok, true, audience);
        }
    });

    it('public stories are visible to any signed-in viewer', async () => {
        fake = routerWith({ follows: false, close: false });
        const ok = await audienceService.canViewStory(pool, { user_id: 'author', audience: 'public' }, 'viewer');
        assert.equal(ok, true);
    });

    it('only_me stories are hidden from everyone else', async () => {
        fake = routerWith({ follows: false, close: false });
        const ok = await audienceService.canViewStory(pool, { user_id: 'author', audience: 'only_me' }, 'viewer');
        assert.equal(ok, false);
    });

    it('followers stories require the viewer to follow the author', async () => {
        fake = routerWith({ follows: true, close: false });
        assert.equal(
            await audienceService.canViewStory(pool, { user_id: 'author', audience: 'followers' }, 'viewer'),
            true
        );
        fake.restore();
        fake = routerWith({ follows: false, close: false });
        assert.equal(
            await audienceService.canViewStory(pool, { user_id: 'author', audience: 'followers' }, 'viewer'),
            false
        );
    });

    it('close_friends stories require a close-friends row', async () => {
        fake = routerWith({ follows: false, close: true });
        assert.equal(
            await audienceService.canViewStory(pool, { user_id: 'author', audience: 'close_friends' }, 'viewer'),
            true
        );
        fake.restore();
        fake = routerWith({ follows: false, close: false });
        assert.equal(
            await audienceService.canViewStory(pool, { user_id: 'author', audience: 'close_friends' }, 'viewer'),
            false
        );
    });

    it('anonymous viewers only see public stories', async () => {
        fake = routerWith({ follows: true, close: true });
        assert.equal(
            await audienceService.canViewStory(pool, { user_id: 'author', audience: 'public' }, null),
            true
        );
        assert.equal(
            await audienceService.canViewStory(pool, { user_id: 'author', audience: 'followers' }, null),
            false
        );
        assert.equal(
            await audienceService.canViewStory(pool, { user_id: 'author', audience: 'close_friends' }, null),
            false
        );
        assert.equal(
            await audienceService.canViewStory(pool, { user_id: 'author', audience: 'only_me' }, null),
            false
        );
    });
});

describe('createStory persists audience', () => {
    let fake;
    before(() => {
        // Silence media registry + redis + story notification side effects.
        const MediaService = require('../backend/services/media.service');
        MediaService.findDuplicate = async () => null;
        MediaService.registerMedia = async () => null;
        const redisService = require('../backend/services/redis.service');
        redisService.get = async () => null;
        redisService.del = async () => null;
        // getStories' cache read must miss.
        global.__redisStubbed = true;
    });
    after(() => { fake?.restore(); });

    async function createWith(audienceBody) {
        const req = {
            body: { media_url: 'https://cdn/x.jpg', ...audienceBody },
            user: { userId: 'author-1' },
            app: { get: () => undefined },
        };
        const res = mockRes();
        const fakeLocal = installFakePool((text) => {
            if (text.startsWith('INSERT INTO stories')) return [{ insertId: 1 }];
            return [[]];
        });
        try {
            await feed.createStory(req, res);
        } finally {
            const insert = fakeLocal.calls.find(c => c.sql.startsWith('INSERT INTO stories'));
            fakeLocal.restore();
            return { insert, res };
        }
    }

    it('writes the requested audience into the INSERT', async () => {
        for (const audience of ['public', 'followers', 'close_friends', 'only_me']) {
            const { insert } = await createWith({ audience });
            assert.ok(insert, 'story INSERT executed');
            assert.ok(/audience/.test(insert.sql), 'INSERT includes audience column');
            const placeholders = (insert.sql.match(/\?/g) || []).length;
            assert.equal(insert.params.length, placeholders, 'params align with placeholders');
            assert.equal(insert.params[insert.params.length - 1], audience, 'audience is the last param');
        }
    });

    it('falls back to public for an invalid audience', async () => {
        const { insert } = await createWith({ audience: 'everybody-please' });
        assert.equal(insert.params[insert.params.length - 1], 'public');
    });

    it('falls back to public when no audience is supplied', async () => {
        const { insert } = await createWith({});
        assert.equal(insert.params[insert.params.length - 1], 'public');
    });
});

describe('getStories visibility SQL', () => {
    it('filters by audience and keeps placeholder/param alignment', async () => {
        const redisService = require('../backend/services/redis.service');
        const originalGet = redisService.get;
        redisService.get = async () => null; // force the DB path

        const fake = installFakePool((text) => {
            if (text.includes('FROM stories s')) return [[]];
            return [[]];
        });
        try {
            const res = mockRes();
            await feed.getStories({ user: { userId: 'viewer-1' } }, res);
            const call = fake.calls.find(c => c.sql.includes('FROM stories s'));
            assert.ok(call, 'stories query ran');
            // Audience conditions must be part of the visibility filter.
            assert.match(call.sql, /s\.audience = 'public'/);
            assert.match(call.sql, /audience = 'followers'/);
            assert.match(call.sql, /audience = 'close_friends'/);
            // The classic bug in this codebase shape: params drifting from
            // placeholders after a WHERE edit. Guard against it.
            const placeholders = (call.sql.match(/\?/g) || []).length;
            assert.equal(call.params.length, placeholders, 'params align with placeholders');
        } finally {
            fake.restore();
            redisService.get = originalGet;
        }
    });
});

describe('close friends routes', () => {
    const paths = (router) => router.stack
        .filter(l => l.route)
        .map(l => Object.keys(l.route.methods)[0].toUpperCase() + ' ' + l.route.path);

    it('exposes list/add/remove close-friends endpoints', () => {
        const p = paths(userRouter);
        assert.ok(p.includes('GET /close-friends'));
        assert.ok(p.includes('POST /close-friends'));
        assert.ok(p.includes('DELETE /close-friends/:friendId'));
    });

    it('exports the controller handlers', () => {
        assert.equal(typeof userController.getCloseFriends, 'function');
        assert.equal(typeof userController.addCloseFriend, 'function');
        assert.equal(typeof userController.removeCloseFriend, 'function');
    });

    it('rejects self-adds and missing ids', async () => {
        let fake = installFakePool(() => [[]]);
        try {
            const resSelf = mockRes();
            await userController.addCloseFriend({ user: { userId: 'me' }, body: { userId: 'me' } }, resSelf);
            assert.equal(resSelf.statusCode, 400);

            const resMissing = mockRes();
            await userController.addCloseFriend({ user: { userId: 'me' }, body: {} }, resMissing);
            assert.equal(resMissing.statusCode, 400);
        } finally {
            fake.restore();
        }
    });
});
