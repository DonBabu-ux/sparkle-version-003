const cron = require('node-cron');
const pool = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');

// Run every 30 mins
cron.schedule('*/30 * * * *', async () => {
    logger.info("Checking for inactive marketplace conversations...");
    try {
        // Query conversations where the last message was > 10 hours ago 
        // AND we haven't already sent a reminder for it.
        const [staleConversations] = await pool.query(`
            SELECT c.id, c.listing_id, m.sender_id as last_sender, 
                   IF(m.sender_id = c.buyer_id, c.seller_id, c.buyer_id) as recipient_id
            FROM marketplace_conversations c
            JOIN marketplace_messages m ON m.id = (
                SELECT id FROM marketplace_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1
            )
            WHERE c.last_activity_at < NOW() - INTERVAL 10 HOUR
            AND c.reminder_sent = FALSE
        `);

        for (let conv of staleConversations) {
            // Trigger real notification through the service
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
                
                // Mark as sent to prevent spamming
                await pool.query(`UPDATE marketplace_conversations SET reminder_sent = TRUE WHERE id = ?`, [conv.id]);
            } catch (notifErr) {
                logger.error("Failed to deliver inactivity notification:", notifErr);
            }
        }

        if (staleConversations.length > 0) {
            logger.info(`Sent ${staleConversations.length} marketplace inactivity reminders.`);
        }
    } catch (error) {
        logger.error("Error running inactivity notifier:", error);
    }
});
