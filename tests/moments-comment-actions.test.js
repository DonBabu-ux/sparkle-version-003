// tests/moments-comment-actions.test.js
// Controller-level tests for the Sparkle Moments comment action surface:
//   - editComment: owner-only, 48h window, touches content/updated_at only.
//   - deleteComment: owner-only, full-thread cascade (no orphaned replies),
//     counter decremented by exactly the rows transitioned, no self-
//     moderation notification.
//   - moderateComment: reason required, reel-ownership verified server-side,
//     platform moderation role honored, audit row written in the same
//     transaction, author notified (no comment text leaked), idempotent
//     retries never duplicate the audit or the notification.
//   - reportComment: queues a report without ever deleting the comment.
//   - addComment: parent validation + reply flattening (single-level tree).
//   - getComments: exposes reel_owner_id for the client's menu decisions
//     (the server still re-checks every write).
// Uses a fake pool.query / pool.getConnection router — no real database.
const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');

const pool = require('../backend/config/database');
const visibility = require('../backend/services/reels-visibility.service');
const moments = require('../backend/controllers/moments.controller');

const OWNER = 'owner-001';      // reel creator
const AUTHOR = 'author-001';    // comment author (not the reel creator)
const OTHER = 'other-001';      // unrelated user
const ADMIN = 'admin-001';      // platform moderator

const baseMoment = (over = {}) => ({
    moment_id: 'moment-1',
    user_id: OWNER,
    audience: 'public',
    comments_enabled: 1,
    deleted_at: null,
    comment_count: 3,
    ...over,
});

