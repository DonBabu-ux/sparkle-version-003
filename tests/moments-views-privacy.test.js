// tests/moments-views-privacy.test.js
// Controller-level tests for the owner-only moments surfaces:
//   - trackView: owner self-view not counted, visibility enforced server-side,
//     one history row per (moment, viewer), view_count only on first view,
//     opportunistic 30-day purge.
//   - getMomentViewers: owner-only, 30-day window enforced in SQL.
//   - updateMomentPrivacy: audience validation, owner-only, owner keeps
//     exclusion lists in the response (privacy-editor seeding).
//   - toggleMomentPin: owner-only toggle.
// Uses a fake pool.query router — no real database required.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const pool = require('../backend/config/database');
const visibility = require('../backend/services/reels-visibility.service');
const moments = require('../backend/controllers/moments.controller');

const OWNER = 'author-001';
const VIEWER = 'viewer-001';

const baseMoment = (over = {}) => ({
    moment_id: 'moment-1',
    user_id: OWNER,
    audience: 'public',
    view_count: 0,
    is_pinned: 0,
    deleted_at: null,
    ...over,
});

function mockRes() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
    };
}

/**
 * Route pool.query by SQL shape. `calls` records every (sql, params) pair so
 * tests can assert on executed statements. Unmatched queries return empty.
 */
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

function withVisibility(fn) {
    const original = visibility.canViewMoment;
    visibility.canViewMoment = fn;
    return () => { visibility.canViewMoment = original; };
}

const find = (calls, re) => calls.filter((c) => re.test(c.sql));

// ── trackView ────────────────────────────────────────────────────────────────

describe('moments.trackView — counting rules', () => {
    it('owner self-view is never counted', async () => {
        const fake = installFakePool(async (sql) => {
            if (/SELECT \* FROM moments WHERE moment_id/i.test(sql)) {
                return [[baseMoment({ user_id: OWNER })], []];
            }
            return [[], []];
        });
        try {
            const res = mockRes();
            await moments.trackView({ params: { id: 'moment-1' }, user: { user_id: OWNER } }, res);
            assert.equal(res.statusCode, 200);
            assert.deepEqual(res.body, { status: 'success', counted: false });
            assert.equal(find(fake.calls, /INSERT INTO moment_views/i).length, 0);
            assert.equal(find(fake.calls, /view_count = view_count \+ 1/i).length, 0);
        } finally { fake.restore(); }
    });

    it('rejects viewers who cannot see the moment (403, no history row)', async () => {
        const restoreVis = withVisibility(async () => false);
        const fake = installFakePool(async (sql) => {
            if (/SELECT \* FROM moments WHERE moment_id/i.test(sql)) {
                return [[baseMoment({ audience: 'only_me' })], []];
            }
            return [[], []];
        });
        try {
            const res = mockRes();
            await moments.trackView({ params: { id: 'moment-1' }, user: { user_id: VIEWER } }, res);
            assert.equal(res.statusCode, 403);
            assert.equal(find(fake.calls, /INSERT INTO moment_views/i).length, 0);
        } finally { fake.restore(); restoreVis(); }
    });

    it('first view inserts history + increments view_count and schedules the 30-day purge', async () => {
        const restoreVis = withVisibility(async () => true);
        const fake = installFakePool(async (sql) => {
            if (/SELECT \* FROM moments WHERE moment_id/i.test(sql)) {
                return [[baseMoment()], []];
            }
            if (/INSERT INTO moment_views/i.test(sql)) {
                return [{ affectedRows: 1 }, undefined];
            }
            return [[], []];
        });
        try {
            const res = mockRes();
            await moments.trackView({ params: { id: 'moment-1' }, user: { user_id: VIEWER } }, res);
            assert.deepEqual(res.body, { status: 'success', counted: true });

            const inserts = find(fake.calls, /INSERT INTO moment_views/i);
            assert.equal(inserts.length, 1);
            assert.match(inserts[0].sql, /ON DUPLICATE KEY UPDATE viewed_at = NOW\(\)/i);
            assert.deepEqual(inserts[0].params, ['moment-1', VIEWER]);

            const bumps = find(fake.calls, /view_count = view_count \+ 1/i);
            assert.equal(bumps.length, 1);
            assert.deepEqual(bumps[0].params, ['moment-1']);

            // Opportunistic purge keeps history inside the 30-day window.
            const purges = find(fake.calls, /DELETE FROM moment_views WHERE viewed_at < DATE_SUB\(NOW\(\), INTERVAL 30 DAY\)/i);
            assert.equal(purges.length, 1);
        } finally { fake.restore(); restoreVis(); }
    });

    it('repeat view refreshes history but does not re-increment view_count', async () => {
        const restoreVis = withVisibility(async () => true);
        const fake = installFakePool(async (sql) => {
            if (/SELECT \* FROM moments WHERE moment_id/i.test(sql)) {
                return [[baseMoment()], []];
            }
            if (/INSERT INTO moment_views/i.test(sql)) {
                return [{ affectedRows: 2 }, undefined]; // ON DUPLICATE UPDATE path
            }
            return [[], []];
        });
        try {
            const res = mockRes();
            await moments.trackView({ params: { id: 'moment-1' }, user: { user_id: VIEWER } }, res);
            assert.deepEqual(res.body, { status: 'success', counted: true });
            assert.equal(find(fake.calls, /view_count = view_count \+ 1/i).length, 0);
        } finally { fake.restore(); restoreVis(); }
    });
});

