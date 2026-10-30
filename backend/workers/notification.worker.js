const { Worker } = require('bullmq');
const { connection } = require('../utils/queue');
const { deliverNotificationToUser } = require('../services/notificationDelivery');
const logger = require('../utils/logger');

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
                // Shared with the service's degraded direct path (the
                // path when Redis is down) so both deliver identically,
                // including the full event payload for deep links + avatars.
                await deliverNotificationToUser(userId, { type, priority, data, eventId });
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

