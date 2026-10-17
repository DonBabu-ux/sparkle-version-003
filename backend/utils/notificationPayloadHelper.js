/**
 * backend/utils/notificationPayloadHelper.js
 * 
 * Context-aware messaging notification builder.
 * Derives safe, type-aware previews, sender identity, avatar, timestamp,
 * and grouping metadata from trusted server-side models.
 */

const { isSafeMediaUrl } = require('./safeUrl');

const MAX_PREVIEW_LENGTH = 120;
const BRAND_LOGO_URL = 'https://sparkleweb.app.vercel.app/sparklelogo.png';
const DEFAULT_AVATAR_URL = 'https://sparkleweb.app.vercel.app/sparklelogo.png';

/**
 * Derives a human-friendly, type-aware preview string for a message.
 * Respects previewPrivacy: if false, returns generic privacy placeholder.
 *
 * @param {Object} params
 * @param {string} params.type - Message type (text, image, video, reel, voice, audio, sticker, file, etc.)
 * @param {string} [params.content] - Message text content
 * @param {Object|string} [params.metadata] - Attachment/metadata object or JSON string
 * @param {boolean} [params.hidePreview=false] - Whether user has hidden message previews
 * @returns {string} Safe preview text
 */
function deriveMessagePreview({ type = 'text', content = '', metadata = null, hidePreview = false }) {
    if (hidePreview) {
        return 'New message';
    }

    const normalizedType = String(type || 'text').trim().toLowerCase();

    switch (normalizedType) {
        case 'text': {
            if (!content || typeof content !== 'string') {
                return 'Sent a message';
            }
            const clean = content.trim().replace(/\s+/g, ' ');
            if (!clean) return 'Sent a message';
            if (clean.length > MAX_PREVIEW_LENGTH) {
                return clean.slice(0, MAX_PREVIEW_LENGTH - 1) + '…';
            }
            return clean;
        }

        case 'image':
        case 'photo':
            return '📷 Sent you a photo';

        case 'video':
            return '🎥 Sent you a video';

        case 'reel':
        case 'moment':
            return '✨ Shared a reel';

        case 'voice':
        case 'audio':
        case 'voice_note':
            return '🎙️ Sent a voice message';

        case 'sticker':
            return 'Sent a sticker';

        case 'gif':
            return 'Sent a GIF';

        case 'location':
            return '📍 Shared a location';

        case 'contact':
            return '👤 Shared a contact';

        case 'story_reply':
            return content ? `Replied to your story: "${content.slice(0, 60)}"` : 'Replied to your story';

        case 'marketplace':
        case 'listing':
        case 'offer':
            return content ? content.slice(0, MAX_PREVIEW_LENGTH) : 'Sent a marketplace inquiry';

        case 'file':
        case 'document': {
            let fileName = '';
            try {
                const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
                fileName = parsed?.attachment?.name || parsed?.name || '';
            } catch (_) { }
            return fileName ? `📎 Shared a file: ${fileName.slice(0, 40)}` : '📎 Shared a file';
        }

        default:
            if (content && typeof content === 'string' && content.trim()) {
                const clean = content.trim().replace(/\s+/g, ' ');
                return clean.length > MAX_PREVIEW_LENGTH ? clean.slice(0, MAX_PREVIEW_LENGTH - 1) + '…' : clean;
            }
            return 'Sent a message';
    }
}

/**
 * Resolves a trusted, absolute sender avatar URL or thumbnail.
 *
 * @param {string} rawAvatar
 * @returns {string} Safe absolute avatar URL
 */
function resolveAvatarUrl(rawAvatar) {
    if (!rawAvatar || typeof rawAvatar !== 'string') {
        return DEFAULT_AVATAR_URL;
    }
    const clean = rawAvatar.trim();
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
        return clean;
    }
    // Relative upload path from backend
    if (clean.startsWith('/uploads') || clean.startsWith('uploads/')) {
        const path = clean.startsWith('/') ? clean : `/${clean}`;
        return `https://sparkle-version-003.onrender.com${path}`;
    }
    return DEFAULT_AVATAR_URL;
}

