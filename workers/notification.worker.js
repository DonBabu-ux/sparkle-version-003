const { Worker } = require('bullmq');
const { connection } = require('../utils/queue');
const NotificationService = require('../services/notification.service');
const logger = require('../utils/logger');
const pool = require('../config/database');

/**
 * Worker implementation for Section 1
 * Handles actual delivery and fail-safe mechanisms
 */
const worker = new Worker('notifications', async (job) => {
    const { userIds, type, priority, data, eventId } = job.data;
    
    // Fail-safe: Check CPU load or queue length (Simplified)
    // If we're overloaded, drop LOW priority
    const queueLength = await job.queue.getWaitingCount();
    if (queueLength > 5000 && priority === 'LOW') {
        logger.warn(`Dropping LOW priority notification due to load: ${type}`);
        return;
    }

    for (const userId of userIds) {
        try {
            // Check deduplication and cooldown
            const shouldSend = await NotificationService.canSendToUser(userId, eventId);
            if (!shouldSend) continue;

            // Database persistence (Algorithm 14)
            await pool.query(
                'INSERT INTO notifications (notification_id, user_id, type, title, content, action_url) VALUES (?, ?, ?, ?, ?, ?)',
                [require('crypto').randomUUID(), userId, type, data.title, data.content, data.url || null]
            );

            // Here you would also trigger WebPush or Socket.io delivery
            // global.io.to(userId).emit('notification', { type, data });
            
        } catch (error) {
            logger.error(`Failed to deliver notification to ${userId}:`, error);
            // BullMQ will handle retries for the whole job if we throw here
        }
    }
}, { 
    connection,
    concurrency: 5 // Process 5 batches in parallel
});

worker.on('completed', (job) => {
    logger.info(`Notification batch ${job.id} completed`);
});

worker.on('failed', (job, err) => {
    logger.error(`Notification batch ${job.id} failed:`, err);
});

module.exports = worker;
