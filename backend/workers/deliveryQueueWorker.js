const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Exponential backoff intervals (seconds) for undelivered messages.
 * Capped at 15 minutes (900s).
 */
const RETRY_INTERVALS_SEC = [1, 2, 5, 10, 20, 30, 60, 300, 900];

/**
 * How often to poll when there is nothing pending (ms).
 * Increased to avoid hammering the DB when the queue is mostly blocked/empty.
 */
const IDLE_POLL_MS = 5000;

/**
 * How often to poll when items were found on the last cycle (ms).
 * Keep this fast so real messages get retried quickly.
 */
const ACTIVE_POLL_MS = 2000;

/**
 * Successful-push dedupe: `${messageId}:${token}` -> timestamp.
 * One message must produce AT MOST one FCM push per unique device token,
 * regardless of how many stale user_sessions rows share that token
 * (notification-bomb fix).
 */
const PUSH_SUCCESS_TTL_MS = 10 * 60 * 1000;
const recentlyPushedSuccess = new Map();

const _prunePushSuccessMap = (nowMs) => {
    if (recentlyPushedSuccess.size < 10000) return;
    for (const [key, ts] of recentlyPushedSuccess) {
        if (nowMs - ts > PUSH_SUCCESS_TTL_MS) recentlyPushedSuccess.delete(key);
    }
};

class DeliveryQueueWorker {
    /**
     * Enqueue a message for guaranteed delivery to a specific recipient session.
     */
    static async enqueue({ messageId, recipientId, sessionId }) {
        const queueId = `${messageId}:${sessionId}`;
        await db.query(`
            INSERT IGNORE INTO delivery_queue
                (queue_id, message_id, recipient_id, session_id, attempts, next_retry_at, created_at)
            VALUES (?, ?, ?, ?, 0, NOW(), NOW())
        `, [queueId, messageId, recipientId, sessionId]);
    }

