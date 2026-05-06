const redisService = require('../services/redis.service');

/**
 * Acquires a short-lived Redis lock to prevent action spam (like, share, etc).
 * @param {string} userId - ID of the user
 * @param {string} targetId - ID of the post/story being acted upon
 * @param {string} actionType - 'like', 'share', 'spark', etc
 * @param {number} ttlSeconds - Time-to-live for the lock in seconds (default 2)
 * @returns {Promise<boolean>} - true if lock acquired, false if deduped
 */
async function acquireActionLock(userId, targetId, actionType, ttlSeconds = 2) {
    try {
        const key = `lock:action:${userId}:${targetId}:${actionType}`;
        const redisClient = redisService.client;
        
        if (!redisClient || !redisClient.isReady) {
            // Fallback if Redis is unavailable: allow the action and let DB handle idempotency
            return true; 
        }

        const result = await redisClient.set(key, '1', {
            NX: true,
            EX: ttlSeconds
        });

        return result === 'OK'; // true = lock acquired successfully
    } catch (error) {
        console.error('ActionGuard Error:', error.message);
        return true; // Fallback to allow if Redis fails
    }
}

module.exports = {
    acquireActionLock
};
