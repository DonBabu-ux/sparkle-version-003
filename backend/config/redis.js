const Redis = require('ioredis');
const logger = require('../utils/logger');

const redisConfig = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || null,
    maxRetriesPerRequest: null // BullMQ requirement
};

const redisConnection = new Redis(redisConfig);

redisConnection.on('error', (err) => {
    logger.error('Redis Connection Error:', err);
});

redisConnection.on('connect', () => {
    logger.info('🚀 Redis connected successfully');
});

module.exports = redisConnection;
