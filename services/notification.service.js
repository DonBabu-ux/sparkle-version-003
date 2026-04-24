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

        // Recipients can be a single ID or an array
        const userIds = Array.isArray(recipients) ? recipients : [recipients];
        
        // Fan-out control: Limit recipients per event (e.g., max 50,000)
        const MAX_FANOUT = 50000;
        const targetUsers = userIds.slice(0, MAX_FANOUT);

        // Batch processing: Split into chunks of 500
        const BATCH_SIZE = 500;
        for (let i = 0; i < targetUsers.length; i += BATCH_SIZE) {
            const batch = targetUsers.slice(i, i + BATCH_SIZE);
            
            // Add batch to queue
            await notificationQueue.add('send-notification', {
                userIds: batch,
                type,
                priority,
                data,
                eventId: eventId || crypto.randomUUID()
            }, {
                priority: this.getPriorityValue(priority),
                delay: i > 0 ? (i / BATCH_SIZE) * 100 : 0 // Section 1: Add delay between batches (100ms)
            });
        }
    }

    /**
     * Helper to map priority strings to BullMQ numeric priorities
     * BullMQ: lower value = higher priority
     */
    static getPriorityValue(priority) {
        switch (priority) {
            case 'HIGH': return 1;
            case 'MEDIUM': return 5;
            case 'LOW': return 10;
            default: return 5;
        }
    }

    /**
     * Deduplication & Cooldown logic (to be used by the Worker)
     */
    static async canSendToUser(userId, eventId) {
        const dedupeKey = `notif:dedupe:${userId}:${eventId}`;
        const cooldownKey = `notif:cooldown:${userId}`;

        // Section 1: Deduplication using (userId + eventId) stored in Redis with TTL (60s)
        const isDuplicate = await connection.get(dedupeKey);
        if (isDuplicate) return false;

        // Section 1: Cooldown max 1 notification per 5 seconds per user
        const inCooldown = await connection.get(cooldownKey);
        if (inCooldown) return false;

        // Set markers
        await connection.setex(dedupeKey, 60, '1');
        await connection.setex(cooldownKey, 5, '1');

        return true;
    }
}

module.exports = NotificationService;