// ── getMomentViewers ─────────────────────────────────────────────────────────

describe('moments.getMomentViewers — owner-only, 30-day window', () => {
    it('404s for a missing moment', async () => {
        const fake = installFakePool(async () => [[], []]);
        try {
            const res = mockRes();
            await moments.getMomentViewers({ params: { id: 'nope' }, user: { user_id: OWNER } }, res);
            assert.equal(res.statusCode, 404);
        } finally { fake.restore(); }
    });

    it('403s for non-owners', async () => {
        const fake = installFakePool(async (sql) => {
            if (/SELECT user_id FROM moments WHERE moment_id/i.test(sql)) {
                return [[baseMoment({ user_id: OWNER })], []];
            }
            return [[], []];
        });
        try {
            const res = mockRes();
            await moments.getMomentViewers({ params: { id: 'moment-1' }, user: { user_id: VIEWER } }, res);
            assert.equal(res.statusCode, 403);
        } finally { fake.restore(); }
    });

    it('owner gets viewers; the SQL enforces the 30-day retention window and caps at 50', async () => {
        const viewers = [
            { viewer_id: 'v1', username: 'alice', name: 'Alice', avatar_url: null, viewed_at: new Date() },
        ];
        const fake = installFakePool(async (sql) => {
            if (/SELECT user_id FROM moments WHERE moment_id/i.test(sql)) {
                return [[baseMoment({ user_id: OWNER })], []];
            }
            if (/FROM moment_views v JOIN users u/i.test(sql)) {
                return [viewers, []];
            }
            return [[], []];
        });
        try {
            const res = mockRes();
            await moments.getMomentViewers({ params: { id: 'moment-1' }, user: { user_id: OWNER } }, res);
            assert.equal(res.statusCode, 200);
            assert.deepEqual(res.body, { status: 'success', viewers });

            const listQ = find(fake.calls, /FROM moment_views v JOIN users u/i);
            assert.equal(listQ.length, 1);
            assert.match(listQ[0].sql, /viewed_at >= DATE_SUB\(NOW\(\), INTERVAL 30 DAY\)/i);
            assert.match(listQ[0].sql, /LIMIT 50/i);
        } finally { fake.restore(); }
    });
});

// ── updateMomentPrivacy ──────────────────────────────────────────────────────

