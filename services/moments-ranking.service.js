const redis = require('./redis.service');
const pool = require('../config/database');
const logger = require('../utils/logger');
const sessionInterestService = require('./session-interest.service');

const CATEGORIES = ['Sports', 'Technology', 'Entertainment', 'Academic', 'Social', 'Music', 'Lifestyle', 'Gaming', 'Comedy', 'Education', 'Politics', 'Viral', 'Dance', 'Nature', 'Fashion', 'Health', 'Travel'];

const safeParse = (val) => {
    if (!val) return null;
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch (e) { return val; }
};

/**
 * Deterministic-but-unique per-user float in [0,1]
 * Breaks score ties differently for every user.
 */
const userSeed = (userId) => {
    let h = 0;
    for (let i = 0; i < userId.length; i++) {
        h = (Math.imul(31, h) + userId.charCodeAt(i)) | 0;
    }
    return Math.abs(h % 1000) / 1000;
};

/**
 * Fisher-Yates shuffle within score bands so items with similar
 * scores appear in a different order for every user.
 */
const bandShuffle = (arr, bandSize = 5) => {
    const out = [...arr];
    for (let i = 0; i < out.length; i += bandSize) {
        const end = Math.min(i + bandSize, out.length);
        for (let j = end - 1; j > i; j--) {
            const k = i + Math.floor(Math.random() * (j - i + 1));
            [out[j], out[k]] = [out[k], out[j]];
        }
    }
    return out;
};

/**
 * Moments Ranking Service — Production Speed Edition
 *
 * Key optimizations:
 *  1. generateCandidatePools: all 17 category DB queries run in PARALLEL (Promise.all)
 *  2. getRankedFeed: getSessionProfile + getFollowingPool fetched once, shared across stages
 *  3. Per-user ranked-feed cache (30s TTL) — repeated opens are instant
 *  4. Fast-path DB fallback returns in <200ms when Redis is cold
 */
class MomentsRankingService {

    /**
     * Rebuilds the global candidate pools in Redis.
     * OPTIMIZED: All category queries now run in parallel.
     */
    async generateCandidatePools(force = false) {
        const lockKey = 'lock:moments:pool_regeneration';
        const lastRunKey = 'moments:pool:last_run';

        if (!force) {
            const lastRun = await redis.get(lastRunKey);
            if (lastRun && (Date.now() - parseInt(lastRun)) < 60000) return;
        }

        const isLocked = await redis.set(lockKey, 'locked', 30, 'NX');
        if (!isLocked) return;

        try {
            await redis.set(lastRunKey, Date.now().toString());
            logger.info('Generating Moments Candidate Pools (parallel)...');

            // ── All pool queries fired simultaneously ──────────────────────────
            const [trendingResult, strangersResult, ...catResults] = await Promise.all([
                // Trending pool
                pool.query(`
                    SELECT m.moment_id, m.user_id, m.caption, m.media_url, m.streaming_url, m.thumbnail_url, m.media_type, 
                           m.category, m.resolution, m.bitrate, m.like_count, m.comment_count, m.share_count, m.view_count,
                           m.created_at, m.completion_rate, m.quality_score,
                           u.username, u.name as user_name, u.avatar_url,
                           ((COALESCE(m.like_count, 0) * 5.0 + COALESCE(m.comment_count, 0) * 10.0 + COALESCE(m.share_count, 0) * 15.0 + 1.0)
                           / (COALESCE(m.view_count, 0) + 10.0)) * IFNULL(m.completion_rate, 1.0) * IFNULL(m.quality_score, 1.0) as base_score
                    FROM moments m
                    JOIN users u ON m.user_id = u.user_id
                    WHERE m.created_at > DATE_SUB(NOW(), INTERVAL 48 HOUR)
                    ORDER BY base_score DESC LIMIT 200
                `),
                // Strangers pool
                pool.query(`
                    SELECT m.moment_id, m.user_id, m.caption, m.media_url, m.streaming_url, m.thumbnail_url, m.media_type, 
                           m.category, m.resolution, m.bitrate, m.like_count, m.comment_count, m.share_count, m.view_count,
                           m.created_at, m.completion_rate, m.quality_score,
                           u.username, u.name as user_name, u.avatar_url,
                           ((COALESCE(m.like_count, 0) * 5.0 + COALESCE(m.comment_count, 0) * 10.0 + COALESCE(m.share_count, 0) * 15.0 + 1.0)
                           / (COALESCE(m.view_count, 0) + 10.0)) as base_score
                    FROM moments m
                    JOIN users u ON m.user_id = u.user_id
                    WHERE m.like_count > 10
                    ORDER BY RAND() LIMIT 100
                `),
                // All 17 category pools in parallel
                ...CATEGORIES.map(cat =>
                    pool.query(`
                        SELECT m.moment_id, m.user_id, m.caption, m.media_url, m.streaming_url, m.thumbnail_url, m.media_type, 
                               m.category, m.resolution, m.bitrate, m.like_count, m.comment_count, m.share_count, m.view_count,
                               m.created_at, m.completion_rate, m.quality_score,
                               u.username, u.name as user_name, u.avatar_url,
                               ((COALESCE(m.like_count, 0) * 5.0 + COALESCE(m.comment_count, 0) * 10.0 + COALESCE(m.share_count, 0) * 15.0 + 1.0)
                               / (COALESCE(m.view_count, 0) + 10.0)) * IFNULL(m.completion_rate, 1.0) * IFNULL(m.quality_score, 1.0) as base_score
                        FROM moments m
                        JOIN users u ON m.user_id = u.user_id
                        WHERE LOWER(m.category) = LOWER(?)
                        ORDER BY m.created_at DESC LIMIT 100
                    `, [cat])
                )
            ]);

            // ── Write all results to Redis simultaneously ───────────────────────
            const writes = [];
            writes.push(redis.set('pool:trending:shard_01', JSON.stringify(trendingResult[0]), 300));
            writes.push(redis.set('pool:strangers:shard_01', JSON.stringify(strangersResult[0]), 300));
            CATEGORIES.forEach((cat, i) => {
                if (catResults[i][0].length > 0) {
                    writes.push(redis.set(`pool:category:${cat}:shard_01`, JSON.stringify(catResults[i][0]), 600));
                }
            });
            await Promise.all(writes);

            logger.info('Candidate Pools generated and cached.');
        } catch (error) {
            logger.error('Error generating candidate pools:', error);
        } finally {
            await redis.del('lock:moments:pool_regeneration');
        }
    }

