const { Worker } = require('bullmq');
const { connection } = require('../utils/queue');
const NotificationService = require('../services/notification.service');
const logger = require('../utils/logger');
const pool = require('../config/database');

let worker = null;

if (connection) {
    worker = new Worker('notifications', async (job) => {
        const { userIds, type, priority, data, eventId } = job.data;
        
        const { notificationQueue } = require('../utils/queue');
        if (notificationQueue) {
            const queueLength = await notificationQueue.getWaitingCount();
            if (queueLength > 5000 && priority === 'LOW') {
                logger.warn(`Dropping LOW priority notification due to load: ${type}`);
                return;
            }
        }

        for (const userId of userIds) {
            try {
                const shouldSend = await NotificationService.canSendToUser(userId, eventId);
                if (!shouldSend) continue;

                await pool.query(
                    'INSERT INTO notifications (notification_id, user_id, type, title, content, action_url) VALUES (?, ?, ?, ?, ?, ?)',
                    [require('crypto').randomUUID(), userId, type, data.title, data.content, data.url || null]
                );
            } catch (error) {
                logger.error(`Failed to deliver notification to ${userId}:`, error);
            }
        }
    }, { 
        connection,
        concurrency: 5
    });

    worker.on('completed', (job) => {
        logger.info(`Notification batch ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
        logger.error(`Notification batch ${job.id} failed:`, err);
    });
} else {
    logger.warn('Notification Worker: Skipping initialization due to missing Redis connection');
}

module.exports = worker;

