// tests/reels-visibility.test.js
// Pure decision-layer tests for reel/moment audience enforcement.
// (No DB calls: canView is synchronous and context-driven.)
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const visibility = require('../backend/services/reels-visibility.service');

const OWNER = 'author-001';
const VIEWER = 'viewer-001';
const STRANGER = 'stranger-001';

const baseCtx = (over = {}) => ({
    following: new Set(),
    followers: new Set(),
    closeFriends: new Set(),
    cfMemberships: new Set(),
    blocked: new Set(),
    ...over,
});

const row = (over = {}) => ({
    moment_id: 'moment-1',
    user_id: OWNER,
    audience: 'public',
    ...over,
});

describe('reels-visibility — base audience precedence', () => {
    it('owner sees their own moment regardless of audience', () => {
        for (const audience of ['public', 'friends', 'close_friends', 'only_me']) {
            assert.equal(visibility.canView(row({ audience }), OWNER, baseCtx()), true, audience);
        }
    });

    it('public moment is visible to any signed-in viewer', () => {
        assert.equal(visibility.canView(row(), VIEWER, baseCtx()), true);
        assert.equal(visibility.canView(row(), VIEWER, baseCtx({ blocked: new Set([OWNER]) })), false);
        assert.equal(visibility.canView(row(), VIEWER, baseCtx({ blocked: new Set([VIEWER]) })), false);
    });

    it('only_me hides the moment from every non-owner', () => {
        assert.equal(visibility.canView(row({ audience: 'only_me' }), VIEWER, baseCtx()), false);
        assert.equal(visibility.canView(row({ audience: 'only_me' }), null, baseCtx()), false);
    });

    it('friends audience requires the viewer to follow the author', () => {
        assert.equal(visibility.canView(row({ audience: 'friends' }), VIEWER, baseCtx()), false);
        assert.equal(
            visibility.canView(row({ audience: 'friends' }), VIEWER, baseCtx({ following: new Set([OWNER]) })),
            true
        );
        // Viewer follows someone else → still hidden
        assert.equal(
            visibility.canView(row({ audience: 'friends' }), VIEWER, baseCtx({ following: new Set([STRANGER]) })),
            false
        );
    });

    it('close_friends checks the AUTHOR\'S list (viewer membership), not the viewer\'s own list', () => {
        const moment = row({ audience: 'close_friends' });
        // Wrong direction — viewer added the author to the viewer's own list
        assert.equal(
            visibility.canView(moment, VIEWER, baseCtx({ closeFriends: new Set([OWNER]) })),
            false
        );
        // Correct direction — the author placed the viewer on their list
        assert.equal(
            visibility.canView(moment, VIEWER, baseCtx({ cfMemberships: new Set([OWNER]) })),
            true
        );
        // Third party with no membership → hidden
        assert.equal(visibility.canView(moment, STRANGER, baseCtx()), false);
        // Guests never see close-friends reels
        assert.equal(visibility.canView(moment, null, baseCtx()), false);
    });

    it('a row with missing audience (legacy) is treated as public', () => {
        const legacy = { moment_id: 'legacy', user_id: OWNER };
        assert.equal(visibility.canView(legacy, VIEWER, baseCtx()), true);
    });

    it('null row is never visible', () => {
        assert.equal(visibility.canView(null, VIEWER, baseCtx()), false);
    });
});

