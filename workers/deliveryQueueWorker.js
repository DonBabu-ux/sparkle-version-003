const db = require('../config/database');
const logger = require('../utils/logger');

const RETRY_INTERVALS_SEC = [1, 2, 5, 10, 20, 30, 60, 300, 900]; // Exponential backoff up to 15 mins

class DeliveryQueueWorker {
    /**
     * Enqueue a message for guaranteed delivery to a specific recipient session
     */
    static async enqueue({ messageId, recipientId, sessionId }) {
        const queueId = `${messageId}:${sessionId}`;
        await db.query(`
            INSERT IGNORE INTO delivery_queue (queue_id, message_id, recipient_id, session_id, attempts, next_retry_at, created_at)
            VALUES (?, ?, ?, ?, 0, NOW(), NOW())
        `, [queueId, messageId, recipientId, sessionId]);
    }

    /**
     * Process pending deliveries in delivery_queue
     */
    static async processQueue(io) {
        try {
            const [pendingItems] = await db.query(`
                SELECT dq.*, m.chat_id, m.conversation_id, m.content, m.type, m.sender_id, m.sent_at, m.server_sequence,
                       us.socket_id, us.push_token, us.is_online
                FROM delivery_queue dq
                JOIN messages m ON dq.message_id = m.message_id
                LEFT JOIN user_sessions us ON dq.session_id = us.session_id
                WHERE dq.next_retry_at <= NOW()
                LIMIT 50
            `);

            if (pendingItems.length === 0) return;

            for (const item of pendingItems) {
                let deliveredViaSocket = false;

                // 1. If recipient socket session is connected, attempt socket delivery
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

                // 2. If not delivered via socket and has push token, trigger FCM Push Notification fallback
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
                        logger.warn(`Push delivery fallback warning for session ${item.session_id}:`, pushErr.message);
                    }
                }

                // 3. Update next retry interval with exponential backoff
                const nextAttempt = item.attempts + 1;
                const delaySec = RETRY_INTERVALS_SEC[Math.min(nextAttempt, RETRY_INTERVALS_SEC.length - 1)];

                await db.query(`
                    UPDATE delivery_queue
                    SET attempts = ?, next_retry_at = DATE_ADD(NOW(), INTERVAL ? SECOND)
                    WHERE queue_id = ?
                `, [nextAttempt, delaySec, item.queue_id]);
            }
        } catch (err) {
            logger.error('DeliveryQueueWorker process error:', err);
        }
    }

    /**
     * Start background loop polling delivery queue every 2 seconds
     */
    static startWorker(io) {
        if (this._interval) return;
        this._interval = setInterval(() => this.processQueue(io), 2000);
        logger.info('🚀 DeliveryQueueWorker background loop started.');
    }

    /**
     * Remove item from queue when recipient session acknowledges receipt
     */
    static async acknowledgeDelivery(messageId, sessionId) {
        await db.query(`
            DELETE FROM delivery_queue 
            WHERE message_id = ? AND session_id = ?
        `, [messageId, sessionId]);
    }
}

module.exports = DeliveryQueueWorker;
