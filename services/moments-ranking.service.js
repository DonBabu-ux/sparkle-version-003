const redis = require('./redis.service');
const pool = require('../config/database');
const logger = require('../utils/logger');
const sessionInterestService = require('./session-interest.service');

const safeParse = (val) => {
    if (!val) return null;
    if (typeof val === 'object') return val;
    try {
        return JSON.parse(val);
    } catch (e) {
        return val;
    }
};

/**
 * Moments Ranking Service
 * Implements the 1M+ Scale Production Architecture.
 */
class MomentsRankingService {
    
    /**
     * Rebuilds the global candidate pools and stores them in Redis.
     * In a production environment, this would run every 2-5 seconds via a worker.
     */
    async generateCandidatePools(force = false) {
        const lockKey = 'lock:moments:pool_regeneration';
        const lastRunKey = 'moments:pool:last_run';
        
        // 1. Throttle: Don't run more than once every 60 seconds unless forced
        if (!force) {
            const lastRun = await redis.get(lastRunKey);
            if (lastRun && (Date.now() - parseInt(lastRun)) < 60000) {
                return;
            }
        }

        const isLocked = await redis.set(lockKey, 'locked', 30, 'NX');
        if (!isLocked) return;

        try {
            await redis.set(lastRunKey, Date.now().toString());
            logger.info('Generating Moments Candidate Pools (Redis Shards)...');
            
            // 1. Trending Pool
            const [trending] = await pool.query(`
                SELECT m.*, u.username, u.name as user_name, u.avatar_url,
                       ((COALESCE(m.like_count, 0) * 5.0 + COALESCE(m.comment_count, 0) * 10.0 + COALESCE(m.share_count, 0) * 15.0 + 1.0) 
                       / (COALESCE(m.view_count, 0) + 10.0)) * IFNULL(m.completion_rate, 1.0) * IFNULL(m.quality_score, 1.0) as base_score
                FROM moments m
                JOIN users u ON m.user_id = u.user_id
                WHERE m.created_at > DATE_SUB(NOW(), INTERVAL 48 HOUR)
                ORDER BY base_score DESC LIMIT 200
            `);
            await redis.set('pool:trending:shard_01', JSON.stringify(trending), 300);

            // 2. Category Pools
            const categories = ['Sports', 'Technology', 'Entertainment', 'Academic', 'Social', 'Music', 'Lifestyle', 'Gaming', 'Comedy', 'Education', 'Politics', 'Viral', 'Dance', 'Nature', 'Fashion', 'Health', 'Travel'];
            for (const cat of categories) {
                const [catMoments] = await pool.query(`
                    SELECT m.*, u.username, u.name as user_name, u.avatar_url,
                           ((COALESCE(m.like_count, 0) * 5.0 + COALESCE(m.comment_count, 0) * 10.0 + COALESCE(m.share_count, 0) * 15.0 + 1.0) 
                           / (COALESCE(m.view_count, 0) + 10.0)) * IFNULL(m.completion_rate, 1.0) * IFNULL(m.quality_score, 1.0) as base_score
                    FROM moments m
                    JOIN users u ON m.user_id = u.user_id
                    WHERE m.category = ?
                    ORDER BY m.created_at DESC LIMIT 100
                `, [cat]);
                if (catMoments.length > 0) {
                    await redis.set(`pool:category:${cat}:shard_01`, JSON.stringify(catMoments), 600);
                }
            }

            // 3. High-Engagement Strangers Pool
            const [strangers] = await pool.query(`
                SELECT m.*, u.username, u.name as user_name, u.avatar_url,
                       ((COALESCE(m.like_count, 0) * 5.0 + COALESCE(m.comment_count, 0) * 10.0 + COALESCE(m.share_count, 0) * 15.0 + 1.0) 
                       / (COALESCE(m.view_count, 0) + 10.0)) as base_score
                FROM moments m
                JOIN users u ON m.user_id = u.user_id
                WHERE m.like_count > 10
                ORDER BY RAND() LIMIT 100
            `);
            await redis.set('pool:strangers:shard_01', JSON.stringify(strangers), 300);

            logger.info('Candidate Pools successfully generated and cached in Redis.');
        } catch (error) {
            logger.error('Error generating candidate pools:', error);
        } finally {
            await redis.del('lock:moments:pool_regeneration');
        }
    }