const baseComment = (over = {}) => ({
    comment_id: 'comment-1',
    moment_id: 'moment-1',
    user_id: AUTHOR,
    parent_comment_id: null,
    content: 'Hello sparkle world',
    like_count: 2,
    created_at: new Date(Date.now() - 60 * 60 * 1000), // 1h old
    updated_at: null,
    is_deleted: 0,
    username: 'author',
    avatar_url: null,
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
 * Route pool.query by SQL shape. `calls` records every (sql, params) pair.
 * Also patches pool.getConnection so the transaction helper runs against the
 * same recorder (begin/commit/rollback/release are tracked in `tx`).
 */
function installFakePool(impl) {
    const calls = [];
    const tx = { begun: 0, committed: 0, rolledBack: 0, released: 0 };
    const originalQuery = pool.query;
    const originalGetConnection = pool.getConnection;

    const route = async (sql, params = []) => {
        const text = String(sql).replace(/\s+/g, ' ').trim();
        calls.push({ sql: text, params });
        return impl(text, params);
    };

    pool.query = route;
    pool.getConnection = async () => ({
        query: route,
        beginTransaction: async () => { tx.begun += 1; },
        commit: async () => { tx.committed += 1; },
        rollback: async () => { tx.rolledBack += 1; },
        release: () => { tx.released += 1; },
    });

    return {
        calls,
        tx,
        restore() {
            pool.query = originalQuery;
            pool.getConnection = originalGetConnection;
        },
    };
}

function withVisibility(fn) {
    const original = visibility.canViewMoment;
    visibility.canViewMoment = fn;
    return () => { visibility.canViewMoment = original; };
}

function withCanComment(fn) {
    const original = visibility.canCommentOn;
    visibility.canCommentOn = fn;
    return () => { visibility.canCommentOn = original; };
}

const find = (calls, re) => calls.filter((c) => re.test(c.sql));

// Shared SQL handlers every test can lean on (schema bootstrap + lookups).
function schemaHandlers(sql) {
    if (/SHOW COLUMNS FROM `moment_comments`/i.test(sql)) {
        return [[
            { Field: 'comment_id' }, { Field: 'moment_id' }, { Field: 'user_id' },
            { Field: 'parent_comment_id' }, { Field: 'content' }, { Field: 'like_count' },
            { Field: 'created_at' }, { Field: 'updated_at' }, { Field: 'is_deleted' },
        ], []];
    }
    if (/SHOW COLUMNS FROM `moments`/i.test(sql)) {
        return [[
            { Field: 'moment_id' }, { Field: 'user_id' }, { Field: 'comment_count' },
            { Field: 'deleted_at' }, { Field: 'comments_enabled' }, { Field: 'audience' },
        ], []];
    }
    if (/CREATE TABLE|ALTER TABLE/i.test(sql)) return [[], []];
    return null;
}

// ── editComment ───────────────────────────────────────────────────────────────

describe('moments.editComment — owner-only, window, minimal writes', () => {
    it('403s when someone else tries to edit', async () => {
        const fake = installFakePool(async (sql) => {
            const schema = schemaHandlers(sql);
            if (schema) return schema;
            if (/SELECT \* FROM moment_comments WHERE comment_id = \? AND is_deleted = 0/i.test(sql)) {
                return [[baseComment()], []];
            }
            return [[], []];
        });
        try {
            const res = mockRes();
            await moments.editComment(
                { params: { id: 'comment-1' }, user: { user_id: OTHER }, body: { content: 'hijacked' } },
                res
            );
            assert.equal(res.statusCode, 403);
            assert.equal(find(fake.calls, /UPDATE moment_comments SET content/i).length, 0);
        } finally { fake.restore(); }
    });

    it('403s after the 48h edit window closes', async () => {
        const stale = baseComment({ created_at: new Date(Date.now() - 49 * 60 * 60 * 1000) });
        const fake = installFakePool(async (sql) => {
            const schema = schemaHandlers(sql);
            if (schema) return schema;
            if (/SELECT \* FROM moment_comments WHERE comment_id = \? AND is_deleted = 0/i.test(sql)) {
                return [[stale], []];
            }
            return [[], []];
        });
        try {
            const res = mockRes();
            await moments.editComment(
                { params: { id: 'comment-1' }, user: { user_id: AUTHOR }, body: { content: 'too late' } },
                res
            );
            assert.equal(res.statusCode, 403);
            assert.match(res.body.error, /edit window/i);
            assert.equal(find(fake.calls, /UPDATE moment_comments SET content/i).length, 0);
        } finally { fake.restore(); }
    });

    it('updates content + updated_at only and keeps the same comment id', async () => {
        const updatedRow = baseComment({ content: 'edited text', updated_at: new Date() });
        const fake = installFakePool(async (sql) => {
            const schema = schemaHandlers(sql);
            if (schema) return schema;
            if (/SELECT \* FROM moment_comments WHERE comment_id = \? AND is_deleted = 0/i.test(sql)) {
                return [[baseComment()], []];
            }
            if (/UPDATE moment_comments SET content = \?, updated_at = NOW\(\) WHERE comment_id = \?/i.test(sql)) {
                return [{ affectedRows: 1 }, undefined];
            }
            if (/SELECT c\.\*, u\.username, u\.avatar_url FROM moment_comments c/i.test(sql)) {
                return [[updatedRow], []];
            }
            return [[], []];
        });
        try {
            const res = mockRes();
            await moments.editComment(
                { params: { id: 'comment-1' }, user: { user_id: AUTHOR }, body: { content: 'edited text' } },
                res
            );
            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, true);
            assert.equal(res.body.comment.comment_id, 'comment-1');

            const updates = find(fake.calls, /UPDATE moment_comments SET content = \?/i);
            assert.equal(updates.length, 1);
            // Only content + timestamp columns are ever written: likes,
            // replies, parent links and created_at are untouched.
            assert.match(updates[0].sql, /SET content = \?, updated_at = NOW\(\) WHERE comment_id = \?/i);
            assert.equal(/like_count|parent_comment_id|created_at/i.test(updates[0].sql), false);
            assert.deepEqual(updates[0].params, ['edited text', 'comment-1']);
        } finally { fake.restore(); }
    });
});

// ── deleteComment ─────────────────────────────────────────────────────────────

describe('moments.deleteComment — owner-only full-thread cascade', () => {
    it('403s when a stranger tries to delete', async () => {
        const fake = installFakePool(async (sql) => {
            const schema = schemaHandlers(sql);
            if (schema) return schema;
            if (/SELECT c\.\*, m\.user_id AS reel_owner_id FROM moment_comments c JOIN moments m/i.test(sql)) {
                return [[baseComment()], []];
            }
            return [[], []];
        });
        try {
            const res = mockRes();
            await moments.deleteComment({ params: { id: 'comment-1' }, user: { user_id: OTHER } }, res);
            assert.equal(res.statusCode, 403);
            assert.equal(find(fake.calls, /UPDATE moment_comments SET is_deleted = 1/i).length, 0);
        } finally { fake.restore(); }
    });

    it('cascades to live descendants, counts only transitioned rows, commits once', async () => {
        const fake = installFakePool(async (sql) => {
            const schema = schemaHandlers(sql);
            if (schema) return schema;
            if (/SELECT c\.\*, m\.user_id AS reel_owner_id FROM moment_comments c JOIN moments m/i.test(sql)) {
                // deleteComment's query has no deleted_at predicate
                if (/m\.deleted_at IS NULL/i.test(sql)) return [[], []];
                return [[baseComment()], []];
            }
            if (/SELECT comment_id FROM moment_comments WHERE is_deleted = 0 AND parent_comment_id IN/i.test(sql)) {
                // One direct reply (grandchildren handled by the loop)
                return [[{ comment_id: 'reply-1' }], []];
            }
            if (/UPDATE moment_comments SET is_deleted = 1/i.test(sql)) {
                return [{ affectedRows: 2 }, undefined]; // comment + reply
            }
            if (/UPDATE moments SET comment_count = GREATEST/i.test(sql)) {
                return [{ affectedRows: 1 }, undefined];
            }
            return [[], []];
        });
        try {
            const res = mockRes();
            await moments.deleteComment({ params: { id: 'comment-1' }, user: { user_id: AUTHOR } }, res);
            assert.equal(res.statusCode, 200);
            assert.equal(res.body.deletedCount, 2);

            const cascade = find(fake.calls, /UPDATE moment_comments SET is_deleted = 1/i);
            assert.equal(cascade.length, 1);
            // Both the root and its reply are in the same guarded UPDATE.
            assert.deepEqual([...cascade[0].params].sort(), ['comment-1', 'reply-1']);
            assert.match(cascade[0].sql, /WHERE is_deleted = 0 AND comment_id IN/i);

            // Counter uses the transitioned row count (2), never a post-hoc
            // COUNT that would include already-deleted rows.
            const counter = find(fake.calls, /UPDATE moments SET comment_count = GREATEST/i);
            assert.equal(counter.length, 1);
            assert.deepEqual(counter[0].params, [2, 'moment-1']);

            // Everything ran inside one transaction.
            assert.equal(fake.tx.begun, 1);
            assert.equal(fake.tx.committed, 1);
            assert.equal(fake.tx.rolledBack, 0);

            // Self-deletion never produces a moderation notification.
            assert.equal(find(fake.calls, /INSERT INTO notifications/i).length, 0);
            assert.equal(find(fake.calls, /INSERT INTO moment_comment_moderation_log/i).length, 0);
        } finally { fake.restore(); }
    });
});

// ── moderateComment ───────────────────────────────────────────────────────────

describe('moments.moderateComment — authorization, audit, notification', () => {
    it('400s without a valid moderation reason', async () => {
        const fake = installFakePool(async () => [[], []]);
        try {
            const res = mockRes();
            await moments.moderateComment(
                { params: { id: 'comment-1' }, user: { user_id: OWNER }, body: {} },
                res
            );
            assert.equal(res.statusCode, 400);
            assert.equal(fake.calls.length, 0); // rejected before any query
        } finally { fake.restore(); }
    });

    it('403s for a user who neither owns the Reel nor holds a moderation role', async () => {
        const fake = installFakePool(async (sql) => {
            const schema = schemaHandlers(sql);
            if (schema) return schema;
            if (/FROM moment_comments c JOIN moments m/i.test(sql)) {
                return [[baseComment({ reel_owner_id: OWNER })], []];
            }
            if (/SELECT role FROM users WHERE user_id = \?/i.test(sql)) {
                return [[{ role: 'user' }], []];
            }
            return [[], []];
        });
        try {
            const res = mockRes();
            await moments.moderateComment(
                { params: { id: 'comment-1' }, user: { user_id: OTHER }, body: { reason: 'spam_or_advertising' } },
                res
            );
            assert.equal(res.statusCode, 403);
            assert.equal(find(fake.calls, /UPDATE moment_comments SET is_deleted = 1/i).length, 0);
            assert.equal(find(fake.calls, /INSERT INTO moment_comment_moderation_log/i).length, 0);
            assert.equal(find(fake.calls, /INSERT INTO notifications/i).length, 0);
        } finally { fake.restore(); }
    });

    it('400s when the reel owner tries to moderate their own comment (self-delete route)', async () => {
        const fake = installFakePool(async (sql) => {
            const schema = schemaHandlers(sql);
            if (schema) return schema;
            if (/FROM moment_comments c JOIN moments m/i.test(sql)) {
                return [[baseComment({ user_id: OWNER, reel_owner_id: OWNER })], []];
            }
            return [[], []];
        });
        try {
            const res = mockRes();
            await moments.moderateComment(
                { params: { id: 'comment-1' }, user: { user_id: OWNER }, body: { reason: 'spam_or_advertising' } },
                res
            );
            assert.equal(res.statusCode, 400);
            assert.equal(find(fake.calls, /INSERT INTO moment_comment_moderation_log/i).length, 0);
        } finally { fake.restore(); }
    });

    it('reel owner: removal + audit + author notification, all or nothing', async () => {
        const restoreVis = withVisibility(async () => true);
        const fake = installFakePool(async (sql, params) => {
            const schema = schemaHandlers(sql);
            if (schema) return schema;
            if (/FROM moment_comments c JOIN moments m/i.test(sql)) {
                return [[baseComment({ reel_owner_id: OWNER })], []]; // comment + reel owner loaded, owner matches
            }
            if (/SELECT id FROM moment_comment_moderation_log WHERE moderator_id/i.test(sql)) {
                return [[], []]; // no prior moderation
            }
            if (/SELECT comment_id FROM moment_comments WHERE is_deleted = 0 AND parent_comment_id IN/i.test(sql)) {
                return [[{ comment_id: 'reply-1' }], []];
            }
            if (/UPDATE moment_comments SET is_deleted = 1/i.test(sql)) {
                return [{ affectedRows: 2 }, undefined];
            }
            if (/INSERT INTO moment_comment_moderation_log/i.test(sql)) {
                return [{ affectedRows: 1 }, undefined];
            }
            if (/UPDATE moments SET comment_count = GREATEST/i.test(sql)) {
                return [{ affectedRows: 1 }, undefined];
            }
            if (/SELECT username FROM users WHERE user_id = \?/i.test(sql)) {
                return [[{ username: 'don' }], []];
            }
            return [[], []];
        });
        try {
            const res = mockRes();
            await moments.moderateComment(
                {
                    params: { id: 'comment-1' },
                    user: { user_id: OWNER },
                    body: { reason: 'spam_or_advertising', reasonDetails: 'buy followers' },
                },
                res
            );
            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, true);
            assert.ok(res.body.auditId);

            // Audit row: who, what, which reel, why, when — inside the txn.
            const audits = find(fake.calls, /INSERT INTO moment_comment_moderation_log/i);
            assert.equal(audits.length, 1);
            const auditParams = audits[0].params;
            assert.equal(auditParams[1], 'moment-1');          // reel_id
            assert.equal(auditParams[2], 'comment-1');          // comment_id (top-level)
            assert.equal(auditParams[3], null);                 // reply_id null
            assert.equal(auditParams[4], OWNER);                // moderator_id
            assert.equal(auditParams[5], AUTHOR);               // comment_author_id
            assert.equal(auditParams[6], 'spam_or_advertising'); // moderation_reason
            assert.equal(auditParams[7], 'buy followers');       // reason_details
            assert.equal(auditParams[8], 'delete');              // action

            // Transaction wraps removal + audit.
            assert.equal(fake.tx.begun, 1);
            assert.equal(fake.tx.committed, 1);

            // Notification goes to the comment author (not the moderator),
            // deep-links to the Reel, and never contains the comment text.
            const notifs = find(fake.calls, /INSERT INTO notifications/i);
            assert.equal(notifs.length, 1);
            // params: [notification_id, user_id, type, title, content,
            //          related_id, related_type, actor_id, action_url, ...]
            const np = notifs[0].params;
            assert.equal(np[1], AUTHOR);
            assert.equal(np[2], 'comment');
            assert.equal(np[3], 'Your comment was removed');
            assert.match(np[4], /removed by the Reel creator/i);
            assert.match(np[4], /Spam or advertising/i);
            assert.equal(np[4].includes('Hello sparkle world'), false); // no comment text
            assert.equal(np[4].includes('buy followers'), false);       // no private notes
            assert.equal(np[5], 'moment-1');
            assert.equal(np[6], 'moment');
            assert.equal(np[8], '/moments/moment-1');
        } finally { fake.restore(); restoreVis(); }
    });

    it('platform admin moderates a foreign Reel (platform_delete action)', async () => {
        const fake = installFakePool(async (sql) => {
            const schema = schemaHandlers(sql);
            if (schema) return schema;
            if (/FROM moment_comments c JOIN moments m/i.test(sql)) {
                return [[baseComment({ reel_owner_id: OWNER })], []]; // owner is OWNER, caller is ADMIN
            }
            if (/SELECT role FROM users WHERE user_id = \?/i.test(sql)) {
                return [[{ role: 'admin' }], []];
            }
            if (/SELECT id FROM moment_comment_moderation_log WHERE moderator_id/i.test(sql)) {
                return [[], []];
            }
            if (/UPDATE moment_comments SET is_deleted = 1/i.test(sql)) {
                return [{ affectedRows: 1 }, undefined];
            }
            if (/INSERT INTO moment_comment_moderation_log/i.test(sql)) {
                return [{ affectedRows: 1 }, undefined];
            }
            if (/SELECT username FROM users WHERE user_id = \?/i.test(sql)) {
                return [[{ username: 'sparkle' }], []];
            }
            return [[], []];
        });
        try {
            const res = mockRes();
            await moments.moderateComment(
                { params: { id: 'comment-1' }, user: { user_id: ADMIN }, body: { reason: 'hate_speech_or_abusive_language' } },
                res
            );
            assert.equal(res.statusCode, 200);

            const audits = find(fake.calls, /INSERT INTO moment_comment_moderation_log/i);
            assert.equal(audits.length, 1);
            assert.equal(audits[0].params[8], 'platform_delete');
            assert.equal(audits[0].params[4], ADMIN);

            const notifs = find(fake.calls, /INSERT INTO notifications/i);
            assert.equal(notifs.length, 1);
            assert.match(notifs[0].params[4], /Sparkle moderation/i);
        } finally { fake.restore(); }
    });

    it('reply moderation records reply_id and targets the reply author', async () => {
        const reply = baseComment({
            comment_id: 'reply-9',
            parent_comment_id: 'comment-1',
            content: 'a reply',
        });
        const fake = installFakePool(async (sql) => {
            const schema = schemaHandlers(sql);
            if (schema) return schema;
            if (/FROM moment_comments c JOIN moments m/i.test(sql)) {
                return [[{ ...reply, reel_owner_id: OWNER }], []];
            }
            if (/SELECT id FROM moment_comment_moderation_log WHERE moderator_id/i.test(sql)) {
                return [[], []];
            }
            if (/UPDATE moment_comments SET is_deleted = 1/i.test(sql)) {
                return [{ affectedRows: 1 }, undefined];
            }
            if (/INSERT INTO moment_comment_moderation_log/i.test(sql)) {
                return [{ affectedRows: 1 }, undefined];
            }
            if (/SELECT username FROM users WHERE user_id = \?/i.test(sql)) {
                return [[{ username: 'don' }], []];
            }
            return [[], []];
        });
        try {
            const res = mockRes();
            await moments.moderateComment(
                { params: { id: 'reply-9' }, user: { user_id: OWNER }, body: { reason: 'irrelevant_content' } },
                res
            );
            assert.equal(res.statusCode, 200);
            const audits = find(fake.calls, /INSERT INTO moment_comment_moderation_log/i);
            assert.equal(audits[0].params[2], 'comment-1'); // thread root
            assert.equal(audits[0].params[3], 'reply-9');    // reply_id
            // Only the reply itself was flagged for deletion.
            const del = find(fake.calls, /UPDATE moment_comments SET is_deleted = 1/i);
            assert.deepEqual(del[0].params, ['reply-9']);
            // Reply author is notified, not every thread participant.
            const notifs = find(fake.calls, /INSERT INTO notifications/i);
            assert.equal(notifs[0].params[1], AUTHOR);
            assert.match(notifs[0].params[4], /^Your reply/i);
        } finally { fake.restore(); }
    });

    it('a retried moderation is rejected with 409 and never duplicates audit or notification', async () => {
        const fake = installFakePool(async (sql) => {
            const schema = schemaHandlers(sql);
            if (schema) return schema;
            if (/FROM moment_comments c JOIN moments m/i.test(sql)) {
                return [[baseComment({ reel_owner_id: OWNER })], []];
            }
            if (/SELECT id FROM moment_comment_moderation_log WHERE moderator_id/i.test(sql)) {
                return [[{ id: 'audit-existing' }], []]; // already moderated
            }
            return [[], []];
        });
        try {
            const res = mockRes();
            await moments.moderateComment(
                { params: { id: 'comment-1' }, user: { user_id: OWNER }, body: { reason: 'spam_or_advertising' } },
                res
            );
            assert.equal(res.statusCode, 409);
            assert.equal(find(fake.calls, /UPDATE moment_comments SET is_deleted = 1/i).length, 0);
            assert.equal(find(fake.calls, /INSERT INTO moment_comment_moderation_log/i).length, 0);
            assert.equal(find(fake.calls, /INSERT INTO notifications/i).length, 0);
        } finally { fake.restore(); }
    });
});

