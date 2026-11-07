const admin = require('../config/firebase-admin');
const logger = require('./logger');

// Android notification channel per notification type — mirrors the client map
// in frontend/src/services/notificationChannels.ts. Channel decides sound +
// importance on the device; `system` is also the manifest default channel.
const ANDROID_CHANNEL_BY_TYPE = {
    message: 'messages',
    new_message: 'messages',
    chat: 'messages',
    group_message: 'messages',
    marketplace_contact: 'marketplace',
    listing: 'marketplace',
    offer: 'marketplace',
    order: 'marketplace',
    sale: 'marketplace',
    wishlist: 'marketplace',
    story: 'stories',
    story_like: 'stories',
    story_share: 'stories',
    story_reply: 'stories',
    story_reaction: 'stories',
    moment: 'moments',
    like: 'moments',
    spark: 'moments',
    spark_post: 'moments',
    follow: 'social',
    follower: 'social',
    comment: 'social',
    reply: 'social',
    mention: 'social',
    confession: 'social',
    group: 'social',
    group_invite: 'social',
    request: 'social',
    tag: 'social',
    call: 'calls',
    incoming_call: 'calls',
    sparkle_ai: 'sparkle_ai',
    ai: 'sparkle_ai',
    assistant: 'sparkle_ai',
    system: 'system',
    announcement: 'system',
    security: 'system',
    reminder: 'system',
};

// ── Tray styling (shared by every push) ──
// Small icon: drawable/ic_notification.xml — white silhouette; the platform
// tints it with NOTIFICATION_COLOR on the material circle.
// Large icon: the Sparkle mark, shown at the right of the expanded
// notification (this is the "app icon in the notification").
const NOTIFICATION_ICON = 'ic_notification';
const NOTIFICATION_COLOR = '#FF1493';
const BRAND_IMAGE_URL = 'https://sparkleweb.app.vercel.app/logo.png';

// FCM error codes that mean "this token is finished" rather than "try again".
// They are the only ones worth deleting: an expired token, a token registered
// against a project the server no longer sends as, or a malformed value will
// never succeed, and leaving it in the table means every future multicast pays
// for it. Transient codes (UNAVAILABLE, INTERNAL, quota) must NOT be deleted -
// dropping those loses a working token over a momentary failure.
const DEAD_TOKEN_CODES = new Set([
    'messaging/invalid-registration-token',
    'messaging/registration-token-not-registered',
    'messaging/invalid-argument',
]);

const isDeadTokenError = (err) => {
    const code = err && (err.code || err.errorInfo && err.errorInfo.code);
    if (typeof code === 'string' && DEAD_TOKEN_CODES.has(code)) return true;
    // Some v1 responses nest the machine-readable code on errorInfo.
    const nested = err && err.errorInfo && err.errorInfo.code;
    return typeof nested === 'string' && DEAD_TOKEN_CODES.has(nested);
};

// Best-effort purge of dead tokens. A failure here must never stop a
// notification that otherwise delivered, so it is isolated and logged.
const deleteDeadTokens = async (tokens) => {
    if (!tokens || tokens.length === 0) return 0;
    try {
        const pool = require('../config/database');
        let removed = 0;
        for (const token of tokens) {
            const [res] = await pool.query('DELETE FROM fcm_tokens WHERE token = ?', [token]);
            removed += res && typeof res.affectedRows === 'number' ? res.affectedRows : 0;
        }
        if (removed > 0) {
            logger.info(`FCM V1: removed ${removed} dead token(s) from fcm_tokens`);
        }
        return removed;
    } catch (e) {
        logger.warn(`FCM V1: could not purge dead tokens: ${e.message}`);
        return 0;
    }
};

const sendFcmNotification = async (tokens, title, body, data = {}) => {
    if (!admin) {
        logger.warn('FCM: Cannot send notification. Firebase Admin not initialized (Missing serviceAccountKey.json).');
        return;
    }

    if (!tokens || tokens.length === 0) return;

    // Ensure all data payload values are strings (FCM V1 requirement)
    const stringifiedData = {};
    for (const key in data) {
        stringifiedData[key] = String(data[key]);
    }

    const resolvedImage = stringifiedData.senderAvatar ? String(stringifiedData.senderAvatar) : (stringifiedData.image ? String(stringifiedData.image) : BRAND_IMAGE_URL);

    const message = {
        notification: {
            title: title,
            body: body,
            image: resolvedImage
        },
        data: stringifiedData,
        android: {
            priority: 'high',
            notification: {
                channel_id: ANDROID_CHANNEL_BY_TYPE[stringifiedData.type] || 'system',
                icon: NOTIFICATION_ICON,
                color: NOTIFICATION_COLOR,
                image: resolvedImage,
                // Hide message content on the lock screen (Android default
                // for FCM is "public"; keep previews private).
                visibility: 'private',
                // Tag notifications per-chat or event so consecutive messages from the same
                // conversation update the existing tray card instead of creating duplicate cards.
                tag: stringifiedData.tag || (stringifiedData.chatId ? `chat_${stringifiedData.chatId}` : (stringifiedData.eventId ? String(stringifiedData.eventId) : undefined))
            }
        },
        tokens: Array.isArray(tokens) ? tokens : [tokens]
    };

    try {
        const response = await admin.messaging().sendEachForMulticast(message);
        logger.info(`FCM V1: Sent multicast. Success: ${response.successCount}, Failure: ${response.failureCount}`);
        
        if (response.failureCount > 0) {
            const dead = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const token = message.tokens[idx];
                    logger.error(`FCM V1 Error for token [${token}]:`, resp.error);
                    // A dead token is a permanent condition, so retire it rather
                    // than re-paying for it on every later multicast.
                    if (isDeadTokenError(resp.error)) dead.push(token);
                }
            });
            await deleteDeadTokens(dead);
        }
        return response;
    } catch (error) {
        logger.error('FCM V1: Error sending notification:', error);
        throw error;
    }
};

module.exports = { sendFcmNotification };
