const cron = require('node-cron');
const pool = require('../config/database');
const logger = require('../utils/logger');

// Run every 30 mins
cron.schedule('*/30 * * * *', async () => {
    logger.info("Checking for inactive marketplace conversations...");
    // Use a single connection / transaction so we can claim rows with
    // SELECT ... FOR UPDATE SKIP LOCKED. This prevents two overlapping
    // worker instances from both picking up the same conversation and
    // sending a duplicate reminder.
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Claim a batch of unprocessed conversations. SKIP LOCKED lets
        // a concurrent worker skip rows this instance has already locked,
        // so each reminder is sent exactly once even if instances overlap.
        const [claimed] = await connection.query(`
            SELECT c.id, c.listing_id, m.sender_id as last_sender,
                   IF(m.sender_id = c.buyer_id, c.seller_id, c.buyer_id) as recipient_id
            FROM marketplace_conversations c
            JOIN marketplace_messages m ON m.id = (
                SELECT id FROM marketplace_messages
                WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1
            )
            WHERE c.last_activity_at < NOW() - INTERVAL 10 HOUR
              AND c.reminder_sent = FALSE
            LIMIT 50
            FOR UPDATE SKIP LOCKED
        `);

        for (let conv of claimed) {
            try {
                const NotificationService = require('../services/notification.service');
                await NotificationService.send({
                    type: 'marketplace_contact',
                    priority: 'LOW',
                    recipients: [conv.recipient_id],
                    data: {
                        title: 'Unread Marketplace Message',
                        content: 'You have an unread message regarding a marketplace listing.',
                        url: '/marketplace/messages/' + conv.id,
                        conversationId: conv.id
                    }
                });

                // Mark as sent only after successful delivery so a failed
                // attempt can be retried on the next run.
                await connection.query(
                    `UPDATE marketplace_conversations SET reminder_sent = TRUE WHERE id = ?`,
                    [conv.id]
                );
            } catch (notifErr) {
                logger.error("Failed to deliver inactivity notification:", notifErr.message);
                // Leave reminder_sent = FALSE so the conversation is retried.
            }
        }

        await connection.commit();
        if (claimed.length > 0) {
            logger.info(`Sent ${claimed.length} marketplace inactivity reminders.`);
        }
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        logger.error("Error running inactivity notifier:", error);
    } finally {
        if (connection) connection.release();
    }
});
