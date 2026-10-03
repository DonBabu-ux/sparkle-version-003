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
            // ── 1. Fetch pending items ────────────────────────────────────────────
            // We do NOT use FOR UPDATE / SKIP LOCKED because mysql2 doesn't make it
            // easy to hold the transaction open across async calls.  Instead we
            // prevent overlapping runs via the self-scheduling loop below.
            const [pendingItems] = await db.query(`
                SELECT dq.queue_id, dq.message_id, dq.recipient_id, dq.session_id, dq.attempts,
                       m.chat_id, m.conversation_id, m.content, m.type, m.sender_id,
                       m.sent_at, m.server_sequence,
                       us.socket_id, us.push_token, us.is_online
                FROM delivery_queue dq
                JOIN messages m ON dq.message_id = m.message_id
                LEFT JOIN user_sessions us ON dq.session_id = us.session_id
                WHERE dq.next_retry_at <= NOW()
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
                let deliveredViaSocket = false;

                // 3a. Socket delivery (fastest path — zero latency)
                if (item.socket_id && io) {
                    const recipientSocket = io.sockets.sockets.get(item.socket_id);
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
                            sessionId: item.session_id
                        });
                        deliveredViaSocket = true;
                    }
                }

                // 3b. Push notification fallback (only when socket is not reachable)
                if (!deliveredViaSocket && item.push_token) {
                    try {
                        const notificationService = require('../services/notification.service');
                        await notificationService.sendPush({
                            token: item.push_token,
                            title: 'New Message',
                            body: item.type === 'text' ? item.content : `Sent a ${item.type}`,
                            data: {
                                type: 'message',
                                chatId: item.chat_id || item.conversation_id,
                                messageId: item.message_id,
                                server_sequence: String(item.server_sequence)
                            }
                        });
                    } catch (pushErr) {
                        logger.warn(`[DeliveryQueueWorker] Push fallback failed for session ${item.session_id}: ${pushErr.message}`);
                    }
                }

                // 3c. Advance retry counter with exponential back-off
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
            logger.error('[DeliveryQueueWorker] Process error:', err.message);
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
     */
    static async acknowledgeDelivery(messageId, sessionId) {
        await db.query(
            'DELETE FROM delivery_queue WHERE message_id = ? AND session_id = ?',
            [messageId, sessionId]
        );
    }
}

module.exports = DeliveryQueueWorker;