    /**
     * Process one cycle of the delivery queue.
     * Returns true if items were found (use shorter next-poll delay), false otherwise.
     */
    static async processQueue(io) {
        try {
            // Per-cycle push dedupe: a message is pushed at most once per unique
            // device token within one processing cycle.
            const cycleAttemptedPush = new Set();
            // ── 1. Fetch pending items ────────────────────────────────────────────
            // We do NOT use FOR UPDATE / SKIP LOCKED because mysql2 doesn't make it
            // easy to hold the transaction open across async calls.  Instead we
            // prevent overlapping runs via the self-scheduling loop below.
            // Orphan cleanup is a full LEFT JOIN scan — run it at most once a minute
            // instead of every 2-5s poll cycle (it was the top slow query).
            const now = Date.now();
            if (!this._lastOrphanCleanupAt || now - this._lastOrphanCleanupAt > 60000) {
                this._lastOrphanCleanupAt = now;
                // Batched anti-join (NOT EXISTS) with LIMIT — avoids the unbounded
                // multi-table LEFT JOIN DELETE that dominated slow-query logs.
                await db.query(`
                    DELETE FROM delivery_queue
                    WHERE message_id IS NOT NULL
                      AND NOT EXISTS (
                        SELECT 1 FROM messages m WHERE m.message_id = delivery_queue.message_id
                      )
                    LIMIT 1000
                `);
            }
            const [pendingItems] = await db.query(`
                SELECT dq.queue_id, dq.message_id, dq.recipient_id, dq.session_id, dq.attempts,
                       m.chat_id, m.conversation_id, m.content, m.type, m.media_url, m.metadata, m.sender_id,
                       m.sent_at, m.server_sequence,
                       u.name as sender_name, u.username as sender_username, u.avatar_url as sender_avatar
                FROM delivery_queue dq
                JOIN messages m ON dq.message_id = m.message_id
                JOIN users u ON m.sender_id = u.user_id
                WHERE dq.next_retry_at <= NOW()
                ORDER BY dq.next_retry_at
                LIMIT 50
            `);

            if (pendingItems.length === 0) return false;

            // ── 2. Batch-identify and purge ALL blocked items in one query ────────
            //    This replaces the previous per-item SELECT + DELETE loop that issued
            //    2 × N queries and spammed logs at info level.
            const queueIds = pendingItems.map(i => i.queue_id);
            const [blockedRows] = await db.query(`
                SELECT dq.queue_id
                FROM delivery_queue dq
                JOIN messages m ON dq.message_id = m.message_id
                JOIN user_blocks ub
                    ON (ub.blocker_id = m.sender_id AND ub.blocked_id = dq.recipient_id)
                    OR (ub.blocker_id = dq.recipient_id AND ub.blocked_id = m.sender_id)
                WHERE dq.queue_id IN (?)
            `, [queueIds]);

            if (blockedRows.length > 0) {
                const blockedIds = blockedRows.map(r => r.queue_id);
                // Single DELETE for all blocked items
                await db.query(
                    'DELETE FROM delivery_queue WHERE queue_id IN (?)',
                    [blockedIds]
                );
                logger.warn(
                    `⛔ [DeliveryQueueWorker] Purged ${blockedIds.length} blocked queue item(s) in one pass.`
                );
            }

            // Purge items where max attempts reached (attempts >= 9) or message expired
            await db.query(`
                DELETE dq FROM delivery_queue dq
                JOIN messages m ON dq.message_id = m.message_id
                WHERE dq.attempts >= 9 OR (m.expires_at IS NOT NULL AND m.expires_at <= NOW())
            `);

            // Only process items that are not blocked
            const blockedSet = new Set(blockedRows.map(r => r.queue_id));
            const activeItems = pendingItems.filter(i => !blockedSet.has(i.queue_id));

            // ── 3. Deliver active items ───────────────────────────────────────────
            for (const item of activeItems) {
                // 3a. Atomic claim — exactly ONE worker process may deliver this
                //     row. Guards against overlapping processes (Render deploy
                //     overlap, local+prod both running) double-pushing.
                try {
                    const [claim] = await db.query(`
                        UPDATE delivery_queue
                        SET next_retry_at = DATE_ADD(NOW(), INTERVAL 3600 SECOND)
                        WHERE queue_id = ? AND next_retry_at <= NOW()
                    `, [item.queue_id]);
                    if (claim.affectedRows === 0) continue; // claimed elsewhere
                } catch (claimErr) {
                    logger.warn(`[DeliveryQueueWorker] Claim failed for ${item.queue_id}: ${claimErr.message}`);
                    continue;
                }

                let deliveredViaSocket = false;

                // 3b. Socket delivery (fastest path — zero latency). The queue
                //     row is per-recipient, so resolve the recipient's live
                //     sessions at delivery time. Room broadcast already fans
                //     out to other connected devices, so one live socket is
                //     enough.
                if (io) {
                    try {
                        const [sessions] = await db.query(`
                            SELECT session_id, socket_id, is_online
                            FROM user_sessions
                            WHERE user_id = ? AND socket_id IS NOT NULL
                            ORDER BY last_active_at DESC
                            LIMIT 10
                        `, [item.recipient_id]);
                        for (const sess of sessions) {
                            const recipientSocket = io.sockets.sockets.get(sess.socket_id);
                            if (recipientSocket && recipientSocket.connected) {
                                recipientSocket.emit('new-message', {
                                    id: item.message_id,
                                    message_id: item.message_id,
                                    chatId: item.chat_id || item.conversation_id,
                                    chat_id: item.chat_id || item.conversation_id,
                                    sender_id: item.sender_id,
                                    content: item.content,
                                    type: item.type,
                                    sent_at: item.sent_at,
                                    server_sequence: item.server_sequence,
                                    delivery_required_ack: true,
                                    sessionId: sess.session_id
                                });
                                deliveredViaSocket = true;
                                break;
                            }
                            // Self-heal zombie "online" rows whose socket is gone
                            // (force-killed apps never send a disconnect).
                            if (sess.is_online === 1) {
                                db.query(
                                    'UPDATE user_sessions SET is_online = 0, socket_id = NULL WHERE session_id = ?',
                                    [sess.session_id]
                                ).catch(() => {});
                            }
                        }
                    } catch (sessErr) {
                        logger.warn(`[DeliveryQueueWorker] Session lookup failed for ${item.recipient_id}: ${sessErr.message}`);
                    }
                }

                if (deliveredViaSocket) {
                    // Reached a live socket — done. Room broadcast covers any
                    // other connected devices; push must not fire.
                    await db.query('DELETE FROM delivery_queue WHERE queue_id = ?', [item.queue_id]);
                    continue;
                }

                // 3c. Push fallback — exactly one token, at most one FCM send.
                try {
                    let pushToken = null;
                    const [sessTok] = await db.query(`
                        SELECT push_token FROM user_sessions
                        WHERE user_id = ? AND push_token IS NOT NULL
                        ORDER BY last_active_at DESC
                        LIMIT 1
                    `, [item.recipient_id]);
                    pushToken = sessTok[0]?.push_token || null;
                    if (!pushToken) {
                        const [fcmRows] = await db.query(
                            'SELECT token FROM fcm_tokens WHERE user_id = ? ORDER BY last_used_at DESC LIMIT 1',
                            [item.recipient_id]
                        );
                        pushToken = fcmRows[0]?.token || null;
                    }
                    if (pushToken) {
                        const pushKey = `${item.message_id}:${pushToken}`;
                        const nowMs = Date.now();
                        // Same-process safety net on top of the DB claim.
                        if (cycleAttemptedPush.has(pushKey) || recentlyPushedSuccess.has(pushKey)) {
                            await db.query('DELETE FROM delivery_queue WHERE queue_id = ?', [item.queue_id]);
                            continue;
                        }
                        cycleAttemptedPush.add(pushKey);
                        const notificationService = require('../services/notification.service');
                        const { buildMessageNotificationPayload } = require('../utils/notificationPayloadHelper');

                        // Query recipient's notification & preview preferences
                        let hidePreview = false;
                        try {
                            const [prefRows] = await db.query(
                                'SELECT push_notifications, auto_suppress_notifications FROM users WHERE user_id = ? LIMIT 1',
                                [item.recipient_id]
                            );
                            if (prefRows && prefRows[0]) {
                                if (prefRows[0].push_notifications === 0 || prefRows[0].push_notifications === false) {
                                    // User has explicitly turned off push notifications
                                    await db.query('DELETE FROM delivery_queue WHERE queue_id = ?', [item.queue_id]);
                                    continue;
                                }
                                if (prefRows[0].auto_suppress_notifications === 1) {
                                    hidePreview = true;
                                }
                            }
                        } catch (_) { }

                        // Query unread count for this specific chat and total chats
                        let unreadCountInChat = 1;
                        let totalUnreadChats = 1;
                        let totalUnreadMessages = 1;
                        const activeChatId = item.chat_id || item.conversation_id;
                        try {
                            const [unreadInChatRows] = await db.query(`
                                SELECT COUNT(*) as unread_count
                                FROM messages
                                WHERE (conversation_id = ? OR chat_id = ? OR personal_chat_id = ?)
                                  AND recipient_id = ? AND is_read = 0
                            `, [activeChatId, activeChatId, activeChatId, item.recipient_id]);
                            unreadCountInChat = unreadInChatRows[0]?.unread_count || 1;

                            const [totalUnreadRows] = await db.query(`
                                SELECT COUNT(DISTINCT COALESCE(conversation_id, chat_id, personal_chat_id)) as chat_count,
                                       COUNT(*) as total_count
                                FROM messages
                                WHERE recipient_id = ? AND is_read = 0
                            `, [item.recipient_id]);
                            totalUnreadChats = totalUnreadRows[0]?.chat_count || 1;
                            totalUnreadMessages = totalUnreadRows[0]?.total_count || unreadCountInChat;
                        } catch (_) { }

                        const payload = buildMessageNotificationPayload({
                            sender: {
                                user_id: item.sender_id,
                                name: item.sender_name,
                                username: item.sender_username,
                                avatar_url: item.sender_avatar
                            },
                            message: {
                                message_id: item.message_id,
                                chat_id: activeChatId,
                                conversation_id: item.conversation_id,
                                content: item.content,
                                type: item.type,
                                media_url: item.media_url,
                                metadata: item.metadata,
                                sent_at: item.sent_at,
                                server_sequence: item.server_sequence
                            },
                            unreadCountInChat,
                            totalUnreadChats,
                            totalUnreadMessages,
                            hidePreview
                        });

                        await notificationService.sendPush({
                            token: pushToken,
                            title: payload.title,
                            body: payload.body,
                            data: payload.data
                        });
                        // Push is fire-and-forget: a successful send must REMOVE
                        // the queue row — never retry an already-delivered push.
                        _prunePushSuccessMap(nowMs);
                        recentlyPushedSuccess.set(pushKey, nowMs);
                        await db.query('DELETE FROM delivery_queue WHERE queue_id = ?', [item.queue_id]);
                        continue;
                    }
                } catch (pushErr) {
                    logger.warn(`[DeliveryQueueWorker] Push fallback failed for recipient ${item.recipient_id}: ${pushErr.message}`);
                    // Transient failure — release the claim so 3d retries soon.
                    try {
                        await db.query('UPDATE delivery_queue SET next_retry_at = NOW() WHERE queue_id = ?', [item.queue_id]);
                    } catch (_) { /* fall through to retry scheduling */ }
                }

                // 3d. Advance retry counter with exponential back-off
                const nextAttempt = item.attempts + 1;
                const delaySec = RETRY_INTERVALS_SEC[Math.min(nextAttempt, RETRY_INTERVALS_SEC.length - 1)];
                await db.query(`
                    UPDATE delivery_queue
                    SET attempts = ?, next_retry_at = DATE_ADD(NOW(), INTERVAL ? SECOND)
                    WHERE queue_id = ?
                `, [nextAttempt, delaySec, item.queue_id]);
            }

            return activeItems.length > 0 || pendingItems.length > 0;
        } catch (err) {
            logger.error('[DeliveryQueueWorker] Process error: ' + (err.stack || err.message || String(err)));
            return false;
        }
    }

