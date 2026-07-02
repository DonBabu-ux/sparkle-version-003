// services/discover.service.js
// Dynamic weighted discover feed for new and returning users.
//
// Weight distribution (configurable):
//   45 % Popular creators / high-quality content
//   25 % Trending moments (currently performing well)
//   20 % Interest-matched content (if user has interests)
//   10 % Recent public uploads (freshness)
//
// Rules:
//   - If user has no interests → redistribute 20 % to Popular + Trending
//   - No duplicate creators or moments
//   - Always fill the requested page size (backfill from other buckets)
//   - Single backend request — no secondary fetch required by the frontend

const { safeQuery } = require('../config/database');
const cache = require('./cache.service');
const logger = require('../utils/logger');

const DEFAULT_PAGE_SIZE = 20;
const CACHE_TTL = cache.DISCOVER_TTL; // 60 s

class DiscoverService {

    /**
     * Get a single-request discover feed for the given user.
     *
     * @param {string}  userId   Current user id (may be null for guests)
     * @param {Object}  options  { page, pageSize }
     * @returns {Promise<{ items: Array, page: number, pageSize: number, hasMore: boolean }>}
     */
    async getFeed(userId, options = {}) {
        const page = Math.max(1, parseInt(options.page, 10) || 1);
        const pageSize = Math.min(50, Math.max(1, parseInt(options.pageSize, 10) || DEFAULT_PAGE_SIZE));
        const offset = (page - 1) * pageSize;

        // ── 1. Resolve user interests ──────────────────────────────────────
        let interests = [];
        if (userId) {
            interests = await this._getUserInterests(userId);
        }
        const hasInterests = interests.length > 0;

        // ── 2. Compute weights ─────────────────────────────────────────────
        let wPopular   = 45;
        let wTrending  = 25;
        let wInterest  = hasInterests ? 20 : 0;
        let wRecent    = 10;

        if (!hasInterests) {
            // Redistribute the 20 % between Popular and Trending
            wPopular  += 12;  // 45 + 12 = 57
            wTrending += 8;   // 25 + 8  = 33
        }

        // Target counts per bucket (round so they sum to pageSize)
        const countPopular  = Math.round(pageSize * wPopular / 100);
        const countTrending = Math.round(pageSize * wTrending / 100);
        const countInterest = Math.round(pageSize * wInterest / 100);
        const countRecent   = pageSize - countPopular - countTrending - countInterest;

        // ── 3. Fetch all buckets in parallel (cached) ──────────────────────
        const [popular, trending, interestMatched, recent] = await Promise.all([
            this._getPopularContent(userId, countPopular + 10, offset),    // over-fetch for dedup headroom
            this._getTrendingMoments(userId, countTrending + 10, offset),
            hasInterests
                ? this._getInterestContent(userId, interests, countInterest + 10, offset)
                : Promise.resolve([]),
            this._getRecentUploads(userId, countRecent + 10, offset)
        ]);

        // ── 4. Merge, deduplicate, backfill ────────────────────────────────
        const seenIds = new Set();
        const seenCreators = new Set();
        const buckets = [
            { items: popular,         target: countPopular,  label: 'popular' },
            { items: trending,        target: countTrending, label: 'trending' },
            { items: interestMatched, target: countInterest, label: 'interest' },
            { items: recent,          target: countRecent,   label: 'recent' }
        ];

        const picked = [];

        // First pass: pick up to `target` unique items from each bucket
        for (const bucket of buckets) {
            let count = 0;
            for (const item of bucket.items) {
                if (count >= bucket.target) break;
                const id = item.moment_id || item.post_id || item.user_id;
                const creatorId = item.user_id;
                if (seenIds.has(id)) continue;
                if (item.moment_id && seenCreators.has(creatorId)) continue; // skip duplicate creator for moments
                seenIds.add(id);
                if (item.moment_id) seenCreators.add(creatorId);
                picked.push({ ...item, _source: bucket.label });
                count++;
            }
        }

        // Second pass: if we haven't reached pageSize, backfill from any bucket
        if (picked.length < pageSize) {
            const allRemaining = buckets.flatMap(b => b.items);
            for (const item of allRemaining) {
                if (picked.length >= pageSize) break;
                const id = item.moment_id || item.post_id || item.user_id;
                if (seenIds.has(id)) continue;
                seenIds.add(id);
                picked.push({ ...item, _source: 'backfill' });
            }
        }

        return {
            items: picked.slice(0, pageSize),
            page,
            pageSize,
            hasMore: picked.length >= pageSize
        };
    }

    // ── Private data loaders (each cached for CACHE_TTL seconds) ───────────

    /**
     * Popular content: high-quality posts & moments from established creators
     */
    async _getPopularContent(userId, limit, offset) {
        const cacheKey = `discover:popular:${limit}:${offset}`;
        return cache.getOrSet(cacheKey, CACHE_TTL, async () => {
            return safeQuery(`
                SELECT m.moment_id, m.user_id, m.caption, m.media_url, m.streaming_url,
                       m.thumbnail_url, m.media_type, m.category,
                       m.like_count, m.comment_count, m.share_count, m.view_count,
                       m.created_at,
                       u.username, u.name AS user_name, u.avatar_url, u.is_verified,
                       (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) AS follower_count,
                       'popular' AS source_type
                FROM moments m
                JOIN users u ON m.user_id = u.user_id
                WHERE u.account_status = 'active'
                  ${userId ? 'AND m.user_id != ?' : ''}
                ORDER BY (COALESCE(m.like_count,0)*3 + COALESCE(m.comment_count,0)*5 + COALESCE(m.share_count,0)*8) DESC,
                         m.created_at DESC
                LIMIT ? OFFSET ?
            `, userId ? [userId, limit, offset] : [limit, offset]);
        });
    }

