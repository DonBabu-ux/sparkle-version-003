// tests/clubs-groups-routes.test.js
// Controller + route-registration coverage for the two endpoints the audit
// found missing (ClubDetail /clubs/:id/posts and GroupDetail
// /groups/:id/my-request). Uses a fake pool.query router - no real DB.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

// Routers load the auth middleware, which refuses to boot without a secret.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-route-only';

const pool = require('../backend/config/database');
const clubs = require('../backend/controllers/clubs.controller');
const groups = require('../backend/controllers/groups.controller');
const clubsRouter = require('../backend/routes/api/clubs.routes');
const groupsRouter = require('../backend/routes/api/groups.routes');

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
    return {
        calls,
        restore() { pool.query = original; },
    };
}

describe('GET /clubs/:id/posts - club announcements as feed posts', () => {
    let fake;
    before(() => {
        fake = installFakePool((text) => {
            if (text.includes('FROM club_announcements')) {
                return [[{
                    post_id: 'ann-1',
                    user_id: 'u-1',
                    username: 'chair',
                    name: 'Club Chair',
                    avatar_url: 'http://x/a.png',
                    content: 'Meeting moved to Friday',
                    created_at: '2026-10-01T10:00:00Z',
                    club_name: 'Robotics'
                }]];
            }
            return [[]];
        });
    });
    after(() => fake.restore());

    it('returns the club post feed (audit item: route was missing)', async () => {
        const res = mockRes();
        await clubs.getClubPosts({ params: { id: 'club-1' } }, res);

        assert.equal(res.statusCode, 200);
        const posts = res.body.data.posts;
        assert.equal(posts.length, 1);
        // PostCard contract: the feed shape needs these non-nullable fields.
        assert.equal(posts[0].post_id, 'ann-1');
        assert.equal(posts[0].spark_count, 0);
        assert.equal(posts[0].is_sparked, false);
        assert.equal(posts[0].is_pinned, true);
        assert.equal(posts[0].post_type, 'club_announcement');
    });
});

describe('GET /groups/:id/my-request - pending join state', () => {
    let fake;
    // Test-controlled: what the group lookup and request lookup return.
    let groupRow = null;
    let requestRow = null;

    before(() => {
        fake = installFakePool((text) => {
            if (text.includes('FROM group_requests')) return [[requestRow].filter(Boolean)];
            if (text.includes('FROM groups')) return [[groupRow].filter(Boolean)];
            return [[]];
        });
    });
    after(() => fake.restore());

    it('404s for an unknown group', async () => {
        groupRow = null;
        const res = mockRes();
        await groups.myJoinRequest(
            { params: { id: 'nope' }, user: { userId: 'me' } },
            res
        );
        assert.equal(res.statusCode, 404);
    });

    it('reports status "pending" when a request exists (GroupDetail contract)', async () => {
        groupRow = { groupId: 'g-1' };
        requestRow = { id: 7, group_id: 'g-1', user_id: 'me', status: 'pending' };
        const res = mockRes();
        await groups.myJoinRequest(
            { params: { id: 'g-1' }, user: { userId: 'me' } },
            res
        );

        assert.equal(res.statusCode, 200);
        // Frontend checks data.status === 'pending' on the raw body.
        assert.equal(res.body.status, 'pending');
        assert.equal(res.body.data.id, 7);
    });

    it('reports status "none" when no request exists', async () => {
        groupRow = { groupId: 'g-1' };
        requestRow = null;
        const res = mockRes();
        await groups.myJoinRequest(
            { params: { id: 'g-1' }, user: { userId: 'me' } },
            res
        );

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.status, 'none');
    });
});

describe('route registration', () => {
    const paths = (router) => router.stack
        .filter(l => l.route)
        .map(l => Object.keys(l.route.methods)[0].toUpperCase() + ' ' + l.route.path);

    it('clubs router exposes GET /:id/posts', () => {
        assert.ok(paths(clubsRouter).includes('GET /:id/posts'));
    });

    it('groups router exposes GET /:id/my-request', () => {
        assert.ok(paths(groupsRouter).includes('GET /:id/my-request'));
    });
});
