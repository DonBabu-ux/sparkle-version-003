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

async function deliverNotificationToUser(userId, { type, priority, data, eventId }) {
    // Required lazily: notification.service requires THIS module for its
    // degraded path, so a top-level require would be a cycle.
    const NotificationService = require('./notification.service');

    const shouldSend = await NotificationService.canSendToUser(userId, eventId);
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
            await sendFcmNotification(tokens.map(t => t.token), data.title, data.content, {
                type,
                ...(data.url ? { url: data.url } : {}),
                ...(eventId ? { eventId } : {}),
            });
            return;
        }

        await sendFcmNotification(tokens.map(t => t.token), data.title, data.content, fcmData);
    } catch (err) {
        logger.error(`FCM: Delivery failed for user ${userId}:`, err.message);
    }
}

module.exports = { deliverNotificationToUser, pushToUserDevices, MAX_FCM_DATA_BYTES };
