// services/feed.service.js
// COMPLETE FIXED VERSION - No syntax errors

const { getPool } = require('../config/database');
const { getCache, setCache } = require('../config/redis');
const logger = require('../utils/logger');

const CANDIDATE_POOL_TTL = parseInt(process.env.CANDIDATE_POOL_TTL) || 900; // 15 minutes
const FEED_LIMIT = parseInt(process.env.FEED_LIMIT) || 10;

class FeedService {
    /**
     * Get feed - DYNAMICALLY assembled from cached building blocks
     */
    static async getFeed(userId, deviceId, offset = 0, limit = FEED_LIMIT) {
        try {
            // 1. Get candidate pool (cached, 15 min TTL)
            const candidatePool = await this.getCandidatePool(userId);

            if (!candidatePool || candidatePool.length === 0) {
                logger.warn(`[Feed] No candidate pool for user ${userId}`);
                return { success: true, data: [] };
            }

            // 2. Get seen posts for this device
            const seenKey = `seen:${userId}:device:${deviceId}`;
            let seenPosts = await getCache(seenKey) || [];

            // 3. Filter out seen posts
            const availablePosts = candidatePool.filter(
                post => !seenPosts.includes(post.post_id)
            );

            // 4. If not enough unseen posts, reset seen list
            if (availablePosts.length < limit) {
                logger.info(`[Feed] Reset seen list for user ${userId}, device ${deviceId}`);
                seenPosts = [];
                await setCache(seenKey, [], 3600);

                const allPosts = candidatePool;
                const shuffled = this.shufflePosts(allPosts, deviceId);
                const slice = shuffled.slice(offset, offset + limit);

                const newSeen = slice.map(p => p.post_id);
                await setCache(seenKey, newSeen, 3600);

                return {
                    success: true,
                    data: slice,
                    hasMore: slice.length === limit,
                    source: 'dynamic'
                };
            }

            // 5. Shuffle available posts deterministically per device
            const shuffled = this.shufflePosts(availablePosts, deviceId);

            // 6. Get slice for this request
            const slice = shuffled.slice(offset, offset + limit);

            // 7. Mark these as seen
            const newSeen = slice.map(p => p.post_id);
            await setCache(seenKey, [...seenPosts, ...newSeen], 3600);

            // 8. Check if there's more content
            const hasMore = shuffled.length > offset + limit;

            return {
                success: true,
                data: slice,
                hasMore,
                totalAvailable: shuffled.length,
                source: 'dynamic'
            };

        } catch (error) {
            logger.error('[Feed] Error:', error.message);
            return { success: true, data: [] };
        }
    }

    /**
     * Get candidate pool (cached building block)
     */
    static async getCandidatePool(userId) {
        const cacheKey = `candidate_pool:${userId}`;

        // Try cache first
        let pool = await getCache(cacheKey);
        if (pool) {
            logger.debug(`[Feed] Candidate pool cache hit for user ${userId}`);
            return pool;
        }

        // Cache miss - generate new pool
        logger.info(`[Feed] Generating candidate pool for user ${userId}`);
        pool = await this.generateCandidatePool(userId);

        // Cache for 15 minutes
        await setCache(cacheKey, pool, CANDIDATE_POOL_TTL);

        return pool;
    }

    /**
     * Generate candidate pool from database (optimized)
     */
    static async generateCandidatePool(userId) {
        const pool = getPool();

        try {
            const [posts] = await pool.query(`
                SELECT p.post_id, p.user_id, p.content, p.created_at,
                       p.spark_count, p.comment_count, p.share_count, p.view_count,
                       u.username, u.name as user_name, u.avatar_url,
                       EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = p.user_id) as is_following
                FROM posts p
                JOIN users u ON p.user_id = u.user_id
                WHERE p.is_deleted = 0
                  AND p.is_hidden = 0
                  AND (p.scheduled_at IS NULL OR p.scheduled_at <= NOW())
                  AND p.created_at > NOW() - INTERVAL 30 DAY
                ORDER BY 
                    CASE WHEN EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = p.user_id) THEN 1 ELSE 0 END DESC,
                    p.created_at DESC
                LIMIT 2000
            `, [userId, userId]);

            const scoredPosts = posts.map(post => {
                const hoursSince = (Date.now() - new Date(post.created_at).getTime()) / 3600000;
                const freshness = Math.max(0, 100 - hoursSince * 0.5);
                const engagement = (post.spark_count || 0) * 2 +
                    (post.comment_count || 0) * 3 +
                    (post.share_count || 0) * 4;
                const score = freshness + engagement + (post.is_following ? 50 : 0);
                return { ...post, score };
            });

            scoredPosts.sort((a, b) => b.score - a.score);

            return scoredPosts.slice(0, 500);

        } catch (error) {
            logger.error('[Feed] Generate candidate pool error:', error.message);
            return [];
        }
    }

    /**
     * Deterministic shuffle using device ID as seed
     */
    static shufflePosts(posts, seed) {
        if (!posts || posts.length === 0) return posts;

        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            const char = seed.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }

        const shuffled = [...posts];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const rand = this.deterministicRandom(hash, i);
            const j = Math.floor(rand * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        return shuffled;
    }

    /**
     * Deterministic random generator
     */
    static deterministicRandom(seed, index) {
        let x = seed + index * 2654435761;
        x = (x ^ (x >>> 13)) * 0x9e3779b9;
        x = (x ^ (x >>> 13)) * 0x85ebca6b;
        x = x ^ (x >>> 13);
        return (x >>> 0) / 4294967296;
    }

    /**
     * Get seen posts for a device
     */
    static async getSeenPosts(userId, deviceId) {
        const key = `seen:${userId}:device:${deviceId}`;
        const seen = await getCache(key);
        return seen || [];
    }

    /**
     * Mark posts as seen
     */
    static async markSeen(userId, deviceId, postIds) {
        const key = `seen:${userId}:device:${deviceId}`;
        const seen = await getCache(key) || [];
        const updated = [...seen, ...postIds];
        const trimmed = updated.slice(-1000);
        await setCache(key, trimmed, 3600);
        return trimmed;
    }

    /**
     * Reset seen posts
     */
    static async resetSeen(userId, deviceId) {
        const key = `seen:${userId}:device:${deviceId}`;
        await setCache(key, [], 3600);
        logger.info(`[Feed] Reset seen posts for user ${userId}, device ${deviceId}`);
        return { success: true };
    }

    /**
     * Invalidate feed cache for a user
     */
    static async invalidateFeedCache(userId) {
        try {
            const pattern = `candidate_pool:${userId}`;
            await setCache(pattern, null, 0);
            logger.info(`[Feed] Invalidated candidate pool for user ${userId}`);
            return { success: true };
        } catch (error) {
            logger.error('[Feed] Cache invalidation failed:', error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = FeedService;
