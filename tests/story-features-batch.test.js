// tests/story-features-batch.test.js
// Story features batch cover:
//   - POST /api/stickers/quiz/answer writes a vote row to
//     sticker_quiz_answers (one row per sticker+user, upserted on re-answer),
//     so the quiz sticker stops being read-only.
//   - GET /stories/privacy/hidden lists the users whose stories the caller has
//     hidden (with user info); DELETE /stories/privacy/hidden/:userId unhides
//     them and 404s when there was no block.
//   - getStoryViewers orders deterministically (tiebreaker on type + user_id)
//     and pages via page/limit.
//   - ShareModal passes the post's media as ?imageUrl= when navigating to the
//     story composer (static source check).
// Uses the fake-pool pattern from tests/story-audience-privacy.test.js —
// no real database required.
const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-route-only';

const pool = require('../backend/config/database');
const stickers = require('../backend/controllers/sticker.controller');
const feed = require('../backend/controllers/feed.controller');

function mockRes() {
    return {
        statusCode: 200,
        body: null,
        headers: {},
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
        set(key, value) { this.headers[key] = value; return this; },
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

const src = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

// ── Quiz answers ─────────────────────────────────────────────────────────────

describe('answerQuiz', () => {
    let fake;

    afterEach(() => { fake?.restore(); fake = null; });

    it('writes the chosen option into sticker_quiz_answers', async () => {
        fake = installFakePool(() => [[]]);
        const req = {
            body: { sticker_id: 'sticker-1', option_index: 2 },
            user: { userId: 'viewer-1' },
        };
        const res = mockRes();

        await stickers.answerQuiz(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.status, 'success');

        const insert = fake.calls.find(c => c.sql.startsWith('INSERT INTO sticker_quiz_answers'));
        assert.ok(insert, 'expected an INSERT INTO sticker_quiz_answers');
        // Same upsert shape as votePoll: a re-answer rewrites the option.
        assert.match(insert.sql, /ON DUPLICATE KEY UPDATE option_index = VALUES\(option_index\)/);
        assert.equal(insert.params[1], 'sticker-1');
        assert.equal(insert.params[2], 'viewer-1');
        assert.equal(insert.params[3], 2);
        // The answer id is generated, never taken from the client.
        assert.ok(typeof insert.params[0] === 'string' && insert.params[0].length > 0);
        assert.notEqual(insert.params[0], 'sticker-1');
    });

    it('returns 500 when the insert fails', async () => {
        fake = installFakePool(() => { throw new Error('boom'); });
        const res = mockRes();

        await stickers.answerQuiz(
            { body: { sticker_id: 's', option_index: 0 }, user: { userId: 'u' } },
            res
        );

        assert.equal(res.statusCode, 500);
        assert.equal(res.body.status, 'error');
    });
});

// ── Story privacy: hidden list + unhide ──────────────────────────────────────

describe('story privacy unhide', () => {
    let fake;

    afterEach(() => { fake?.restore(); fake = null; });

    it('getHiddenStoryUsers joins the blocks with user info for the caller', async () => {
        const rows = [
            { block_id: 'b1', blocked_user_id: 'u2', created_at: new Date(), user_id: 'u2', username: 'bob', name: 'Bob', avatar_url: '/a.png' },
        ];
        fake = installFakePool((text, params) => {
            if (text.includes('FROM story_privacy_blocks')) return [rows];
            return [[]];
        });

        const res = mockRes();
        await feed.getHiddenStoryUsers({ user: { userId: 'owner-1' } }, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.hidden.length, 1);
        assert.equal(res.body.hidden[0].username, 'bob');
        assert.equal(res.body.total, 1);

        const query = fake.calls.find(c => c.sql.includes('FROM story_privacy_blocks'));
        assert.match(query.sql, /JOIN users u ON b\.blocked_user_id = u\.user_id/);
        assert.match(query.sql, /ORDER BY b\.created_at DESC, b\.block_id ASC/);
        assert.deepEqual(query.params, ['owner-1']);
    });

    it('unhideStoryFromUser deletes the row scoped to the caller', async () => {
        let affected = 1;
        fake = installFakePool(() => [{ affectedRows: affected }]);

        const res = mockRes();
        await feed.unhideStoryFromUser({ params: { userId: 'blocked-9' }, user: { userId: 'owner-1' } }, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);

        const del = fake.calls.find(c => c.sql.startsWith('DELETE FROM story_privacy_blocks'));
        assert.ok(del, 'expected a DELETE FROM story_privacy_blocks');
        // Both the owner and the target user must be pinned in the WHERE clause.
        assert.match(del.sql, /WHERE user_id = \? AND blocked_user_id = \?/);
        assert.deepEqual(del.params, ['owner-1', 'blocked-9']);
    });

    it('unhideStoryFromUser 404s when nothing was hidden', async () => {
        fake = installFakePool(() => [{ affectedRows: 0 }]);

        const res = mockRes();
        await feed.unhideStoryFromUser({ params: { userId: 'nobody' }, user: { userId: 'owner-1' } }, res);

        assert.equal(res.statusCode, 404);
        assert.match(res.body.error, /No hidden story/);
    });

    it('unhideStoryFromUser rejects a missing userId param', async () => {
        fake = installFakePool(() => [[]]);

        const res = mockRes();
        await feed.unhideStoryFromUser({ params: {}, user: { userId: 'owner-1' } }, res);

        assert.equal(res.statusCode, 400);
    });
});

// ── getStoryViewers: deterministic ordering + pagination ─────────────────────

describe('getStoryViewers', () => {
    let fake;

    afterEach(() => { fake?.restore(); fake = null; });

    const storyOwner = async (req) => {
        const res = mockRes();
        await feed.getStoryViewers(req, res);
        return res;
    };

    it('orders by a stable tiebreaker so ties never shuffle', async () => {
        const tieTime = new Date('2026-10-31T12:00:00Z');
        fake = installFakePool((text) => {
            if (text.startsWith('SELECT user_id FROM stories')) return [[{ user_id: 'owner-1' }]];
            // The single UNION query carries all three interaction branches.
            // The fake returns them already in the SQL's tie-break order.
            if (text.includes('UNION')) {
                return [[
                    { user_id: 'b', type: 'like', created_at: tieTime },
                    { user_id: 'c', type: 'share', created_at: tieTime },
                    { user_id: 'a', type: 'view', created_at: tieTime },
                ]];
            }
            return [[]];
        });

        const res = await storyOwner({ params: { id: 'story-1' }, user: { userId: 'owner-1' }, query: {} });

        const viewersQuery = fake.calls.find(c => c.sql.includes('UNION'));
        // Deterministic ordering: created_at first, then a tiebreaker on the
        // interaction type, then on the unique user_id — a UNION alone made
        // rows that tie on created_at come back in an arbitrary order.
        assert.match(viewersQuery.sql, /ORDER BY created_at DESC, type ASC, user_id ASC/);
        assert.ok(!/ORDER BY created_at DESC\s*$/.test(viewersQuery.sql), 'ORDER BY must have a tiebreaker');
        // The response carries the DB's order straight through (no re-shuffle).
        assert.deepEqual(res.body.map(r => r.type), ['like', 'share', 'view']);
        assert.equal(res.body.length, 3);
    });

    it('applies page/limit and reports the total in a header', async () => {
        const rows = [...Array(7)].map((_, i) => ({
            user_id: `u${i}`, username: `user${i}`, type: 'view',
            created_at: new Date(Date.now() - i * 1000),
        }));
        fake = installFakePool((text) => {
            if (text.startsWith('SELECT user_id FROM stories')) return [[{ user_id: 'owner-1' }]];
            if (text.includes('UNION')) return [rows];
            return [[]];
        });

        const res = await storyOwner({ params: { id: 'story-1' }, user: { userId: 'owner-1' }, query: { page: '2', limit: '3' } });

        assert.equal(res.body.length, 3, 'page 2 of 3 per page');
        assert.equal(res.headers['X-Total-Count'], '7');
        assert.equal(res.headers['X-Page'], '2');
        assert.equal(res.headers['X-Per-Page'], '3');
        // Second page starts at the 4th row.
        assert.equal(res.body[0].user_id, 'u3');
    });

    it('clamps an oversized limit to 100', async () => {
        fake = installFakePool((text) => {
            if (text.startsWith('SELECT user_id FROM stories')) return [[{ user_id: 'owner-1' }]];
            if (text.includes('UNION')) return [[]];
            return [[]];
        });

        const res = await storyOwner({ params: { id: 'story-1' }, user: { userId: 'owner-1' }, query: { limit: '5000' } });

        assert.equal(res.headers['X-Per-Page'], '100');
    });

    it('rejects a viewer who does not own the story', async () => {
        fake = installFakePool((text) => {
            if (text.startsWith('SELECT user_id FROM stories')) return [[{ user_id: 'someone-else' }]];
            return [[]];
        });

        const res = await storyOwner({ params: { id: 'story-1' }, user: { userId: 'owner-1' }, query: {} });

        assert.equal(res.statusCode, 403);
    });
});

// ── ShareModal media handoff (static source check) ───────────────────────────

describe('ShareModal imageUrl handoff', () => {
    it('navigates to the composer carrying the post media', () => {
        const body = src('frontend/src/components/modals/ShareModal.tsx');
        assert.match(
            body,
            /navigate\(`\/afterglow\/create\$\{mediaParam\}`\)/,
            'ShareModal must navigate with the mediaParam suffix'
        );
        assert.match(body, /post\?\.media_url \? `\?imageUrl=\$\{encodeURIComponent\(post\.media_url\)\}` : ''/);
        // The composer side reads exactly this param name.
        const composer = src('frontend/src/pages/CreateStory.tsx');
        assert.match(composer, /searchParams\.get\('imageUrl'\)/);
    });

    it('MomentShareModal sends the audience with its story POST', () => {
        const body = src('frontend/src/components/modals/MomentShareModal.tsx');
        assert.match(body, /api\.post\('\/stories'/);
        assert.match(body, /audience: 'public'/, 'MomentShareModal must send an audience field');
    });
});