// ── reportComment ─────────────────────────────────────────────────────────────

describe('moments.reportComment — platform reporting never deletes', () => {
    it('400s without a reason', async () => {
        const fake = installFakePool(async () => [[], []]);
        try {
            const res = mockRes();
            await moments.reportComment(
                { params: { id: 'comment-1' }, user: { user_id: OTHER }, body: {} },
                res
            );
            assert.equal(res.statusCode, 400);
        } finally { fake.restore(); }
    });

    it('queues a report and leaves the comment fully intact', async () => {
        const restoreVis = withVisibility(async () => true);
        const fake = installFakePool(async (sql) => {
            const schema = schemaHandlers(sql);
            if (schema) return schema;
            if (/SELECT c\.comment_id, c\.moment_id, m\.\* FROM moment_comments c/i.test(sql)) {
                return [[{ ...baseMoment(), comment_id: 'comment-1', moment_id: 'moment-1' }], []];
            }
            if (/INSERT INTO moment_comment_reports/i.test(sql)) {
                return [{ affectedRows: 1 }, undefined];
            }
            return [[], []];
        });
        try {
            const res = mockRes();
            await moments.reportComment(
                { params: { id: 'comment-1' }, user: { user_id: OTHER }, body: { reason: 'Spam link' } },
                res
            );
            assert.equal(res.statusCode, 201);
            assert.equal(res.body.success, true);

            const inserts = find(fake.calls, /INSERT INTO moment_comment_reports/i);
            assert.equal(inserts.length, 1);
            assert.deepEqual(inserts[0].params.slice(1), ['comment-1', 'moment-1', OTHER, 'Spam link']);

            // A report is NOT a deletion and NOT a moderation action.
            assert.equal(find(fake.calls, /UPDATE moment_comments/i).length, 0);
            assert.equal(find(fake.calls, /INSERT INTO moment_comment_moderation_log/i).length, 0);
            assert.equal(find(fake.calls, /INSERT INTO notifications/i).length, 0);
        } finally { fake.restore(); restoreVis(); }
    });

    it('rejects duplicate reports from the same reporter', async () => {
        const restoreVis = withVisibility(async () => true);
        const fake = installFakePool(async (sql) => {
            const schema = schemaHandlers(sql);
            if (schema) return schema;
            if (/SELECT c\.comment_id, c\.moment_id, m\.\* FROM moment_comments c/i.test(sql)) {
                return [[{ ...baseMoment(), comment_id: 'comment-1', moment_id: 'moment-1' }], []];
            }
            if (/INSERT INTO moment_comment_reports/i.test(sql)) {
                const err = new Error('dup');
                err.code = 'ER_DUP_ENTRY';
                throw err;
            }
            return [[], []];
        });
        try {
            const res = mockRes();
            await moments.reportComment(
                { params: { id: 'comment-1' }, user: { user_id: OTHER }, body: { reason: 'again' } },
                res
            );
            assert.equal(res.statusCode, 400);
            assert.match(res.body.error, /already reported/i);
        } finally { fake.restore(); restoreVis(); }
    });

    after(() => {
        setTimeout(() => process.exit(0), 100);
    });
});

