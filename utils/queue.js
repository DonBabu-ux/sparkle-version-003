const { Queue, Worker, QueueEvents } = require('bullmq');
const IORedis = require('ioredis');
const logger = require('./logger');

// Redis configuration
const redisConfig = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || null,
    maxRetriesPerRequest: null,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined
};

const connection = new IORedis(redisConfig);

connection.on('error', (err) => {
    logger.error('Redis connection error:', err);
});

// Create Notification Queue
const notificationQueue = new Queue('notifications', { 
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: 1000 // Keep failed jobs for a while
    }
});

module.exports = {
    notificationQueue,
    connection
};
