// tests/inboxBadgeAccuracy.test.js
//
// Two badge bugs found in the Messages sidebar and the SparkleHub tile.
// Both are arithmetic, so they need exact-value tests rather than smoke tests:
//
//  1. The "All" tab rendered the total chat count as an unread badge, so an
//     inbox with 24 conversations and nothing unread still showed "24".
//     A badge means "unread things in this filter", never an item count.
//
//  2. SparkleHub computed Math.max(sum(liveCounts), sum(serverCounts)) — the
//     max of two separately-computed totals, not the sum of the per-chat
//     resolution. An empty inbox with a stale 20-message server total and a
//     3-chat live flag reported 20.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const ROOT = join(__dirname, '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

/**
 * Mirror of getTabBadgeCount in pages/Messages.tsx. The component's version is
 * closed over its own state, so the rule is restated here against fixture rows.
 * The contract is what is under test, not the copy.
 */
function tabBadgeCount(tabId, conversations, customLists = []) {
    if (tabId === 'all') return 0;

    const inTab = (cv) => {
        if (tabId === 'unread') return (cv.unread_count || 0) > 0 && !cv.is_archived;
        if (tabId === 'groups') return !!(cv.is_group || cv.chat_type === 'group');
        if (tabId === 'archived') return !!cv.is_archived;
        const list = customLists.find((l) => l.id === tabId);
        return !!list && list.chatIds.includes(cv.chat_id);
    };

    return conversations.filter(inTab).reduce((acc, cv) => acc + (cv.unread_count || 0), 0);
}

/** Mirror of the SparkleHub resolution: per chat, then sum. */
function hubUnreadTotal(conversations, unreadCounts) {
    let total = 0;
    (conversations || []).forEach((c) => {
        const live = unreadCounts ? unreadCounts[c.chat_id] : undefined;
        const server = Number(c.unread_count) || 0;
        total += typeof live === 'number' ? Math.max(live, server) : server;
    });
    Object.entries(unreadCounts || {}).forEach(([chatId, n]) => {
        const known = (conversations || []).some((c) => c.chat_id === chatId);
        if (!known) total += Number(n) || 0;
    });
    return total;
}

const CONV = (chat_id, unread_count, extra = {}) => ({ chat_id, unread_count, ...extra });

describe('sidebar tab badges report unread messages, never item counts', () => {
    it('the All tab shows no badge at all, however full the inbox is', () => {
        const convs = [CONV('a', 0), CONV('b', 0), CONV('c', 3)];
        assert.equal(tabBadgeCount('all', convs), 0, 'All is the whole inbox, not a subset');
    });

    it('All stays empty even with a large inbox', () => {
        const convs = Array.from({ length: 200 }, (_, i) => CONV('c' + i, i % 7));
        assert.equal(tabBadgeCount('all', convs), 0);
    });

    it('the Unread tab reports unread messages and nothing else', () => {
        const convs = [CONV('a', 0), CONV('b', 5), CONV('c', 2)];
        assert.equal(tabBadgeCount('unread', convs), 7);
    });

    it('the Unread badge excludes archived, matching what the list renders', () => {
        // The old badge summed archived rows too, so it read 5 above a list of 2.
        const convs = [CONV('a', 2), CONV('b', 3, { is_archived: true })];
        assert.equal(tabBadgeCount('unread', convs), 2);
    });

    it('an inbox with nothing unread shows no badge on any tab', () => {
        const convs = [CONV('a', 0), CONV('b', 0)];
        for (const tab of ['all', 'unread', 'groups', 'archived']) {
            assert.equal(tabBadgeCount(tab, convs), 0, tab + ' should be badge-free');
        }
    });

    it('Groups and Archived report their unread, not their size', () => {
        const convs = [
            CONV('a', 4, { is_group: true }),
            CONV('b', 1, { is_group: true }),
            CONV('c', 9),                       // 1:1, unread, belongs to no tab badge
            CONV('d', 2, { is_archived: true }),
        ];
        assert.equal(tabBadgeCount('groups', convs), 5, 'groups = unread inside groups');
        assert.equal(tabBadgeCount('archived', convs), 2, 'archived = unread inside archived');
    });

    it('a custom list reports the unread inside it', () => {
        const convs = [CONV('a', 3), CONV('b', 4), CONV('c', 6)];
        assert.equal(tabBadgeCount('close-friends', convs, [{ id: 'close-friends', chatIds: ['a', 'c'] }]), 9);
    });

    it('a NaN or missing unread_count never renders NaN on a badge', () => {
        const convs = [CONV('a', undefined), CONV('b', null), CONV('c', Number.NaN), CONV('d', 1)];
        const n = tabBadgeCount('unread', convs);
        assert.ok(Number.isFinite(n), 'must be a finite number');
        assert.equal(n, 1);
    });
});

describe('SparkleHub unread total resolves per chat, not across totals', () => {
    it('reports the server total when the live map has nothing', () => {
        assert.equal(hubUnreadTotal([CONV('a', 5), CONV('b', 3)], {}), 8);
    });

    it('prefers the live counter where it is ahead of the snapshot', () => {
        // A message arrived over the socket after the last inbox load.
        assert.equal(hubUnreadTotal([CONV('a', 2)], { a: 3 }), 3);
    });

    it('keeps the larger figure per chat — the old max-of-sums over-reported', () => {
        // live flags 3 chats (1 each), the server snapshot still says 20.
        // Old: max(3, 20) = 20. Correct: max(1,20) + max(1,0) + max(1,0) = 22.
        const convs = [CONV('a', 20), CONV('b', 0), CONV('c', 0)];
        assert.equal(hubUnreadTotal(convs, { a: 1, b: 1, c: 1 }), 22);
    });

    it('a cleared chat drops to zero rather than keeping the stale server number', () => {
        // clearUnreadCount zeroes BOTH the live map and the conversation row, so
        // neither path can resurrect the old total.
        assert.equal(hubUnreadTotal([CONV('a', 0)], { a: 0 }), 0);
    });

    it('counts a chat the store knows about before the inbox snapshot loads', () => {
        assert.equal(hubUnreadTotal([], { 'new-chat': 2 }), 2);
    });

    it('an empty inbox with no counts is zero', () => {
        assert.equal(hubUnreadTotal([], {}), 0);
        assert.equal(hubUnreadTotal(undefined, undefined), 0);
    });
});

describe('the source keeps the rule, not just the mirror', () => {
    it('Messages.tsx returns 0 for the All tab', () => {
        const src = read('frontend/src/pages/Messages.tsx');
        // The rule must be in the component, not only in this test's mirror.
        assert.match(
            src,
            /if \(tabId === 'all'\) return 0;/,
            'All must return 0 so the badge renders nothing'
        );
    });

    it('SparkleHub no longer takes the max of two independently-summed totals', () => {
        const src = read('frontend/src/components/SparkleHub.tsx');
        assert.doesNotMatch(
            src,
            /Math\.max\(fromCounts,\s*fromConvs\)/,
            'max-of-sums is not sum-of-maxes; resolve per chat instead'
        );
        assert.match(src, /Math\.max\(live, server\)/, 'per-chat resolution is present');
    });
});
