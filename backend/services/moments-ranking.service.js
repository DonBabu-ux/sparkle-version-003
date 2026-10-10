const redis = require('./redis.service');
const pool = require('../config/database');
const { safeQuery } = pool; // safeQuery is attached to pool export
const logger = require('../utils/logger');
const sessionInterestService = require('./session-interest.service');

const CATEGORIES = ['Sports', 'Technology', 'Entertainment', 'Academic', 'Social', 'Music', 'Lifestyle', 'Gaming', 'Comedy', 'Education', 'Politics', 'Viral', 'Dance', 'Nature', 'Fashion', 'Health', 'Travel'];

// ranked_feed entries live 30s; kicking a background refresh on EVERY warm hit
// cost ~10-25 redis commands each. One refresh per TTL window per user is the
// freshest a refresh can usefully be — any faster is pure command burn.
const FEED_REFRESH_MIN_INTERVAL_MS = 30000;
const FEED_REFRESH_TRACK_MAX = 5000;

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
    if (!Array.isArray(arr)) return [];
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

    constructor() {
        // userId -> epoch ms of last _refreshFeedCache kick (see _shouldRefreshFeed)
        this._lastFeedRefreshAt = new Map();
        // Singleflight: feedKey -> in-flight pipeline promise. With N concurrent
        // users this caps pipeline runs at one per user instead of one per request.
        this._inflightFeeds = new Map();
        // Singleflight: the offset-0 DB fallback query is identical for every
        // user — share ONE MySQL round-trip across all cold users.
        this._inflightDbFallback = null;
    }

    /**
     * Rebuilds the global candidate pools in Redis.
     * OPTIMIZED: 19 queries collapsed into 2 via window functions.
     * Against a remote DB (~240ms RTT) with a pool of 3, firing 19 parallel
     * queries caused queue amplification (1s → 6s+). Two queries fit the pool
     * and cut round-trips by ~90%.
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
            logger.info('Generating Moments Candidate Pools (2 queries)...');

            const SCORE = `((COALESCE(m.like_count, 0) * 5.0 + COALESCE(m.comment_count, 0) * 10.0 + COALESCE(m.share_count, 0) * 15.0 + 1.0) / (COALESCE(m.view_count, 0) + 10.0))`;
            const SCORE_ENRICHED = `(${SCORE} * IFNULL(m.completion_rate, 1.0) * IFNULL(m.quality_score, 1.0))`;
            const COLS = `m.moment_id, m.user_id, m.caption, m.media_url, m.streaming_url, m.thumbnail_url, m.media_type,
                           m.category, m.resolution, m.bitrate, m.like_count, m.comment_count, m.share_count, m.view_count,
                           m.created_at, m.completion_rate, m.quality_score,
                           u.username, u.name as user_name, u.avatar_url`;
            // Outer projections must use bare column names (no m./u. aliases —
            // those only exist inside the derived table).
            const COLS_OUTER = `moment_id, user_id, caption, media_url, streaming_url, thumbnail_url, media_type,
                                category, resolution, bitrate, like_count, comment_count, share_count, view_count,
                                created_at, completion_rate, quality_score, username, user_name, avatar_url`;

            // ── 2 queries instead of 19 (single scan each, fits pool of 3) ─────
            const [catRes, mixRes] = await Promise.allSettled([
                // Query 1: ALL 17 category pools in one scan via ROW_NUMBER()
                safeQuery(`
                    SELECT ${COLS_OUTER}, base_score FROM (
                        SELECT ${COLS}, ${SCORE_ENRICHED} as base_score,
                               ROW_NUMBER() OVER (PARTITION BY LOWER(m.category) ORDER BY m.created_at DESC) as rn
                        FROM moments m
                        JOIN users u ON m.user_id = u.user_id
                    ) t WHERE t.rn <= 100
                `),
                // Query 2: trending (48h by score) + strangers (liked, random) via UNION
                safeQuery(`
                    SELECT 'trending' as pool_name, ${COLS_OUTER}, base_score FROM (
                        SELECT ${COLS}, ${SCORE_ENRICHED} as base_score
                        FROM moments m JOIN users u ON m.user_id = u.user_id
                        WHERE m.created_at > DATE_SUB(NOW(), INTERVAL 48 HOUR)
                        ORDER BY base_score DESC LIMIT 200
                    ) t
                    UNION ALL
                    SELECT 'strangers' as pool_name, ${COLS_OUTER}, base_score FROM (
                        SELECT ${COLS}, ${SCORE} as base_score
                        FROM moments m JOIN users u ON m.user_id = u.user_id
                        WHERE m.like_count > 10
                        ORDER BY RAND() LIMIT 100
                    ) t
                `)
            ]);

            // ── Bucket category rows in JS (single pass) ──────────────────────
            const catRows = catRes.status === 'fulfilled' ? catRes.value : [];
            const mixRows = mixRes.status === 'fulfilled' ? mixRes.value : [];
            const categoryBuckets = new Map();
            for (const row of catRows) {
                const key = (row.category || '').toLowerCase();
                let arr = categoryBuckets.get(key);
                if (!arr) { arr = []; categoryBuckets.set(key, arr); }
                if (arr.length < 100) arr.push(row);
            }
            const trendingData = mixRows.filter(r => r.pool_name === 'trending');
            const strangersData = mixRows.filter(r => r.pool_name === 'strangers');

            // ── Write all results to Redis simultaneously ───────────────────
            // Only write non-empty pools so a failed query keeps the prior cache.
            const writes = [];
            if (trendingData.length > 0) {
                writes.push(redis.set('pool:trending:shard_01', JSON.stringify(trendingData), 300));
            }
            if (strangersData.length > 0) {
                writes.push(redis.set('pool:strangers:shard_01', JSON.stringify(strangersData), 300));
            }
            CATEGORIES.forEach((cat) => {
                const rows = categoryBuckets.get(cat.toLowerCase());
                if (rows && rows.length > 0) {
                    writes.push(redis.set(`pool:category:${cat}:shard_01`, JSON.stringify(rows), 600));
                }
            });

            if (writes.length > 0) {
                await Promise.all(writes);
            }

            logger.info('Candidate Pools generated and cached.');
        } catch (error) {
            logger.error('Error generating candidate pools:', error);
        } finally {
            await redis.del('lock:moments:pool_regeneration');
        }
    }

    /**
     * @param timeoutMs — when > 0, race the misses-path query against this
     * budget. On timeout the empty pool is returned immediately (first paint
     * wins); the query keeps running in the background and warms the 60s
     * cache so the NEXT open has full affinity data.
     */
    async getFollowingPool(userId, timeoutMs = 0) {
        try {
            // Try Redis cache first
            const cacheKey = `pool:following:${userId}`;
            const cached = await redis.get(cacheKey);
            if (cached) {
                const parsed = safeParse(cached);
                if (Array.isArray(parsed)) return parsed;
            }

            // Query moments from users this person follows
            const queryPromise = safeQuery(`
                SELECT m.moment_id, m.user_id, m.caption, m.media_url, m.streaming_url, m.thumbnail_url, m.media_type,
                       m.category, m.resolution, m.bitrate, m.like_count, m.comment_count, m.share_count, m.view_count,
                       m.created_at, m.completion_rate, m.quality_score,
                       u.username, u.name as user_name, u.avatar_url, 0.7 as base_score
                FROM moments m
                JOIN users u ON m.user_id = u.user_id
                JOIN follows f ON f.following_id = m.user_id AND f.follower_id = ?
                WHERE m.created_at > DATE_SUB(NOW(), INTERVAL 14 DAY)
                ORDER BY m.created_at DESC
                LIMIT 50
            `, [userId]).then(rows => {
                const pool = Array.isArray(rows) ? rows : [];
                // Cache for 60 seconds
                if (pool.length > 0) {
                    redis.set(cacheKey, JSON.stringify(pool), 60).catch(() => { });
                }
                return pool;
            }).catch(err => {
                logger.warn(`[MomentsRanking] getFollowingPool query error for ${userId}: ${err.message}`);
                return [];
            });

            if (timeoutMs > 0) {
                // Let the query continue in background to warm the cache even
                // if we return early; attach a no-op catch so a late failure
                // never becomes an unhandled rejection.
                let timer;
                const timeout = new Promise((resolve) => {
                    timer = setTimeout(() => resolve([]), timeoutMs);
                    timer.unref?.();
                });
                const result = await Promise.race([queryPromise, timeout]);
                clearTimeout(timer);
                return result;
            }

            return await queryPromise;
        } catch (error) {
            logger.warn(`[MomentsRanking] getFollowingPool error for ${userId}: ${error.message}`);
            return []; // Always return an array to prevent "not iterable" crash
        }
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
        const cacheEligible = !query && offset === 0 && !refresh;
        const isSearch = !!query;

        // ── WARM PATH FIRST: one Redis GET, return instantly on hit ──────────
        // The previous design fetched sessionProfile + followingPool in the
        // same Promise.all as the cache read — that made every warm hit WAIT
        // for MySQL (session interest) before returning cached data. Cache
        // check now runs alone; context is only fetched on the cold path.
        if (cacheEligible) {
            const cachedRaw = await redis.get(`ranked_feed:${userId}`);
            if (cachedRaw) {
                const data = safeParse(cachedRaw);
                if (Array.isArray(data) && data.length > 0) {
                    // Kick off background refresh so the NEXT open is also fast
                    // (throttled to once per TTL window per user — see _shouldRefreshFeed)
                    if (this._shouldRefreshFeed(userId)) {
                        this._refreshFeedCache(userId, limit).catch(() => { });
                    }
                    return data;
                }
            }
        }

        // ── COLD PATH: shared context fetched once, in parallel ──────────────
        // followingPool races a 500ms budget: the per-user follows JOIN can't
        // be shared across users, so first paint proceeds without affinity
        // data rather than blocking on it; the query warms the 60s cache.
        const [sivProfile, followingPool, seenVideosRaw] = await Promise.all([
            sessionInterestService.getSessionProfile(userId),
            this.getFollowingPool(userId, 500),
            isSearch ? Promise.resolve(null) : redis.smembers(`seen_video_set:user:${userId}`),
        ]);

        // ── Trigger pool generation (non-blocking) ───────────────────────────
        if (offset === 0) {
            this.generateCandidatePools().catch(() => { });
        }

        // ── SINGLEFLIGHT: concurrent cold requests for the same user share
        // one pipeline run. Without this, N simultaneous opens for one user
        // (and N users' tabs) stampede the pools + DB fallback in parallel.
        const feedKey = `${userId}:${limit}:${offset}:${query || ''}`;
        const inflight = this._inflightFeeds.get(feedKey);
        if (inflight) return inflight;

        const computation = this._runPipeline(
            userId, limit, query, offset, isSearch, cacheEligible,
            sivProfile, followingPool, seenVideosRaw
        );
        this._inflightFeeds.set(feedKey, computation);
        try {
            return await computation;
        } finally {
            this._inflightFeeds.delete(feedKey);
        }
    }

    /**
     * The actual cold-path pipeline (race + fallback). Extracted so the
     * singleflight wrapper in getRankedFeed can share one instance across
     * concurrent callers.
     */
    async _runPipeline(userId, limit, query, offset, isSearch, cacheEligible, sivProfile, followingPool, seenVideosRaw) {
        // RACE: 3.5s budget — fits the ~4 remaining redis/DB rounds at ~450ms
        // REST latency; on timeout the fallback still warms the result cache.
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Ranking Timeout')), 3500));

        try {
            const result = await Promise.race([
                (async () => {
                    const candidates = await this._retrieveCandidates(userId, query, offset, sivProfile, followingPool);
                    const scoredCandidates = this._scoreCandidates(userId, candidates, query, sivProfile, followingPool);
                    const reranked = this._rerank(scoredCandidates, limit);
                    return await this._applyExplorationAndDeduplicate(userId, reranked, limit, isSearch, seenVideosRaw);
                })(),
                timeoutPromise
            ]);

            // ── Cache the result for 30 seconds ──────────────────────────────────
            if (cacheEligible && result.length > 0) {
                redis.set(`ranked_feed:${userId}`, JSON.stringify(result), 30).catch(() => { });
            }

            return result;
        } catch (error) {
            console.warn(`⚠️ Moments Ranking Optimization: ${error.message}. Using fast-path fallback.`);
            // FAST PATH: Direct DB fallback if ranking is too slow
            const rows = await this._getSharedDbFallback(limit, offset);
            // Warm the result cache from the fallback too — otherwise every request
            // stays on the cold path (previously the cache was never written).
            if (cacheEligible && rows.length > 0) {
                redis.set(`ranked_feed:${userId}`, JSON.stringify(rows), 30).catch(() => { });
            }
            return rows;
        }
    }

    /**
     * Shared MySQL fallback — the offset-0 "latest moments" query is identical
     * for every user. Singleflight across users: 100 cold users cause ONE
     * MySQL round-trip, not 100. Pagination offsets run directly (distinct
     * queries, and far less concurrent).
     *
     * The resolved promise stays joinable for a 2s grace window: pipelines
     * arrive staggered (they queue behind per-user session queries on the
     * pool), so without the window each late arrival would start a new flight.
     */
    _getSharedDbFallback(limit, offset) {
        if (offset !== 0) return this._dbFallbackQuery(limit, offset);
        if (!this._inflightDbFallback) {
            const flight = this._dbFallbackQuery(limit, offset).catch(() => []);
            this._inflightDbFallback = flight;
            flight.then(() => setTimeout(() => {
                if (this._inflightDbFallback === flight) this._inflightDbFallback = null;
            }, 2000).unref?.());
        }
        return this._inflightDbFallback;
    }

    _dbFallbackQuery(limit, offset) {
        return safeQuery(`
            SELECT m.moment_id, m.user_id, m.caption, m.media_url, m.streaming_url, m.thumbnail_url, m.media_type,
                   m.category, m.resolution, m.bitrate, m.like_count, m.comment_count, m.share_count, m.view_count,
                   m.created_at, m.completion_rate, m.quality_score,
                   u.username, u.name as user_name, u.avatar_url, 0.4 as base_score
            FROM moments m JOIN users u ON m.user_id = u.user_id
            ORDER BY m.created_at DESC LIMIT ? OFFSET ?
        `, [limit, offset]).then(rows => Array.isArray(rows) ? rows : []);
    }

    /** True at most once per FEED_REFRESH_MIN_INTERVAL_MS per user; records the kick. */
    _shouldRefreshFeed(userId) {
        const now = Date.now();
        const last = this._lastFeedRefreshAt.get(userId) || 0;
        if (now - last < FEED_REFRESH_MIN_INTERVAL_MS) return false;
        if (this._lastFeedRefreshAt.size >= FEED_REFRESH_TRACK_MAX) {
            for (const [k, t] of this._lastFeedRefreshAt) {
                if (now - t >= FEED_REFRESH_MIN_INTERVAL_MS) this._lastFeedRefreshAt.delete(k);
            }
            if (this._lastFeedRefreshAt.size >= FEED_REFRESH_TRACK_MAX) this._lastFeedRefreshAt.clear();
        }
        this._lastFeedRefreshAt.set(userId, now);
        return true;
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
            ...Object.keys(sivProfile || {}).map(cat => `pool:category:${cat}:shard_01`)
        ];

        // Fire pool reads and the DB fallback in ONE round: on cold pools this
        // removes a full sequential ~450ms+ round; when pools are warm the query
        // simply runs alongside the Redis reads at no latency cost.
        // The DB fallback is singleflight-shared across ALL cold users (same
        // query every time) — 100 concurrent cold opens → 1 MySQL round-trip.
        const [poolData, dbItems] = await Promise.all([
            Promise.all(poolKeys.map(k => redis.get(k))),
            this._getSharedDbFallback(50, offset).catch(() => null),
        ]);
        poolData.forEach(raw => {
            const data = safeParse(raw);
            if (Array.isArray(data)) candidates.push(...data);
        });

        if (Array.isArray(followingPool)) {
            candidates.push(...followingPool);
        }

        // DB fallback + paging (fast query, no joins on cold start)
        if ((candidates.length < 20 || offset > 0) && Array.isArray(dbItems)) {
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
        const followingIds = new Set(Array.isArray(followingPool) ? followingPool.map(f => f.moment_id) : []);
        const uSeed = userSeed(userId); // unique per user, consistent within session
        const hasSIV = Object.keys(sivProfile).length > 0;

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

            // Creator Boost Connect Amplification
            let boostMultiplier = Number(m.boost_strength) || (m.is_boosted ? 1.5 : 1.0);

            const finalScore = (baseScore * interestMatch * affinityBoost * timeDecay * boostMultiplier) + explorationNoise;

            return {
                ...m,
                exploration_score: finalScore,
                boost_multiplier: boostMultiplier,
                is_aligned: interestMatch > 1.0 || (query && m.category?.toLowerCase() === query.toLowerCase())
            };
        });
    }

    _rerank(candidates, limit) {
        if (!Array.isArray(candidates)) return [];
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

    async _applyExplorationAndDeduplicate(userId, candidates, limit, isSearch, prefetchedSeen = null) {
        if (!Array.isArray(candidates)) candidates = [];
        let seenVideos = [];
        if (!isSearch) {
            // Use the seen set prefetched in the opening parallel round when given;
            // only fall back to a blocking redis call otherwise (e.g. _refreshFeedCache).
            seenVideos = Array.isArray(prefetchedSeen)
                ? prefetchedSeen
                : await redis.smembers(`seen_video_set:user:${userId}`);
        }
        const seenSet = new Set(Array.isArray(seenVideos) ? seenVideos : []);

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
            const ids = finalBatch.map(f => f.moment_id).filter(Boolean);
            if (ids.length > 0) {
                await redis.sadd(`seen_video_set:user:${userId}`, ...ids);
                await redis.expire(`seen_video_set:user:${userId}`, 86400);
            }
        }

        return finalBatch;
    }
}

module.exports = new MomentsRankingService();