    /**
     * Trending moments: performing well in the last 48 hours
     */
    async _getTrendingMoments(userId, limit, offset) {
        const cacheKey = `discover:trending:${limit}:${offset}`;
        return cache.getOrSet(cacheKey, CACHE_TTL, async () => {
            return safeQuery(`
                SELECT m.moment_id, m.user_id, m.caption, m.media_url, m.streaming_url,
                       m.thumbnail_url, m.media_type, m.category,
                       m.like_count, m.comment_count, m.share_count, m.view_count,
                       m.created_at,
                       u.username, u.name AS user_name, u.avatar_url, u.is_verified,
                       'trending' AS source_type
                FROM moments m
                JOIN users u ON m.user_id = u.user_id
                WHERE m.created_at > DATE_SUB(NOW(), INTERVAL 48 HOUR)
                  AND u.account_status = 'active'
                  ${userId ? 'AND m.user_id != ?' : ''}
                ORDER BY ((COALESCE(m.like_count,0)*5 + COALESCE(m.comment_count,0)*10 + COALESCE(m.share_count,0)*15 + 1)
                          / (COALESCE(m.view_count,0) + 10)) DESC
                LIMIT ? OFFSET ?
            `, userId ? [userId, limit, offset] : [limit, offset]);
        });
    }

    /**
     * Interest-matched content: moments whose category matches the user's interests
     */
    async _getInterestContent(userId, interests, limit, offset) {
        if (!interests || interests.length === 0) return [];

        const slugs = interests.map(i => i.interest_slug || i).filter(Boolean);
        if (slugs.length === 0) return [];

        const cacheKey = `discover:interest:${userId}:${slugs.sort().join(',')}:${limit}:${offset}`;
        return cache.getOrSet(cacheKey, CACHE_TTL, async () => {
            const placeholders = slugs.map(() => '?').join(',');
            return safeQuery(`
                SELECT m.moment_id, m.user_id, m.caption, m.media_url, m.streaming_url,
                       m.thumbnail_url, m.media_type, m.category,
                       m.like_count, m.comment_count, m.share_count, m.view_count,
                       m.created_at,
                       u.username, u.name AS user_name, u.avatar_url, u.is_verified,
                       'interest' AS source_type
                FROM moments m
                JOIN users u ON m.user_id = u.user_id
                WHERE LOWER(m.category) IN (${placeholders})
                  AND u.account_status = 'active'
                  AND m.user_id != ?
                ORDER BY m.created_at DESC
                LIMIT ? OFFSET ?
            `, [...slugs, userId, limit, offset]);
        });
    }

    /**
     * Recent public uploads: freshest content to keep the feed feeling alive
     */
    async _getRecentUploads(userId, limit, offset) {
        const cacheKey = `discover:recent:${limit}:${offset}`;
        return cache.getOrSet(cacheKey, CACHE_TTL, async () => {
            return safeQuery(`
                SELECT m.moment_id, m.user_id, m.caption, m.media_url, m.streaming_url,
                       m.thumbnail_url, m.media_type, m.category,
                       m.like_count, m.comment_count, m.share_count, m.view_count,
                       m.created_at,
                       u.username, u.name AS user_name, u.avatar_url, u.is_verified,
                       'recent' AS source_type
                FROM moments m
                JOIN users u ON m.user_id = u.user_id
                WHERE u.account_status = 'active'
                  ${userId ? 'AND m.user_id != ?' : ''}
                ORDER BY m.created_at DESC
                LIMIT ? OFFSET ?
            `, userId ? [userId, limit, offset] : [limit, offset]);
        });
    }

    /**
     * Suggested users for the discover page (cached)
     */
    async getSuggestedUsers(userId, limit = 10) {
        const cacheKey = `discover:suggested_users:${userId || 'guest'}:${limit}`;
        return cache.getOrSet(cacheKey, CACHE_TTL, async () => {
            return safeQuery(`
                SELECT u.user_id, u.name, u.username, u.avatar_url, u.headline, u.is_verified,
                       (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) AS follower_count
                FROM users u
                WHERE u.account_status = 'active'
                  ${userId ? 'AND u.user_id != ? AND u.user_id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)' : ''}
                ORDER BY follower_count DESC
                LIMIT ?
            `, userId ? [userId, userId, limit] : [limit]);
        });
    }

    /**
     * Trending creators (cached)
     */
    async getTrendingCreators(userId, limit = 10) {
        const cacheKey = `discover:trending_creators:${userId || 'guest'}:${limit}`;
        return cache.getOrSet(cacheKey, CACHE_TTL, async () => {
            return safeQuery(`
                SELECT u.user_id, u.name, u.username, u.avatar_url, u.headline, u.is_verified,
                       COUNT(m.moment_id) AS recent_moments,
                       SUM(COALESCE(m.like_count,0) + COALESCE(m.comment_count,0)) AS recent_engagement
                FROM users u
                JOIN moments m ON u.user_id = m.user_id
                WHERE m.created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
                  AND u.account_status = 'active'
                  ${userId ? 'AND u.user_id != ?' : ''}
                GROUP BY u.user_id, u.name, u.username, u.avatar_url, u.headline, u.is_verified
                ORDER BY recent_engagement DESC
                LIMIT ?
            `, userId ? [userId, limit] : [limit]);
        });
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    async _getUserInterests(userId) {
        if (!userId) return [];
        try {
            return await safeQuery(
                'SELECT interest_slug FROM user_interests WHERE user_id = ?',
                [userId]
            );
        } catch (e) {
            logger.warn('[Discover] Failed to load user interests:', e.message);
            return [];
        }
    }
}

module.exports = new DiscoverService();