// ── addComment / getComments — tree integrity + owner signal ──────────────────

describe('moments.addComment — parent validation and single-level tree', () => {
    it('400s when the parent comment does not exist on this Reel', async () => {
        const restoreVis = withCanComment(async () => true);
        const fake = installFakePool(async (sql) => {
            const schema = schemaHandlers(sql);
            if (schema) return schema;
            if (/SELECT \* FROM moments WHERE moment_id = \? AND deleted_at IS NULL/i.test(sql)) {
                return [[baseMoment()], []];
            }
            if (/SELECT comment_id, parent_comment_id FROM moment_comments/i.test(sql)) {
                return [[], []]; // parent missing / deleted / wrong reel
            }
            return [[], []];
        });
        try {
            const res = mockRes();
            await moments.addComment(
                { params: { id: 'moment-1' }, user: { user_id: AUTHOR }, body: { comment: 'hi', parentId: 'ghost' } },
                res
            );
            assert.equal(res.statusCode, 400);
            assert.equal(find(fake.calls, /INSERT INTO moment_comments/i).length, 0);
        } finally { fake.restore(); restoreVis(); }
    });

    it('flattens a reply-to-reply onto the thread root (no orphaned grandchildren)', async () => {
        const restoreVis = withCanComment(async () => true);
        const fake = installFakePool(async (sql) => {
            const schema = schemaHandlers(sql);
            if (schema) return schema;
            if (/SELECT \* FROM moments WHERE moment_id = \? AND deleted_at IS NULL/i.test(sql)) {
                return [[baseMoment()], []];
            }
            if (/SELECT comment_id, parent_comment_id FROM moment_comments/i.test(sql)) {
                // The targeted parent is itself a reply under root 'root-1'
                return [[{ comment_id: 'reply-2', parent_comment_id: 'root-1' }], []];
            }
            if (/INSERT INTO moment_comments/i.test(sql)) {
                return [{ affectedRows: 1 }, undefined];
            }
            if (/UPDATE moments SET comment_count = comment_count \+ 1/i.test(sql)) {
                return [{ affectedRows: 1 }, undefined];
            }
            if (/SELECT c\.\*, u\.username, u\.avatar_url\s+FROM moment_comments c/i.test(sql)) {
                return [[baseComment({ comment_id: 'new-1', parent_comment_id: 'root-1' })], []];
            }
            return [[], []];
        });
        try {
            const res = mockRes();
            await moments.addComment(
                { params: { id: 'moment-1' }, user: { user_id: AUTHOR }, body: { comment: 'nested', parentId: 'reply-2' } },
                res
            );
            assert.equal(res.statusCode, 201);
            const inserts = find(fake.calls, /INSERT INTO moment_comments/i);
            assert.equal(inserts.length, 1);
            // parent written as the ROOT, never the intermediate reply.
            assert.equal(inserts[0].params[4], 'root-1');
        } finally { fake.restore(); restoreVis(); }
    });

    after(() => {
        setTimeout(() => process.exit(0), 100);
    });
});

