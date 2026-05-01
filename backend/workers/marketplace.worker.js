const { Worker } = require('bullmq');
const redisConnection = require('../config/redis');
const logger = require('../utils/logger');
const Marketplace = require('../models/Marketplace');
const notificationController = require('../controllers/notification.controller');
const { emitJobUpdate } = require('../sockets');

const pool = require('../config/database');

const worker = new Worker('marketplace-actions', async (job) => {
    const startTime = Date.now();
    const { type, data } = job.data;
    const userId = data.userId || data.contactUserId;
    const lockKey = `mkt:lock:job:${job.id}`;
    const leaseId = crypto.randomUUID();
    
    const acquiredLock = await redisConnection.set(lockKey, leaseId, 'NX', 'EX', 30);
    if (!acquiredLock) return;

    const heartbeat = setInterval(async () => {
        const currentLease = await redisConnection.get(lockKey);
        if (currentLease === leaseId) await redisConnection.expire(lockKey, 30);
        else clearInterval(heartbeat);
    }, 10000);

    const conn = await pool.getConnection(); // Get atomic connection for transaction
    let lastEventId = null;

    try {
        await conn.beginTransaction();

        const logTransactionalEvent = async (status, payload = {}) => {
            // Global Logical Clock (Linearizable Ordering)
            const hlcSequence = await Marketplace.getLogicalClock();
            const eventId = crypto.randomUUID();
            const event = { 
                eventId, job_id: job.id, type, status, sequence: hlcSequence, 
                parentId: lastEventId, timestamp: Date.now(), payload 
            };

            // 1. Transactional Outbox: Write to DB log within SAME transaction
            await Marketplace.logJobEvent(event, conn);
            
            lastEventId = eventId;
            return event;
        };

        const verifyLease = async () => {
            const currentLease = await redisConnection.get(lockKey);
            if (currentLease !== leaseId) throw new Error('Distributed Lease Violation (Zombie Control)');
        };

        const processingEvent = await logTransactionalEvent('PROCESSING');

        switch (type) {
            case 'offer':
                const { listingId, amount, sellerId, listingTitle, userName } = data;
                await verifyLease();
                
                // Idempotent Business Logic (Transactional)
                const chat = await Marketplace.getOrCreateChat(data.userId, sellerId, listingId);
                const msgId = crypto.createHash('md5').update(`msg-${job.id}`).digest('hex');
                await Marketplace.sendMessage(chat.chat_id, data.userId, `🚀 NEW OFFER: KES ${parseFloat(amount).toLocaleString()} for "${listingTitle}".`, msgId);

                await notificationController.createNotification({
                    user_id: sellerId,
                    type: 'marketplace_offer',
                    notification_id: crypto.createHash('md5').update(`notif-${job.id}`).digest('hex'),
                    content: `${userName} sent you a KES ${parseFloat(amount).toLocaleString()} offer on ${listingTitle}`,
                    data: { listingId, amount, chatId: chat.chat_id, senderId: data.userId, senderName: userName, listingTitle }
                });
                break;
            // ... contact and other cases follow the same transactional pattern
        }

        const completionEvent = await logTransactionalEvent('COMPLETED');

        // COMMIT: Final point of atomic truth
        await conn.commit();

        // 2. Relay Layer: Broadcast to Redis/Socket AFTER commit (Transactional Guarantee)
        await redisConnection.rpush(`mkt:job:events:${job.id}`, JSON.stringify(processingEvent));
        await redisConnection.rpush(`mkt:job:events:${job.id}`, JSON.stringify(completionEvent));
        emitJobUpdate(userId, processingEvent);
        emitJobUpdate(userId, completionEvent);

        const duration = Date.now() - startTime;
        await redisConnection.set('mkt:p95:latency', duration.toString(), 'EX', 3600);

    } catch (error) {
        await conn.rollback();
        logger.error(`Banking-Grade Transaction Failed:`, error);
        // Log failure as a new independent event if possible
        await logTransactionalEvent('FAILED', { error: error.message });
        throw error;
    } finally {
        conn.release();
        clearInterval(heartbeat);
        const currentLease = await redisConnection.get(lockKey);
        if (currentLease === leaseId) await redisConnection.del(lockKey);
    }
}, {
    connection: redisConnection,
    concurrency: 5
});

worker.on('completed', job => {
    logger.info(`Job ${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
    logger.error(`Job ${job.id} failed with ${err.message}`);
});

module.exports = worker;