describe('moments.updateMomentPrivacy — validation, ownership, owner retention', () => {
    it('rejects unknown audiences before touching the database', async () => {
        const fake = installFakePool(async () => [[], []]);
        try {
            const res = mockRes();
            await moments.updateMomentPrivacy(
                { params: { id: 'moment-1' }, user: { user_id: OWNER }, body: { audience: 'everyone' } },
                res,
            );
            assert.equal(res.statusCode, 400);
            assert.equal(fake.calls.length, 0);
        } finally { fake.restore(); }
    });

    it('403s when a non-owner tries to change privacy', async () => {
        const fake = installFakePool(async (sql) => {
            if (/SELECT \* FROM moments WHERE moment_id = \? AND deleted_at IS NULL/i.test(sql)) {
                return [[baseMoment({ user_id: OWNER })], []];
            }
            return [[], []];
        });
        try {
            const res = mockRes();
            await moments.updateMomentPrivacy(
                { params: { id: 'moment-1' }, user: { user_id: VIEWER }, body: { audience: 'only_me' } },
                res,
            );
            assert.equal(res.statusCode, 403);
            assert.equal(find(fake.calls, /UPDATE moments/i).length, 0);
        } finally { fake.restore(); }
    });

    it('owner update persists lists and the response keeps them (idempotency key never leaks)', async () => {
        const updatedRow = baseMoment({
            audience: 'only_me',
            hide_from_user_ids: JSON.stringify(['h1', 'h2']),
            show_only_user_ids: JSON.stringify(['s1']),
            idempotency_key: 'secret-key',
        });
        const fake = installFakePool(async (sql, params) => {
            if (/SELECT \* FROM moments WHERE moment_id = \? AND deleted_at IS NULL/i.test(sql)) {
                return [[baseMoment({ audience: 'public' })], []];
            }
            if (/UPDATE moments\s+SET audience = \?/i.test(sql)) {
                return [{ affectedRows: 1 }, undefined];
            }
            if (/SELECT \* FROM moments WHERE moment_id = \?$/i.test(sql)) {
                return [[updatedRow], []];
            }
            return [[], []];
        });
        try {
            const res = mockRes();
            await moments.updateMomentPrivacy(
                {
                    params: { id: 'moment-1' },
                    user: { user_id: OWNER },
                    body: { audience: 'only_me', hide_from: ['h1', 'h2'], show_only: ['s1'] },
                },
                res,
            );
            assert.equal(res.statusCode, 200);

            const updates = find(fake.calls, /UPDATE moments\s+SET audience = \?/i);
            assert.equal(updates.length, 1);
            assert.deepEqual(updates[0].params, [
                'only_me',
                JSON.stringify(['h1', 'h2']),
                JSON.stringify(['s1']),
                'moment-1',
                OWNER,
            ]);

            // Owner keeps the exclusion lists so the privacy sheet can seed
            // its state — but never the publish idempotency key.
            assert.deepEqual(JSON.parse(res.body.moment.hide_from_user_ids), ['h1', 'h2']);
            assert.deepEqual(JSON.parse(res.body.moment.show_only_user_ids), ['s1']);
            assert.equal('idempotency_key' in res.body.moment, false);
        } finally { fake.restore(); }
    });
});

// ── toggleMomentPin ──────────────────────────────────────────────────────────

describe('moments.toggleMomentPin — owner-only toggle', () => {
    it('403s for non-owners', async () => {
        const fake = installFakePool(async (sql) => {
            if (/SELECT user_id, is_pinned FROM moments/i.test(sql)) {
                return [[baseMoment({ user_id: OWNER, is_pinned: 0 })], []];
            }
            return [[], []];
        });
        try {
            const res = mockRes();
            await moments.toggleMomentPin({ params: { id: 'moment-1' }, user: { user_id: VIEWER } }, res);
            assert.equal(res.statusCode, 403);
            assert.equal(find(fake.calls, /UPDATE moments SET is_pinned/i).length, 0);
        } finally { fake.restore(); }
    });

    it('toggles 0→1 and 1→0 for the owner', async () => {
        for (const [current, next] of [[0, 1], [1, 0]]) {
            const fake = installFakePool(async (sql) => {
                if (/SELECT user_id, is_pinned FROM moments/i.test(sql)) {
                    return [[baseMoment({ user_id: OWNER, is_pinned: current })], []];
                }
                return [[], []];
            });
            try {
                const res = mockRes();
                await moments.toggleMomentPin({ params: { id: 'moment-1' }, user: { user_id: OWNER } }, res);
                assert.deepEqual(res.body, { status: 'success', is_pinned: next });
                const updates = find(fake.calls, /UPDATE moments SET is_pinned = \?/i);
                assert.equal(updates.length, 1);
                assert.deepEqual(updates[0].params, [next, 'moment-1']);
            } finally { fake.restore(); }
        }
    });
});