/**
 * Derives an image thumbnail URL for rich notification payloads (BigPictureStyle).
 * Only returns a URL if the message is an image/photo and has a safe media URL.
 * Never downloads or returns full video files.
 *
 * @param {string} type
 * @param {string} mediaUrl
 * @returns {string|null} Thumbnail URL or null
 */
function deriveMediaThumbnail(type, mediaUrl) {
    if (!type || !mediaUrl) return null;
    const normalizedType = String(type).trim().toLowerCase();
    if (normalizedType !== 'image' && normalizedType !== 'photo') {
        return null;
    }
    if (typeof mediaUrl === 'string' && (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://'))) {
        return mediaUrl;
    }
    return null;
}

/**
 * Builds the complete context-aware notification payload for FCM and LocalNotifications.
 *
 * @param {Object} params
 * @param {Object} params.sender - { user_id, name, username, avatar_url }
 * @param {Object} params.message - { message_id, chat_id, conversation_id, content, type, media_url, metadata, sent_at, server_sequence }
 * @param {number} [params.unreadCountInChat=1] - Authoritative unread count for this chat
 * @param {number} [params.totalUnreadChats=1] - Total chats with unread messages
 * @param {number} [params.totalUnreadMessages=1] - Total unread messages across all chats
 * @param {boolean} [params.hidePreview=false] - Per-user preview setting
 * @returns {Object} { title, body, data, notificationOptions }
 */
function buildMessageNotificationPayload({
    sender,
    message,
    unreadCountInChat = 1,
    totalUnreadChats = 1,
    totalUnreadMessages = 1,
    hidePreview = false
}) {
    const senderName = sender?.name?.trim() || sender?.username?.trim() || 'Someone on Sparkle';
    const senderAvatar = resolveAvatarUrl(sender?.avatar_url);
    const chatId = message?.chat_id || message?.conversation_id || '';
    const messageId = message?.message_id || '';
    const sentAt = message?.sent_at ? new Date(message.sent_at).toISOString() : new Date().toISOString();

    const preview = deriveMessagePreview({
        type: message?.type,
        content: message?.content,
        metadata: message?.metadata,
        hidePreview
    });

    // Title includes sender name
    const title = senderName;

    // Body shows preview, or indicates count if multiple unread from this sender
    let body = preview;
    if (unreadCountInChat > 1 && !hidePreview) {
        body = `(${unreadCountInChat}) ${preview}`;
    }

    const mediaThumbnail = !hidePreview ? deriveMediaThumbnail(message?.type, message?.media_url) : null;

    // Structured data payload for native routing and aggregation
    const data = {
        type: 'message',
        chatId: String(chatId),
        messageId: String(messageId),
        senderId: String(sender?.user_id || ''),
        senderName: String(senderName),
        senderAvatar: String(senderAvatar),
        server_sequence: String(message?.server_sequence || '0'),
        sentAt: String(sentAt),
        unreadInChat: String(unreadCountInChat),
        totalUnreadChats: String(totalUnreadChats),
        totalUnreadMessages: String(totalUnreadMessages),
        preview: String(preview),
        url: `/messages?chat=${encodeURIComponent(chatId)}`
    };

    if (mediaThumbnail) {
        data.image = String(mediaThumbnail);
    }

    return {
        title,
        body,
        data,
        image: mediaThumbnail || senderAvatar || BRAND_LOGO_URL,
        senderAvatar,
        senderName,
        preview,
        unreadCountInChat,
        totalUnreadChats,
        totalUnreadMessages,
        chatId,
        messageId
    };
}

module.exports = {
    deriveMessagePreview,
    resolveAvatarUrl,
    deriveMediaThumbnail,
    buildMessageNotificationPayload,
    MAX_PREVIEW_LENGTH,
    BRAND_LOGO_URL,
    DEFAULT_AVATAR_URL
};
