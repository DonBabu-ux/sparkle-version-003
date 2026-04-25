const { notificationQueue, connection } = require('../utils/queue');
const logger = require('../utils/logger');
const crypto = require('crypto');

class NotificationService {
    /**
     * Enqueue a notification for a user or multiple users
     * Implementation of Section 1 Requirements:
     * - Asynchronous queuing
     * - Deduplication
     * - Rate limiting (per user cooldown)
     * - Batch processing (fan-out)
     */
    static async send(event) {
        const { type, priority, recipients, data, eventId } = event;

        if (!notificationQueue) {
            logger.warn('NotificationService: Queue is disabled. Skipping async delivery.');
            return;
        }

        const userIds = Array.isArray(recipients) ? recipients : [recipients];
        const MAX_FANOUT = 50000;
        const targetUsers = userIds.slice(0, MAX_FANOUT);

        const BATCH_SIZE = 500;
        for (let i = 0; i < targetUsers.length; i += BATCH_SIZE) {
            const batch = targetUsers.slice(i, i + BATCH_SIZE);
            
            await notificationQueue.add('send-notification', {
                userIds: batch,
                type,
                priority,
                data,
                eventId: eventId || crypto.randomUUID()
            }, {
                priority: this.getPriorityValue(priority),
                delay: i > 0 ? (i / BATCH_SIZE) * 100 : 0
            });
        }
    }

    static getPriorityValue(priority) {
        switch (priority) {
            case 'HIGH': return 1;
            case 'MEDIUM': return 5;
            case 'LOW': return 10;
            default: return 5;
        }
    }

    static async canSendToUser(userId, eventId) {
        if (!connection) return true; // Fail-open if no connection

        const dedupeKey = `notif:dedupe:${userId}:${eventId}`;
        const cooldownKey = `notif:cooldown:${userId}`;

        const isDuplicate = await connection.get(dedupeKey);
        if (isDuplicate) return false;

        const inCooldown = await connection.get(cooldownKey);
        if (inCooldown) return false;

        await connection.setex(dedupeKey, 60, '1');
        await connection.setex(cooldownKey, 5, '1');

        return true;
    }

}

module.exports = NotificationService;
