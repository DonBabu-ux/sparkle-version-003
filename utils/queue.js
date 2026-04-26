const { Queue, Worker, QueueEvents } = require('bullmq');
const IORedis = require('ioredis');
const logger = require('./logger');

// Redis configuration (Production-Ready)
const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_TCP_URL;
let connection;

if (redisUrl) {
    connection = new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
        tls: redisUrl.startsWith('rediss://') ? {} : undefined,
        retryStrategy(times) {
            if (times >= 3) {
                logger.error('Redis connection failed permanently after 3 retries. Queues will be disabled.');
                return null;
            }
            return Math.min(times * 1000, 3000);
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

