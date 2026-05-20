// services/redis.service.js
// Single Redis client abstraction with graceful fallback
const redisClient = require('../config/redis');
const logger = require('../utils/logger');

class RedisService {
    /**
     * Get a cached value. Returns null on Redis failure (non-blocking).
     */
    async get(key) {
        try {
            const val = await redisClient.get(key);
            return val ? JSON.parse(val) : null;
        } catch (err) {
            logger.warn(`[Redis] GET failed for key "${key}":`, err.message);
            return null;
        }
    }

    /**
     * Set a value with optional TTL (seconds). Fails silently.
     */
    async set(key, value, ttlSeconds = 3600) {
        try {
            await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        } catch (err) {
            logger.warn(`[Redis] SET failed for key "${key}":`, err.message);
        }
    }

    /**
     * Delete a key. Fails silently.
     */
    async del(key) {
        try {
            await redisClient.del(key);
        } catch (err) {
            logger.warn(`[Redis] DEL failed for key "${key}":`, err.message);
        }
    }

    /**
     * Delete all keys matching a pattern (e.g. "user:123:*").
     */
    async delPattern(pattern) {
        try {
            const keys = await redisClient.keys(pattern);
            if (keys.length > 0) {
                await redisClient.del(...keys);
            }
        } catch (err) {
            logger.warn(`[Redis] DEL pattern failed for "${pattern}":`, err.message);
        }
    }

    /**
     * Atomic increment with optional TTL on first set.
     */
    async incr(key, ttlSeconds) {
        try {
            const count = await redisClient.incr(key);
            if (count === 1 && ttlSeconds) {
                await redisClient.expire(key, ttlSeconds);
            }
            return count;
        } catch (err) {
            logger.warn(`[Redis] INCR failed for key "${key}":`, err.message);
            return null;
        }
    }

    /**
     * Check if key exists.
     */
    async exists(key) {
        try {
            return (await redisClient.exists(key)) === 1;
        } catch (err) {
            logger.warn(`[Redis] EXISTS failed for key "${key}":`, err.message);
            return false;
        }
    }

    /**
     * Cache-aside helper: returns cached result or executes fetchFn and caches it.
     */
    async cacheAside(key, fetchFn, ttlSeconds = 300) {
        const cached = await this.get(key);
        if (cached !== null) return cached;

        const fresh = await fetchFn();
        if (fresh !== null && fresh !== undefined) {
            await this.set(key, fresh, ttlSeconds);
        }
        return fresh;
    }
}

module.exports = new RedisService();