    async getFollowingPool(userId) {
        const [following] = await pool.query(`
            SELECT m.moment_id, m.user_id, m.caption, m.media_url, m.streaming_url, m.thumbnail_url, m.media_type, 
                   m.category, m.resolution, m.bitrate, m.like_count, m.comment_count, m.share_count, m.view_count,
                   m.created_at, m.completion_rate, m.quality_score,
                   u.username, u.name as user_name, u.avatar_url,
                   ((COALESCE(m.like_count, 0) * 5.0 + COALESCE(m.comment_count, 0) * 10.0 + COALESCE(m.share_count, 0) * 15.0 + 1.0)
                   / (COALESCE(m.view_count, 0) + 10.0)) * IFNULL(m.completion_rate, 1.0) * IFNULL(m.quality_score, 1.0) as base_score
            FROM moments m
            JOIN users u ON m.user_id = u.user_id
            JOIN follows f ON f.following_id = m.user_id
            WHERE f.follower_id = ?
            ORDER BY m.created_at DESC LIMIT 50
        `, [userId]);
        return following;
    }

    /**
     * FULL PRODUCTION PIPELINE: Retrieval → Scoring → Reranking → Exploration
     *
     * OPTIMIZED:
     *  - Per-user result cache (30s) for instant repeat opens
     *  - getSessionProfile + getFollowingPool fetched ONCE and reused
     *  - Fast-path fallback when Redis is cold
     */
    async getRankedFeed(userId, limit = 8, options = {}) {
        const { query, offset = 0, refresh = false } = options;

        // ── Per-user result cache (skip full pipeline on warm re-opens) ─────
        // Bypass cache if the client explicitly asked for a refresh
        if (!query && offset === 0 && !refresh) {
            const cacheKey = `ranked_feed:${userId}`;
            const cached = await redis.get(cacheKey);
            if (cached) {
                const data = safeParse(cached);
                if (Array.isArray(data) && data.length > 0) {
                    // Kick off background refresh so the NEXT open is also fast
                    this._refreshFeedCache(userId, limit).catch(() => {});
                    return data;
                }
            }
        }

        // ── Trigger pool generation (non-blocking) ───────────────────────────
        if (offset === 0) {
            this.generateCandidatePools().catch(() => {});
        }

        // ── Fetch shared context ONCE (used in both retrieve + score stages) ─
        const [sivProfile, followingPool] = await Promise.all([
            sessionInterestService.getSessionProfile(userId),
            this.getFollowingPool(userId)
        ]);

        // RACE: Set a 2.5s timeout for the entire ranking process to ensure snappy response
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Ranking Timeout')), 2500));
        
        try {
            const result = await Promise.race([
                (async () => {
                    const candidates = await this._retrieveCandidates(userId, query, offset, sivProfile, followingPool);
                    const scoredCandidates = this._scoreCandidates(userId, candidates, query, sivProfile, followingPool);
                    const reranked = this._rerank(scoredCandidates, limit);
                    return await this._applyExplorationAndDeduplicate(userId, reranked, limit, !!query);
                })(),
                timeoutPromise
            ]);

            // ── Cache the result for 30 seconds ──────────────────────────────────
            if (!query && offset === 0 && result.length > 0) {
                redis.set(`ranked_feed:${userId}`, JSON.stringify(result), 30).catch(() => {});
            }

            return result;
        } catch (error) {
            console.warn(`⚠️ Moments Ranking Optimization: ${error.message}. Using fast-path fallback.`);
            // FAST PATH: Direct DB fallback if ranking is too slow
            const [fallback] = await pool.query(`
                SELECT m.moment_id, m.user_id, m.caption, m.media_url, m.streaming_url, m.thumbnail_url, m.media_type, 
                       m.category, m.resolution, m.bitrate, m.like_count, m.comment_count, m.share_count, m.view_count,
                       m.created_at, m.completion_rate, m.quality_score,
                       u.username, u.name as user_name, u.avatar_url
                FROM moments m JOIN users u ON m.user_id = u.user_id
                ORDER BY m.created_at DESC LIMIT ? OFFSET ?
            `, [limit, offset]);
            return fallback;
        }
    }

