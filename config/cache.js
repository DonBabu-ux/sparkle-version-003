// config/cache.js
// Redis caching layer with TTLs

const { getCache, setCache } = require('./redis');
const logger = require('../utils/logger');

const TTL = {
    USER: 300,           // 5 minutes
    PRIVACY: 3600,       // 1 hour
    BLOCK: 3600,         // 1 hour
    MOMENT_POOL: 900,    // 15 minutes
    CHAT_META: 300,      // 5 minutes
    NOTIFICATION_COUNT: 60 // 1 minute
};

/**
 * Read-through cache for user profiles
 */
async function getUserProfile(userId) {
    const cacheKey = `user:${userId}`;
    // Try cache
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    // Cache miss - query DB
    const { getPool } = require('./database');
    const pool = getPool();
    const [rows] = await pool.query(
        'SELECT user_id, name, username, email, avatar_url, is_online, last_seen_at FROM users WHERE user_id = ?',
        [userId]
    );
    const user = rows[0] || null;
    // Cache result (even if null, to prevent cache stampede)
    await setCache(cacheKey, user, TTL.USER);
    return user;
}

/**
 * Read-through cache for privacy settings
 */
async function getPrivacySettings(userId) {
    const cacheKey = `privacy:${userId}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const { getPool } = require('./database');
    const pool = getPool();
    const [rows] = await pool.query(
        'SELECT * FROM privacy_settings WHERE user_id = ?',
        [userId]
    );
    const settings = rows[0] || {};
    await setCache(cacheKey, settings, TTL.PRIVACY);
    return settings;
}

/**
 * Read-through cache for block status
 */
async function getBlockStatus(userA, userB) {
    const cacheKey = `block:${userA}:${userB}`;
    const cached = await getCache(cacheKey);
    if (cached !== null && cached !== undefined) return cached;

    const { getPool } = require('./database');
    const pool = getPool();
    const [rows] = await pool.query(
        'SELECT 1 FROM user_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
        [userA, userB, userB, userA]
    );
    const isBlocked = rows.length > 0;
    await setCache(cacheKey, isBlocked, TTL.BLOCK);
    return isBlocked;
}

/**
 * Invalidate cache for a user (when they update profile)
 */
async function invalidateUserCache(userId) {
    const keys = [
        `user:${userId}`,
        `privacy:${userId}`,
        `user:${userId}:followers`,
        `user:${userId}:following`
    ];
    for (const key of keys) {
        // Redis client provides del; we use getCache as placeholder – replace with proper delete if available
        try {
            const client = require('./redis').getRedisClient();
            if (client) await client.del(key);
        } catch (e) {
            logger.warn(`[Cache] Failed to delete key ${key}: ${e.message}`);
        }
    }
}

module.exports = {
    getUserProfile,
    getPrivacySettings,
    getBlockStatus,
    invalidateUserCache,
    TTL
};