describe('reels-visibility — exclusion lists', () => {
    it('hide_from column blocks listed viewers and lets others through', () => {
        const moment = row({ hide_from_user_ids: JSON.stringify([VIEWER]) });
        assert.equal(visibility.canView(moment, VIEWER, baseCtx()), false);
        assert.equal(visibility.canView(moment, STRANGER, baseCtx()), true);
        assert.equal(visibility.canView(moment, OWNER, baseCtx()), true, 'owner bypasses exclusions');
    });

    it('hide_from is enforced from overlays JSON when columns are absent (legacy rows)', () => {
        const moment = { ...row(), overlays: JSON.stringify({ hide_from: [VIEWER], show_only: [] }) };
        assert.equal(visibility.canView(moment, VIEWER, baseCtx()), false);
        assert.equal(visibility.canView(moment, STRANGER, baseCtx()), true);
    });

    it('overlays received as a parsed object are honoured too', () => {
        const moment = { ...row(), overlays: { hide_from: [VIEWER] } };
        assert.equal(visibility.canView(moment, VIEWER, baseCtx()), false);
    });

    it('show_only restricts a public moment to listed viewers', () => {
        const moment = row({ show_only_user_ids: JSON.stringify([VIEWER]) });
        assert.equal(visibility.canView(moment, VIEWER, baseCtx()), true);
        assert.equal(visibility.canView(moment, STRANGER, baseCtx()), false);
        assert.equal(visibility.canView(moment, null, baseCtx()), false, 'guests excluded');
    });

    it('hide_from wins over show_only when both lists contain the viewer', () => {
        const moment = row({
            hide_from_user_ids: JSON.stringify([VIEWER]),
            show_only_user_ids: JSON.stringify([VIEWER]),
        });
        assert.equal(visibility.canView(moment, VIEWER, baseCtx()), false);
    });

    it('author-level lists (moment_audience_lists) union with per-moment lists', () => {
        const ctx = baseCtx({
            ownerLists: new Map([[OWNER, { hide: new Set([STRANGER]), show: new Set() }]]),
        });
        // Author-level hide applies even to a public row with no columns set
        assert.equal(visibility.canView(row(), STRANGER, ctx), false);
        assert.equal(visibility.canView(row(), VIEWER, ctx), true);
        // Row-level list adds to the author-level one
        const moment = row({ hide_from_user_ids: JSON.stringify([VIEWER]) });
        assert.equal(visibility.canView(moment, VIEWER, ctx), false);
        assert.equal(visibility.canView(moment, STRANGER, ctx), false);
    });

    it('author-level show_only restricts a public moment', () => {
        const ctx = baseCtx({
            ownerLists: new Map([[OWNER, { hide: new Set(), show: new Set([VIEWER]) }]]),
        });
        assert.equal(visibility.canView(row(), VIEWER, ctx), true);
        assert.equal(visibility.canView(row(), STRANGER, ctx), false);
        assert.equal(visibility.canView(row(), OWNER, ctx), true, 'owner bypasses show_only');
    });

    it('empty exclusions never restrict visibility', () => {
        const moment = row({
            hide_from_user_ids: JSON.stringify([]),
            show_only_user_ids: 'null',
            overlays: JSON.stringify({ hide_from: [], show_only: [] }),
        });
        assert.equal(visibility.canView(moment, VIEWER, baseCtx()), true);
    });

    it('malformed JSON in exclusion fields fails open to the base audience', () => {
        const moment = row({ hide_from_user_ids: '{not-json', overlays: '{{{' });
        assert.equal(visibility.canView(moment, VIEWER, baseCtx()), true);
    });
});

