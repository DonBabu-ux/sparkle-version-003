const { Queue, Worker, QueueEvents } = require('bullmq');
const IORedis = require('ioredis');
const logger = require('./logger');

// Redis configuration (Production-Ready)
const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_TCP_URL;
let connection;

if (redisUrl) {
    connection = new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
        tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
        retryStrategy(times) {
            const delay = Math.min(times * 500, 15000);
            if (times % 10 === 0) {
                logger.warn(`Redis connection retry attempt ${times}. Delay: ${delay}ms`);
            }
            return delay;
        },
        reconnectOnError(err) {
            const targetError = 'READONLY';
            if (err.message.includes(targetError)) {
                return true;
            }
            return false;
        }
    });
    
    connection.on('error', (err) => {
        logger.error('Redis Queue Connection Error:', err.message);
    });
} else {
    logger.warn('REDIS_URL or UPSTASH_REDIS_TCP_URL missing. Queues are DISABLED.');
}


let notificationQueue = null;

if (connection) {
    notificationQueue = new Queue('notifications', { 
        connection,
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 1000,
            },
            removeOnComplete: true,
            removeOnFail: 1000
        }
    });
}

module.exports = {
    notificationQueue,
    connection
};

