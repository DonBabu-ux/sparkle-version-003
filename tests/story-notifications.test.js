// tests/story-notifications.test.js
// Story notification close-out cover:
//   - addStoryComment now notifies the story author via
//     notificationController.createNotification (type 'story_reply', same
//     payload shape as likeStory's 'story_like' / shareStory's
//     'story_share') and stays silent when the commenter IS the author.
//   - createNotification preference gates: an author with the story-reply
//     preference OFF receives no notification (the comment itself lands).
//   - story_like / story_share / story_reply route to the 'stories'
//     channel on both the backend and the client maps, and the dead
//     story_view consumer mappings are gone.
// Uses the fake-pool pattern from tests/story-audience-privacy.test.js —
// no real database required.
const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-route-only';

// Stub the socket module before feed.controller (→ notification.controller)
// is loaded: getEmitter() resolves from require.cache, so no socket.io /
// bullmq tree is initialised for these tests.
const socketPath = require.resolve('../backend/socket');
require.cache[socketPath] = {
    id: socketPath,
    filename: socketPath,
    loaded: true,
    children: [],
    paths: [],
    exports: { emitNotification: () => {} },
};

const pool = require('../backend/config/database');
const feed = require('../backend/controllers/feed.controller');

const AUTHOR = 'author-1';
const VIEWER = 'viewer-1';
// Inside the 24h window so storyInteractionError never 404s the row.
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

const storyRow = () => ({
    user_id: AUTHOR,
    created_at: FRESH,
    comments_enabled: 1,
    allow_message_sharing: 1,
    reply_privacy: 'everyone',
});

const prefsRow = (storyReplies = 1) => ({
    dnd_enabled: 0,
    dnd_start_time: '22:00:00',
    dnd_end_time: '07:00:00',
    push_notifications_enabled: 1,
    notifications_likes: 1,
    notifications_comments: 1,
    notifications_follows: 1,
    notifications_messages: 1,
    notifications_story_likes: 1,
    notifications_story_shares: 1,
    notifications_story_replies: storyReplies,
});

// Routes every statement addStoryComment + createNotification can issue.
const routerWith = (opts = {}) => installFakePool((text) => {
    if (text.startsWith('SELECT user_id, created_at, comments_enabled, allow_message_sharing, reply_privacy FROM stories')) {
        return [[opts.story || storyRow()]];
    }
    if (text.includes('SELECT 1 FROM story_privacy_blocks')) return [[]];
    if (text.startsWith('SELECT name FROM users')) return [[{ name: 'Commenter' }]];
    if (text.includes('dnd_enabled') && text.includes('FROM users')) return [[opts.prefs || prefsRow()]];
    if (text.startsWith('SELECT name as actor_name')) {
        return [[{ actor_name: 'Commenter', actor_username: 'commenter', actor_avatar: '' }]];
    }
    if (text.startsWith('SELECT push_notifications_enabled FROM users')) return [[{ push_notifications_enabled: 1 }]];
    if (text.startsWith('INSERT INTO story_comments')) return [{}];
    if (text.startsWith('INSERT INTO notifications')) return [{}];
    return [[]];
});

describe('feed.addStoryComment — author notification', () => {
    let fake;
    afterEach(() => { fake?.restore(); fake = null; });

    const comment = async (viewerId) => {
        const res = mockRes();
        await feed.addStoryComment(
            { params: { id: 'story-1' }, user: { userId: viewerId }, body: { text: 'love this!' } },
            res
        );
        return res;
    };

    it('notifies the story author with the story_reply payload shape', async () => {
        fake = routerWith();
        const res = await comment(VIEWER);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);

        const notif = fake.calls.find(c => c.sql.startsWith('INSERT INTO notifications'));
        assert.ok(notif, 'notifications INSERT executed');
        // createNotification column order: notification_id, user_id, type,
        // title, content, related_id, related_type, actor_id, action_url
        assert.equal(notif.params[1], AUTHOR, 'recipient is the story author');
        assert.equal(notif.params[2], 'story_reply', 'type is story_reply');
        assert.equal(notif.params[7], VIEWER, 'actor is the commenter');
        assert.equal(notif.params[8], `/stories/${AUTHOR}`, 'same action_url as story_like/story_share');
        const placeholders = (notif.sql.match(/\?/g) || []).length;
        assert.equal(notif.params.length, placeholders, 'params align with placeholders');

        const commentInsert = fake.calls.find(c => c.sql.startsWith('INSERT INTO story_comments'));
        assert.ok(commentInsert, 'the comment itself is still written');
    });

    it('does NOT notify when the commenter IS the author', async () => {
        fake = routerWith();
        const res = await comment(AUTHOR);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.equal(
            fake.calls.some(c => c.sql.startsWith('INSERT INTO notifications')),
            false,
            'no notification row for a self-reply'
        );
        // Self-notification is refused before any users lookup happens.
        assert.equal(fake.calls.some(c => c.sql.startsWith('SELECT name FROM users')), false);
    });

    it('drops the notification when the author turned story replies off', async () => {
        fake = routerWith({ prefs: prefsRow(0) });
        const res = await comment(VIEWER);
        // The comment still lands — only the bell notification is gated.
        assert.equal(res.statusCode, 200);
        assert.ok(res.body.comment_id, 'comment persisted');
        assert.ok(
            fake.calls.some(c => c.sql.startsWith('INSERT INTO story_comments')),
            'comment INSERT ran'
        );
        assert.equal(
            fake.calls.some(c => c.sql.startsWith('INSERT INTO notifications')),
            false,
            'preference gate suppressed the story_reply notification'
        );
    });
});

describe('story notification channels + type coverage', () => {
    const src = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

    it('maps story_like/story_share/story_reply to the stories channel (backend)', () => {
        const fcm = src('backend/utils/fcm.js');
        assert.match(fcm, /story_like: 'stories'/);
        assert.match(fcm, /story_share: 'stories'/);
        assert.match(fcm, /story_reply: 'stories'/);
        // Dead consumer: the server never emits story_view.
        assert.ok(!/story_view/.test(fcm), 'fcm.js no longer maps story_view');
    });

    it('maps story_like/story_share/story_reply to the stories channel (client)', () => {
        const channels = src('frontend/src/services/notificationChannels.ts');
        assert.match(channels, /story_like: 'stories'/);
        assert.match(channels, /story_share: 'stories'/);
        assert.match(channels, /story_reply: 'stories'/);
        assert.ok(!/story_view/.test(channels), 'notificationChannels.ts no longer maps story_view');
    });

    it('routes story push deep links without the dead story_view type', () => {
        const push = src('frontend/src/services/PushService.ts');
        assert.match(push, /type === 'story_reply'/);
        assert.ok(!/story_view/.test(push), 'PushService.ts no longer references story_view');
    });

    it('gates story preferences in createNotification', () => {
        const controller = src('backend/controllers/notification.controller.js');
        assert.match(controller, /notifications_story_likes/);
        assert.match(controller, /notifications_story_shares/);
        assert.match(controller, /notifications_story_replies/);
        assert.match(controller, /data\.type === 'story_like'/);
        assert.match(controller, /data\.type === 'story_share'/);
        assert.match(controller, /data\.type === 'story_reply'/);
    });
});
