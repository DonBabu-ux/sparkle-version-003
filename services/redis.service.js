const { Redis } = require('@upstash/redis');
const logger = require('../utils/logger');

/**
 * Production-ready Redis Service using Upstash REST Client.
 * Handles caching, OTP storage, and session persistence with graceful fallbacks.
 */
class RedisService {
    constructor() {
        this.client = null;
        this.isEnabled = false;
        this.initialize();
    }

    initialize() {
        try {
            const url = process.env.UPSTASH_REDIS_REST_URL;
            const token = process.env.UPSTASH_REDIS_REST_TOKEN;

            if (!url || !token) {
                logger.warn('Redis Service: UPSTASH_REDIS_REST_URL or TOKEN missing. Redis is DISABLED.');
                return;
            }

            this.client = new Redis({
                url: url,
                token: token,
            });

            this.isEnabled = true;
            logger.info('Redis Service: Initialized successfully (REST API)');
        } catch (error) {
            logger.error('Redis Service: Initialization failed:', error);
            this.isEnabled = false;
        }
    }

    /**
     * Get a value from Redis
     */
    async get(key) {
        if (!this.isEnabled) return null;
        try {
            return await this.client.get(key);
        } catch (error) {
            logger.error(`Redis Get Error [${key}]:`, error.message);
            return null;
        }
    }

    /**
     * Set a value in Redis with optional TTL (seconds) and options (like NX)
     */
    async set(key, value, ttlOrOptions = null, maybeNx = null) {
        if (!this.isEnabled) return "DISABLED"; // Return truthy so locks don't fail when disabled
        try {
            let options = {};
            if (typeof ttlOrOptions === 'number') {
                options.ex = ttlOrOptions;
            } else if (ttlOrOptions && typeof ttlOrOptions === 'object') {
                options = ttlOrOptions;
            }

            if (maybeNx === 'NX' || (ttlOrOptions === 'NX')) {
                options.nx = true;
            }

            return await this.client.set(key, value, options);
        } catch (error) {
            logger.error(`Redis Set Error [${key}]:`, error.message);
            return null;
        }
    }

    /**
     * Delete a key
     */
    async del(key) {
        if (!this.isEnabled) return null;
        try {
            return await this.client.del(key);
        } catch (error) {
            logger.error(`Redis Del Error [${key}]:`, error.message);
            return null;
        }
    }

    /**
     * Increment a value (useful for rate limiting)
     */
    async incr(key) {
        if (!this.isEnabled) return 0;
        try {
            return await this.client.incr(key);
        } catch (error) {
            logger.error(`Redis Incr Error [${key}]:`, error.message);
            return 0;
        }
    }

    /**
     * Set expiration on a key
     */
    async expire(key, seconds) {
        if (!this.isEnabled) return null;
        try {
            return await this.client.expire(key, seconds);
        } catch (error) {
            logger.error(`Redis Expire Error [${key}]:`, error.message);
            return null;
        }
    }
    /**
     * Add to a Set (for seen videos)
     */
    async sadd(key, ...members) {
        if (!this.isEnabled) return 0;
        try {
            return await this.client.sadd(key, ...members);
        } catch (error) {
            logger.error(`Redis SAdd Error [${key}]:`, error.message);
            return 0;
        }
    }

    /**
     * Get all members of a Set
     */
    async smembers(key) {
        if (!this.isEnabled) return [];
        try {
            return await this.client.smembers(key);
        } catch (error) {
            logger.error(`Redis SMembers Error [${key}]:`, error.message);
            return [];
        }
    }
}

// Export a singleton instance
module.exports = new RedisService();