describe('moments.getComments — exposes reel_owner_id for menu decisions', () => {
    it('returns comments with reel_owner_id (viewer sees, server still authorizes writes)', async () => {
        const restoreVis = withVisibility(async () => true);
        const rows = [
            baseComment({ comment_id: 'c1' }),
            baseComment({ comment_id: 'r1', parent_comment_id: 'c1', content: 'reply!' }),
        ];
        const fake = installFakePool(async (sql) => {
            const schema = schemaHandlers(sql);
            if (schema) return schema;
            if (/SELECT \* FROM moments WHERE moment_id = \? AND deleted_at IS NULL/i.test(sql)) {
                return [[baseMoment()], []];
            }
            if (/FROM moment_comments c JOIN users u ON c\.user_id = u\.user_id/i.test(sql)) {
                return [rows, []];
            }
            return [[], []];
        });
        try {
            const res = mockRes();
            await moments.getComments({ params: { id: 'moment-1' }, user: { user_id: OTHER } }, res);
            assert.equal(res.statusCode, 200);
            assert.equal(res.body.reel_owner_id, OWNER);
            assert.equal(res.body.comments.length, 1);          // one root thread
            assert.equal(res.body.comments[0].replies.length, 1); // nested reply
        } finally { fake.restore(); restoreVis(); }
    });

    after(() => {
        setTimeout(() => process.exit(0), 100);
    });
});