    /**
     * Gets Follower Pool dynamically (since it varies per user).
     * For 1M+ scale, this would also use Redis pre-computed edge lists.
     */
    async getFollowingPool(userId) {
        const [following] = await pool.query(`
            SELECT m.*, u.username, u.name as user_name, u.avatar_url,
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
     * FULL PRODUCTION PIPELINE: Retrieval -> Scoring -> Reranking -> Exploration
     */
    async getRankedFeed(userId, limit = 8, options = {}) {
        const { query, offset = 0 } = options;
        
        // --- STAGE 1: RETRIEVAL ---
        // For paging, we only rebuild the pool on page 0
        if (offset === 0) {
            this.generateCandidatePools().catch(() => {});
        }

        const candidates = await this._retrieveCandidates(userId, query, offset);
        
        // --- STAGE 2: SCORING ---
        const scoredCandidates = await this._scoreCandidates(userId, candidates, query);
        
        // --- STAGE 3: RERANKING ---
        const reranked = this._rerank(scoredCandidates, limit);
        
        // --- STAGE 4: EXPLORATION INJECTION ---
        const finalBatch = await this._applyExplorationAndDeduplicate(userId, reranked, limit, !!query);

        return finalBatch;
    }

    async _retrieveCandidates(userId, query, offset = 0) {
        let candidates = [];
        const pools = ['pool:trending:shard_01', 'pool:strangers:shard_01'];
        
        // Always include basic discovery pools
        for (const poolKey of pools) {
            const raw = await redis.get(poolKey);
            const data = safeParse(raw);
            if (Array.isArray(data)) candidates.push(...data);
        }

        // Include interest pools (SIV)
        const sivProfile = await sessionInterestService.getSessionProfile(userId);
        for (const cat of Object.keys(sivProfile)) {
            const raw = await redis.get(`pool:category:${cat}:shard_01`);
            const data = safeParse(raw);
            if (Array.isArray(data)) candidates.push(...data);
        }

        // Include Following pool
        const following = await this.getFollowingPool(userId);
        candidates.push(...following);

        // --- DATABASE FALLBACK & PAGING ---
        // If we are paging deep or Redis is cold, fetch from DB
        if (candidates.length < 20 || offset > 0) {
            const [dbItems] = await pool.query(`
                SELECT m.*, u.username, u.name as user_name, u.avatar_url, 0.4 as base_score
                FROM moments m
                JOIN users u ON m.user_id = u.user_id
                ORDER BY m.created_at DESC 
                LIMIT ? OFFSET ?
            `, [50, offset]);
            candidates.push(...dbItems);
        }

        // Filter by Query if present
        if (query) {
            const normalizedQ = query.toLowerCase();
            const filtered = candidates.filter(c => 
                (c.caption && c.caption.toLowerCase().includes(normalizedQ)) ||
                (c.category && c.category.toLowerCase() === normalizedQ) ||
                (c.username && c.username.toLowerCase().includes(normalizedQ))
            );
            if (filtered.length >= 5) return filtered;
        }

        // Deduplicate candidates before returning (important for mixed sources)
        const uniqueMap = new Map();
        candidates.forEach(c => uniqueMap.set(c.moment_id, c));
        return Array.from(uniqueMap.values());
    }

    async _scoreCandidates(userId, candidates, query) {
        const sivProfile = await sessionInterestService.getSessionProfile(userId);
        const following = await this.getFollowingPool(userId);
        const followingIds = new Set(following.map(f => f.moment_id));

        return candidates.map(m => {
            let baseScore = Number(m.base_score) || 1.0;
            
            // Interest Match (I) with intent lock-in guard
            let interestMatch = 1.0;
            if (m.category && sivProfile[m.category]) {
                const weight = sivProfile[m.category];
                interestMatch = Math.min(1.8, 1.0 + (weight / 100));
            }

            // Affinity Boost (F)
            let affinityBoost = followingIds.has(m.moment_id) ? 1.2 : 1.0;
            if (m.user_id === userId) affinityBoost = 0.05;

            // Time Decay (T) - Gravity 0.8
            const ageHours = (Date.now() - new Date(m.created_at).getTime()) / (1000 * 60 * 60);
            const timeDecay = 1.0 / Math.pow(Math.max(ageHours, 0) + 2, 0.8);

            // Scoring Formula
            const finalScore = (baseScore * interestMatch * affinityBoost * timeDecay) + (Math.random() * 0.05);
            
            return { 
                ...m, 
                exploration_score: finalScore, 
                is_aligned: interestMatch > 1.0 || (query && m.category?.toLowerCase() === query.toLowerCase())
            };
        });
    }

    _rerank(candidates, limit) {
        // Sort by initial score
        candidates.sort((a, b) => b.exploration_score - a.exploration_score);

        // Apply Creator Spacing (Prevent two videos from same creator in a row)
        const reranked = [];
        const seenCreators = new Set();
        const backlogged = [];

        for (const c of candidates) {
            if (!seenCreators.has(c.user_id)) {
                reranked.push(c);
                seenCreators.add(c.user_id);
            } else {
                backlogged.push(c);
            }
            if (reranked.length >= limit) break;
        }

        // Fill remaining from backlog if needed
        if (reranked.length < limit) {
            reranked.push(...backlogged.slice(0, limit - reranked.length));
        }

        return reranked;
    }

    async _applyExplorationAndDeduplicate(userId, candidates, limit, isSearch) {
        // Fetch seen set unless it's an explicit search
        const seenVideos = isSearch ? [] : await redis.smembers(`seen_video_set:user:${userId}`);
        const seenSet = new Set(seenVideos || []);

        // Filter seen
        let unique = candidates.filter(c => !seenSet.has(c.moment_id));

        if (unique.length === 0 && candidates.length > 0) {
            // User has seen all candidates in the current pool/page.
            // Recycle the candidates so the feed doesn't appear empty.
            unique = candidates;
            // Optionally, clear the seen set to restart discovery
            await redis.del(`seen_video_set:user:${userId}`);
        }

        // Enforce 70/20/10 Rule
        const aligned = unique.filter(c => c.is_aligned);
        const nonAligned = unique.filter(c => !c.is_aligned);
        
        const alignedCount = Math.floor(limit * 0.7);
        const adjacentCount = Math.floor(limit * 0.2);
        const randomCount = limit - alignedCount - adjacentCount;

        const finalBatch = [
            ...aligned.slice(0, alignedCount),
            ...nonAligned.slice(0, adjacentCount),
            ...nonAligned.sort(() => Math.random() - 0.5).slice(0, randomCount)
        ];

        // Fill to limit
        if (finalBatch.length < limit && unique.length > finalBatch.length) {
            const remaining = unique.filter(u => !finalBatch.find(f => f.moment_id === u.moment_id));
            finalBatch.push(...remaining.slice(0, limit - finalBatch.length));
        }

        // Persist seen set
        if (!isSearch && finalBatch.length > 0) {
            const ids = finalBatch.map(f => f.moment_id);
            await redis.sadd(`seen_video_set:user:${userId}`, ...ids);
            await redis.expire(`seen_video_set:user:${userId}`, 86400);
        }

        return finalBatch;
    }
}

module.exports = new MomentsRankingService();