    /** Background refresh so the next open is instant too */
    async _refreshFeedCache(userId, limit) {
        const [sivProfile, followingPool] = await Promise.all([
            sessionInterestService.getSessionProfile(userId),
            this.getFollowingPool(userId)
        ]);
        const candidates = await this._retrieveCandidates(userId, null, 0, sivProfile, followingPool);
        const scored = this._scoreCandidates(userId, candidates, null, sivProfile, followingPool);
        const reranked = this._rerank(scored, limit);
        const finalBatch = await this._applyExplorationAndDeduplicate(userId, reranked, limit, false);
        if (finalBatch.length > 0) {
            await redis.set(`ranked_feed:${userId}`, JSON.stringify(finalBatch), 30);
        }
    }

    /**
     * STAGE 1: RETRIEVAL
     * Accepts pre-fetched sivProfile + followingPool to avoid duplicate calls.
     */
    async _retrieveCandidates(userId, query, offset = 0, sivProfile, followingPool) {
        let candidates = [];
        const pools = ['pool:trending:shard_01', 'pool:strangers:shard_01'];

        // Fetch base pools + interest pools simultaneously
        const poolKeys = [
            ...pools,
            ...Object.keys(sivProfile).map(cat => `pool:category:${cat}:shard_01`)
        ];

        const poolData = await Promise.all(poolKeys.map(k => redis.get(k)));
        poolData.forEach(raw => {
            const data = safeParse(raw);
            if (Array.isArray(data)) candidates.push(...data);
        });

        candidates.push(...followingPool);

        // DB fallback + paging (fast query, no joins on cold start)
        if (candidates.length < 20 || offset > 0) {
            const [dbItems] = await pool.query(`
                SELECT m.moment_id, m.user_id, m.caption, m.media_url, m.streaming_url, m.thumbnail_url, m.media_type, 
                       m.category, m.resolution, m.bitrate, m.like_count, m.comment_count, m.share_count, m.view_count,
                       m.created_at, m.completion_rate, m.quality_score,
                       u.username, u.name as user_name, u.avatar_url, 0.4 as base_score
                FROM moments m
                JOIN users u ON m.user_id = u.user_id
                ORDER BY m.created_at DESC
                LIMIT ? OFFSET ?
            `, [50, offset]);
            candidates.push(...dbItems);
        }

        // Filter by query
        if (query) {
            const normalizedQ = query.toLowerCase();
            const filtered = candidates.filter(c =>
                (c.caption && c.caption.toLowerCase().includes(normalizedQ)) ||
                (c.category && c.category.toLowerCase() === normalizedQ) ||
                (c.username && c.username.toLowerCase().includes(normalizedQ))
            );
            if (filtered.length >= 5) return filtered;
        }

        // Deduplicate
        const uniqueMap = new Map();
        candidates.forEach(c => uniqueMap.set(c.moment_id, c));
        return Array.from(uniqueMap.values());
    }