    /**
     * Start the self-scheduling background loop.
     *
     * Uses setTimeout recursion instead of setInterval so that concurrent
     * overlapping cycles are impossible — the next poll only starts AFTER the
     * current one has fully completed.  This prevents the same queue rows from
     * being picked up by multiple simultaneous invocations.
     */
    static startWorker(io) {
        if (this._running) return;
        this._running = true;
        logger.info('🚀 DeliveryQueueWorker background loop started.');

        const loop = async () => {
            if (!this._running) return;
            let hadWork = false;
            try {
                hadWork = await this.processQueue(io);
            } catch (_) { /* already logged inside processQueue */ }
            // Use shorter delay when there was real work, longer when idle
            this._timeout = setTimeout(loop, hadWork ? ACTIVE_POLL_MS : IDLE_POLL_MS);
        };

        this._timeout = setTimeout(loop, ACTIVE_POLL_MS);
    }

    /**
     * Stop the worker (used in graceful shutdown / tests).
     */
    static stopWorker() {
        this._running = false;
        if (this._timeout) {
            clearTimeout(this._timeout);
            this._timeout = null;
        }
    }

    /**
     * Remove item from queue when recipient session acknowledges receipt.
     * Also clears the per-recipient ('all') row so an acked message is never
     * re-emitted or pushed by a later retry cycle.
     */
    static async acknowledgeDelivery(messageId, sessionId) {
        await db.query(
            `DELETE FROM delivery_queue WHERE message_id = ? AND (session_id = ? OR session_id = 'all')`,
            [messageId, sessionId]
        );
    }
}

module.exports = DeliveryQueueWorker;
