const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');

const marketplaceQueue = new Queue('marketplace-actions', {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    }
});

module.exports = marketplaceQueue;
