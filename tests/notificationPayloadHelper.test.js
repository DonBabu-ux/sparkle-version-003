// tests/notificationPayloadHelper.test.js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    deriveMessagePreview,
    resolveAvatarUrl,
    deriveMediaThumbnail,
    buildMessageNotificationPayload,
    DEFAULT_AVATAR_URL
} = require('../backend/utils/notificationPayloadHelper');

describe('NotificationPayloadHelper — Phase 2: Single Message Type-Aware Previews', () => {
    it('generates safe text preview with length cap', () => {
        const shortText = deriveMessagePreview({ type: 'text', content: 'Hey, are you free?' });
        assert.equal(shortText, 'Hey, are you free?');

        const longText = 'A'.repeat(200);
        const capped = deriveMessagePreview({ type: 'text', content: longText });
        assert.ok(capped.length <= 120);
        assert.ok(capped.endsWith('…'));
    });

    it('generates context-aware preview for images', () => {
        const preview = deriveMessagePreview({ type: 'image' });
        assert.equal(preview, '📷 Sent you a photo');
    });

    it('generates context-aware preview for videos', () => {
        const preview = deriveMessagePreview({ type: 'video' });
        assert.equal(preview, '🎥 Sent you a video');
    });

    it('generates context-aware preview for reels/moments', () => {
        const preview = deriveMessagePreview({ type: 'reel' });
        assert.equal(preview, '✨ Shared a reel');
    });

    it('generates context-aware preview for voice notes', () => {
        const preview = deriveMessagePreview({ type: 'voice' });
        assert.equal(preview, '🎙️ Sent a voice message');
    });

    it('generates context-aware preview for stickers', () => {
        const preview = deriveMessagePreview({ type: 'sticker' });
        assert.equal(preview, 'Sent a sticker');
    });

    it('generates context-aware preview for documents with attachment metadata', () => {
        const preview = deriveMessagePreview({
            type: 'file',
            metadata: JSON.stringify({ attachment: { name: 'Report_2026.pdf' } })
        });
        assert.equal(preview, '📎 Shared a file: Report_2026.pdf');
    });

    it('respects hidePreview privacy setting — never reveals content or type details', () => {
        const preview = deriveMessagePreview({
            type: 'image',
            content: 'Secret picture',
            hidePreview: true
        });
        assert.equal(preview, 'New message');
    });

    it('handles empty content and unknown types gracefully without throwing', () => {
        assert.doesNotThrow(() => {
            const p1 = deriveMessagePreview({ type: 'unknown_type' });
            assert.equal(p1, 'Sent a message');
            const p2 = deriveMessagePreview({ type: null, content: null });
            assert.equal(p2, 'Sent a message');
        });
    });
});

describe('NotificationPayloadHelper — Phase 5: Avatar & Media Thumbnail Resolution', () => {
    it('resolves remote avatar URLs untouched', () => {
        const url = 'https://res.cloudinary.com/avatar123.jpg';
        assert.equal(resolveAvatarUrl(url), url);
    });

    it('resolves relative avatar paths to absolute backend URL', () => {
        const rel = '/uploads/avatars/user_1.png';
        const abs = resolveAvatarUrl(rel);
        assert.equal(abs, 'https://sparkle-version-003.onrender.com/uploads/avatars/user_1.png');
    });

    it('falls back to default avatar for missing or invalid inputs', () => {
        assert.equal(resolveAvatarUrl(null), DEFAULT_AVATAR_URL);
        assert.equal(resolveAvatarUrl(''), DEFAULT_AVATAR_URL);
    });

    it('extracts thumbnail only for image types, not videos or text', () => {
        const imgThumb = deriveMediaThumbnail('image', 'https://res.cloudinary.com/photo.jpg');
        assert.equal(imgThumb, 'https://res.cloudinary.com/photo.jpg');

        const videoThumb = deriveMediaThumbnail('video', 'https://res.cloudinary.com/video.mp4');
        assert.equal(videoThumb, null);

        const textThumb = deriveMediaThumbnail('text', null);
        assert.equal(textThumb, null);
    });
});

describe('NotificationPayloadHelper — Phase 3 & 4: Payload Construction & Aggregation', () => {
    const sender = {
        user_id: 'usr_123',
        name: 'Sarah Connor',
        username: 'sarah_c',
        avatar_url: 'https://cdn.sparkle.app/sarah.jpg'
    };

    const message = {
        message_id: 'msg_999',
        chat_id: 'chat_abc',
        content: 'See you at 5pm!',
        type: 'text',
        sent_at: '2026-10-17T12:00:00Z',
        server_sequence: 42
    };

    it('builds single message payload with sender name in title and preview in body', () => {
        const payload = buildMessageNotificationPayload({
            sender,
            message,
            unreadCountInChat: 1
        });

        assert.equal(payload.title, 'Sarah Connor');
        assert.equal(payload.body, 'See you at 5pm!');
        assert.equal(payload.data.chatId, 'chat_abc');
        assert.equal(payload.data.messageId, 'msg_999');
        assert.equal(payload.data.senderId, 'usr_123');
        assert.equal(payload.data.senderName, 'Sarah Connor');
        assert.equal(payload.data.senderAvatar, 'https://cdn.sparkle.app/sarah.jpg');
        assert.equal(payload.data.url, '/messages?chat=chat_abc');
    });

    it('prefixes unread count when multiple unread messages exist in the same conversation', () => {
        const payload = buildMessageNotificationPayload({
            sender,
            message,
            unreadCountInChat: 4
        });

        assert.equal(payload.title, 'Sarah Connor');
        assert.equal(payload.body, '(4) See you at 5pm!');
        assert.equal(payload.data.unreadInChat, '4');
    });

    it('masks preview when hidePreview is enabled', () => {
        const payload = buildMessageNotificationPayload({
            sender,
            message,
            unreadCountInChat: 3,
            hidePreview: true
        });

        assert.equal(payload.title, 'Sarah Connor');
        assert.equal(payload.body, 'New message');
        assert.equal(payload.data.preview, 'New message');
    });
});
