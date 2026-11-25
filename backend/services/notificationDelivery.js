const pool = require('../config/database');
const logger = require('../utils/logger');

/**
 * Shared notification delivery for a single user: bell row + FCM push.
 *
 * Extracted from the BullMQ worker so the SAME logic serves both paths:
 *  - the `notifications` queue worker (normal path)
 *  - NotificationService.send() when Redis/BullMQ is unavailable
 *    (degraded direct path — previously events were silently dropped)
 */

// FCM data messages are capped ~4KB. Caller data is small (ids + a URL), but
// guard anyway so a bloated payload can never fail the whole send.
const MAX_FCM_DATA_BYTES = 3000;

/** Rebuilds the same tray tag fcm.js computes, so we can scope it per token. */
const stringifiedEventTag = (d) => {
    if (d.tag) return String(d.tag);
    if (d.chatId) return `chat_${String(d.chatId)}`;
    if (d.eventId) return String(d.eventId);
    return null;
};

const shortHash = (s) =>
    require('crypto').createHash('sha256').update(String(s)).digest('hex').slice(0, 8);

async function deliverNotificationToUser(userId, { type, priority, data, eventId }) {
    // Required lazily: notification.service requires THIS module for its
    // degraded path, so a top-level require would be a cycle.
    const NotificationService = require('./notification.service');

    const shouldSend = await NotificationService.canSendToUser(userId, eventId, type);
    if (!shouldSend) return { skipped: true };

    await pool.query(
        'INSERT INTO notifications (notification_id, user_id, type, title, content, action_url) VALUES (?, ?, ?, ?, ?, ?)',
        [require('crypto').randomUUID(), userId, type, data.title, data.content, data.url || null]
    );

    await pushToUserDevices(userId, type, data, eventId);
    return { skipped: false };
}

async function pushToUserDevices(userId, type, data, eventId) {
    try {
        const [tokens] = await pool.query('SELECT token FROM fcm_tokens WHERE user_id = ?', [userId]);
        if (!tokens.length) return;

        const { sendFcmNotification } = require('../utils/fcm');

        // F1: forward the caller's full event payload, not just
        // { type, url, eventId }. Sticking to three fields meant the client
        // could not deep-link (chatId/postId/userId missing) and the tray
        // always showed the Sparkle logo (senderAvatar missing). Only
        // title/content are dropped — the FCM `notification` block already
        // carries them.
        const fcmData = {};
        if (data && typeof data === 'object') {
            for (const key of Object.keys(data)) {
                if (key === 'title' || key === 'content') continue;
                fcmData[key] = data[key];
            }
        }
        // type drives the Android channel; eventId is the tray `tag` that
        // collapses retries/duplicates into one card.
        fcmData.type = type;
        if (eventId) fcmData.eventId = eventId;

        if (JSON.stringify(fcmData).length > MAX_FCM_DATA_BYTES) {
            logger.warn(`FCM: oversized data payload for user ${userId} (${type}) — sending core fields only`);
            const callFields = {};
            for (const key of ['callId', 'callerId', 'callerName', 'callMode', 'callType']) {
                if (data && data[key] !== undefined) callFields[key] = data[key];
            }
            await sendFcmNotification(tokens.map(t => t.token), data.title, data.content, {
                type,
                ...(data.url ? { url: data.url } : {}),
                ...(eventId ? { eventId } : {}),
                ...callFields,
            });
            return;
        }

        // F7: send per-token with a token-scoped tag. One multicast carries a
        // single `tag`, so a second device joining the same event REPLACED the
        // first device's card instead of both showing. A short hash of the
        // token keeps the tag stable for that device (retries still collapse)
        // while letting each device keep its own card.
        const tag = stringifiedEventTag(fcmData);
        // Per-token try/catch: one dead token (or a single failed request) must not
        // abort the pushes to the user's REMAINING devices.
        const failedTokens = [];
        for (const t of tokens) {
            const perToken = { ...fcmData };
            if (tag) perToken.tag = `${tag}_${shortHash(t.token)}`;
            try {
                await sendFcmNotification([t.token], data.title, data.content, perToken);
            } catch (sendErr) {
                failedTokens.push(t.token);
                logger.warn(`FCM: send failed for one device of user ${userId}:`, sendErr.message);
            }
        }
        if (failedTokens.length === tokens.length && tokens.length > 0) {
            // Every device failed — surface it so the caller sees a real error.
            throw new Error(`FCM delivery failed for all ${tokens.length} device(s)`);
        }
    } catch (err) {
        logger.error(`FCM: Delivery failed for user ${userId}:`, err.message);
    }
}

module.exports = { deliverNotificationToUser, pushToUserDevices, MAX_FCM_DATA_BYTES };