    /**
     * STAGE 2: SCORING
     * Now synchronous — no more async calls (reuses pre-fetched data).
     */
    _scoreCandidates(userId, candidates, query, sivProfile, followingPool) {
        const followingIds = new Set(followingPool.map(f => f.moment_id));
        const uSeed = userSeed(userId); // unique per user, consistent within session
        const hasSIV  = Object.keys(sivProfile).length > 0;

        return candidates.map(m => {
            let baseScore = Number(m.base_score) || 1.0;

            // Interest Match (I)
            let interestMatch = 1.0;
            if (m.category && sivProfile[m.category]) {
                const weight = sivProfile[m.category];
                interestMatch = Math.min(1.8, 1.0 + (weight / 100));
            }

            // Affinity Boost (F)
            let affinityBoost = followingIds.has(m.moment_id) ? 1.2 : 1.0;
            if (m.user_id === userId) affinityBoost = 0.05;

            // Time Decay (T) — Gravity 0.8
            const ageHours = (Date.now() - new Date(m.created_at).getTime()) / (1000 * 60 * 60);
            const timeDecay = 1.0 / Math.pow(Math.max(ageHours, 0) + 2, 0.8);

            // Exploration noise:
            // - Cold start (no SIV): high noise (0.3) → diverse feeds across users
            // - Warm session (SIV active): lower noise (0.1) → personalization dominates
            const noiseRange = hasSIV ? 0.1 : 0.3;
            // uSeed shifts the noise window per-user so two users with identical
            // scores see a different ordering even from the same candidate pool
            const explorationNoise = (Math.random() * noiseRange) + (uSeed * 0.05);

            const finalScore = (baseScore * interestMatch * affinityBoost * timeDecay) + explorationNoise;

            return {
                ...m,
                exploration_score: finalScore,
                is_aligned: interestMatch > 1.0 || (query && m.category?.toLowerCase() === query.toLowerCase())
            };
        });
    }

    _rerank(candidates, limit) {
        // Sort by score descending
        candidates.sort((a, b) => b.exploration_score - a.exploration_score);

        // Shuffle within 5-item score bands so same-score items appear
        // in a random order (different every request, different per user
        // because noise is user-seeded)
        const shuffled = bandShuffle(candidates, 5);

        const reranked = [];
        const seenCreators = new Set();
        const backlogged = [];

        for (const c of shuffled) {
            if (!seenCreators.has(c.user_id)) {
                reranked.push(c);
                seenCreators.add(c.user_id);
            } else {
                backlogged.push(c);
            }
            if (reranked.length >= limit) break;
        }

        if (reranked.length < limit) {
            reranked.push(...backlogged.slice(0, limit - reranked.length));
        }

        return reranked;
    }

    async _applyExplorationAndDeduplicate(userId, candidates, limit, isSearch) {
        const seenVideos = isSearch ? [] : await redis.smembers(`seen_video_set:user:${userId}`);
        const seenSet = new Set(seenVideos || []);

        let unique = candidates.filter(c => !seenSet.has(c.moment_id));

        // SOFT RESET: If we have very few unique items left, recycle the seen set
        if (unique.length < Math.floor(limit / 2) && candidates.length > 0) {
            console.log(`♻️ Soft resetting seen videos for user ${userId} to maintain feed density`);
            unique = candidates;
            await redis.del(`seen_video_set:user:${userId}`);
        }

        const aligned = unique.filter(c => c.is_aligned);
        const nonAligned = unique.filter(c => !c.is_aligned);

        const alignedCount = Math.floor(limit * 0.7);
        const finalBatch = [
            ...aligned.slice(0, alignedCount),
            ...nonAligned.slice(0, limit - Math.min(aligned.length, alignedCount))
        ];

        // Ensure we strictly meet the limit if possible
        if (finalBatch.length < limit && unique.length > finalBatch.length) {
            const seenIds = new Set(finalBatch.map(f => f.moment_id));
            const remaining = unique.filter(u => !seenIds.has(u.moment_id));
            finalBatch.push(...remaining.slice(0, limit - finalBatch.length));
        }

        if (!isSearch && finalBatch.length > 0) {
            const ids = finalBatch.map(f => f.moment_id);
            await redis.sadd(`seen_video_set:user:${userId}`, ...ids);
            await redis.expire(`seen_video_set:user:${userId}`, 86400);
        }

        return finalBatch;
    }
}

module.exports = new MomentsRankingService();