describe('reels-visibility — stripPrivateFields (viewer-facing redaction)', () => {
    it('removes per-moment exclusion columns and the idempotency key', () => {
        const stripped = visibility.stripPrivateFields(row({
            hide_from_user_ids: JSON.stringify([VIEWER]),
            show_only_user_ids: JSON.stringify([STRANGER]),
            idempotency_key: 'secret-key',
            overlays: JSON.stringify({ text: [], stickers: [] }),
        }));
        assert.equal('hide_from_user_ids' in stripped, false);
        assert.equal('show_only_user_ids' in stripped, false);
        assert.equal('idempotency_key' in stripped, false);
        assert.deepEqual(JSON.parse(stripped.overlays), { text: [], stickers: [] });
    });

    it('drops hide_from/show_only embedded inside overlays (string form)', () => {
        const stripped = visibility.stripPrivateFields(row({
            overlays: JSON.stringify({ text: [1], hide_from: [VIEWER], show_only: [STRANGER] }),
        }));
        const ov = JSON.parse(stripped.overlays);
        assert.deepEqual(ov, { text: [1] });
        assert.equal('hide_from' in ov, false);
        assert.equal('show_only' in ov, false);
    });

    it('drops exclusions from parsed-object overlays without touching other keys', () => {
        const stripped = visibility.stripPrivateFields(row({
            overlays: { text: ['a'], stickers: ['b'], hide_from: [VIEWER] },
        }));
        assert.deepEqual(stripped.overlays, { text: ['a'], stickers: ['b'] });
    });

    it('leaves rows without overlays untouched', () => {
        const source = row({ audience: 'friends' });
        assert.deepEqual(visibility.stripPrivateFields(source), source);
        assert.equal(visibility.stripPrivateFields(null), null);
    });

    it('owner retains per-moment exclusion columns (privacy editor seeding)', () => {
        const stripped = visibility.stripPrivateFields(row({
            hide_from_user_ids: JSON.stringify([VIEWER]),
            show_only_user_ids: JSON.stringify([STRANGER]),
            idempotency_key: 'secret-key',
        }), { isOwner: true });
        assert.deepEqual(JSON.parse(stripped.hide_from_user_ids), [VIEWER]);
        assert.deepEqual(JSON.parse(stripped.show_only_user_ids), [STRANGER]);
        // The idempotency key is author-only publish state and never leaves,
        // even for the owner.
        assert.equal('idempotency_key' in stripped, false);
    });

    it('owner retains overlays hide_from/show_only (string and object forms)', () => {
        const asString = visibility.stripPrivateFields(row({
            overlays: JSON.stringify({ text: [1], hide_from: [VIEWER] }),
        }), { isOwner: true });
        assert.deepEqual(JSON.parse(asString.overlays), { text: [1], hide_from: [VIEWER] });

        const asObject = visibility.stripPrivateFields(row({
            overlays: { text: ['a'], show_only: [STRANGER] },
        }), { isOwner: true });
        assert.deepEqual(asObject.overlays, { text: ['a'], show_only: [STRANGER] });
    });

    it('viewer (no opts / isOwner false) still loses every private field', () => {
        const forViewer = visibility.stripPrivateFields(row({
            hide_from_user_ids: JSON.stringify([VIEWER]),
            show_only_user_ids: JSON.stringify([STRANGER]),
            overlays: { hide_from: [VIEWER], show_only: [STRANGER] },
            idempotency_key: 'k',
        }));
        assert.equal('hide_from_user_ids' in forViewer, false);
        assert.equal('show_only_user_ids' in forViewer, false);
        assert.equal('idempotency_key' in forViewer, false);
        assert.deepEqual(forViewer.overlays, {});

        const explicitFalse = visibility.stripPrivateFields(row({
            hide_from_user_ids: JSON.stringify([VIEWER]),
        }), { isOwner: false });
        assert.equal('hide_from_user_ids' in explicitFalse, false);
    });
});

describe('reels-visibility — publicPoolSql / canCommentOn building blocks', () => {
    it('publicPoolSql only admits public (or legacy null-audience) rows', () => {
        const sql = visibility.publicPoolSql('m');
        assert.ok(sql.includes("m.audience = 'public'"));
        assert.ok(sql.includes('deleted_at IS NULL'));
    });

    it('parseIdList normalises strings, arrays, and junk', () => {
        assert.deepEqual(visibility.parseIdList('["a","b"]'), ['a', 'b']);
        assert.deepEqual(visibility.parseIdList(['a', null, '']), ['a']);
        assert.deepEqual(visibility.parseIdList('nope'), []);
        assert.deepEqual(visibility.parseIdList(null), []);
    });
});
