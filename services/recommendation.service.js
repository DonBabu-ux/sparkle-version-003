// services/recommendation.service.js
const { safeQuery } = require('../config/database');
const cacheService = require('./cache.service');

async function getCached(key) {
    return cacheService.getLocal(key);
}

function setCached(key, value, ttlSeconds = 45) {
    return cacheService.set(key, value, ttlSeconds);
}

class RecommendationService {
    /**
     * Get popular creators ordered by follower count, excluding already followed ones
     * @param {number} limit 
     * @param {string} currentUserId 
     */
    async getPopularCreators(limit = 10, currentUserId = null) {
        const cacheKey = `popular_creators:${limit}:${currentUserId || 'guest'}`;
        const cached = await getCached(cacheKey);
        if (cached) return cached;

        let sql = `
            SELECT 
                u.user_id, u.name, u.username, u.avatar_url, u.headline,
                COUNT(f.follower_id) as follower_count
            FROM users u
            LEFT JOIN follows f ON u.user_id = f.following_id
            WHERE u.is_system_account = FALSE
        `;
        const params = [];

        if (currentUserId) {
            sql += `
                  AND u.user_id != ? 
                  AND u.user_id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)
            `;
            params.push(currentUserId, currentUserId);
        }

        sql += `
            GROUP BY u.user_id, u.name, u.username, u.avatar_url, u.headline
            ORDER BY follower_count DESC
            LIMIT ?
        `;
        params.push(Number(limit));

        const result = await safeQuery(sql, params);
        await setCached(cacheKey, result, 45); // 45s TTL
        return result;
    }

    /**
     * Get creators that match a specific interest slug
     * @param {string} category 
     * @param {number} page 
     * @param {number} limit 
     * @param {string} currentUserId 
     */
    async getCreatorsByCategory(category, page = 1, limit = 10, currentUserId = null) {
        const cacheKey = `creators_by_category:${category}:${page}:${limit}:${currentUserId || 'guest'}`;
        const cached = await getCached(cacheKey);
        if (cached) return cached;

        const offset = (Number(page) - 1) * Number(limit);
        let sql = `
            SELECT 
                u.user_id, u.name, u.username, u.avatar_url, u.headline,
                COUNT(f.follower_id) as follower_count
            FROM users u
            JOIN user_interests ui ON u.user_id = ui.user_id
            LEFT JOIN follows f ON u.user_id = f.following_id
            WHERE ui.interest_slug = ? AND u.is_system_account = FALSE
        `;
        const params = [category];

        if (currentUserId) {
            sql += ` AND u.user_id != ? AND u.user_id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?) `;
            params.push(currentUserId, currentUserId);
        }

        sql += `
            GROUP BY u.user_id, u.name, u.username, u.avatar_url, u.headline
            ORDER BY follower_count DESC
            LIMIT ? OFFSET ?
        `;
        params.push(Number(limit), Number(offset));

        const creators = await safeQuery(sql, params);

        // Fallback to general popular creators if not enough creators found for this interest
        if (creators.length < 3) {
            const popular = await this.getPopularCreators(limit, currentUserId);
            // Deduplicate popular creators from category ones
            const existingIds = new Set(creators.map(c => c.user_id));
            for (const p of popular) {
                if (!existingIds.has(p.user_id) && creators.length < limit) {
                    creators.push(p);
                }
            }
        }

        await setCached(cacheKey, creators, 45); // 45s TTL
        return creators;
    }
}

module.exports = new RecommendationService();

