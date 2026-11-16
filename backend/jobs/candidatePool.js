const cron = require('node-cron');
const { safeQuery } = require('../config/database');
const redisService = require('../services/redis.service');
const logger = require('../utils/logger');
const { queryFeedWindowed, hasMediaPost, fetchMediaTopUp, topUpMedia, MEDIA_TOP_UP_MIN } = require('../utils/feedRecency');

async function buildCandidatePool() {
    try {
        // 1. Fetch posts for the pool, widening the recency window when the
        // strict 30-day window yields too few posts (see utils/feedRecency.js)
        let posts = await queryFeedWindowed(safeQuery, {
            select: `p.post_id, p.user_id, p.content, p.media_url, p.media_type, p.post_type, p.campus,
                   p.group_id, p.location, p.created_at, p.category, p.comments_enabled, p.is_seed,
                   u.username, u.name as user_name, u.avatar_url,
                   u.campus as user_affiliation, u.is_private, u.profile_visibility,
                   COALESCE(p.spark_count, 0) as sparks,
                   COALESCE(p.comment_count, 0) as comments,
                   COALESCE(p.share_count, 0) as shares,
                   COALESCE(p.view_count, 0) as views`,
            from: 'posts p JOIN users u ON p.user_id = u.user_id',
            // The pool feeds the HOME feed only, which excludes group posts
            // (models/Post.js getFeed) — fetching them here wastes the LIMIT
            // and caps the pool with rows the feed will drop.
            extraWhere: 'AND (p.scheduled_at IS NULL OR p.scheduled_at <= NOW()) AND p.group_id IS NULL',
            tail: 'ORDER BY p.created_at DESC LIMIT 150',
        });

        // 2. Media guarantee — the recency slice can exclude every media post
        // (newest media older than the LIMIT cutoff), leaving the dashboard
        // text-only. Top up with recent media posts until the minimum is met.
        if (posts.filter(hasMediaPost).length < MEDIA_TOP_UP_MIN) {
            const mediaTopUp = await fetchMediaTopUp(
                safeQuery,
                {
                    select: `p.post_id, p.user_id, p.content, p.media_url, p.media_type, p.post_type, p.campus,
                           p.group_id, p.location, p.created_at, p.category, p.comments_enabled, p.is_seed,
                           u.username, u.name as user_name, u.avatar_url,
                           u.campus as user_affiliation, u.is_private, u.profile_visibility,
                           COALESCE(p.spark_count, 0) as sparks,
                           COALESCE(p.comment_count, 0) as comments,
                           COALESCE(p.share_count, 0) as shares,
                           COALESCE(p.view_count, 0) as views`,
                    from: 'posts p JOIN users u ON p.user_id = u.user_id',
                    extraWhere: 'AND (p.scheduled_at IS NULL OR p.scheduled_at <= NOW()) AND p.group_id IS NULL',
                },
                new Set(posts.map(p => p.post_id))
            );
            const topped = topUpMedia(posts, mediaTopUp);
            if (topped.length > posts.length) {
                logger.info(`🖼️ Candidate Pool media top-up: +${topped.length - posts.length} media posts`);
            }
            posts = topped;
        }

        if (posts && posts.length > 0) {
            // 2. Fetch media for these posts in one go
            const postIds = posts.map(p => p.post_id);
            const media = await safeQuery(`
                SELECT post_id, media_url as url, media_type as type 
                FROM post_media 
                WHERE post_id IN (?) 
                ORDER BY upload_order ASC
            `, [postIds]);

            // 3. Map media to posts
            const mediaMap = {};
            media.forEach(m => {
                if (!mediaMap[m.post_id]) mediaMap[m.post_id] = [];
                mediaMap[m.post_id].push({ url: m.url, type: m.type });
            });

            const enrichedPosts = posts.map(p => ({
                ...p,
                media_files: mediaMap[p.post_id] || []
            }));

            await redisService.set('feed:candidate_pool', enrichedPosts, 300); // 300 sec TTL
            logger.info(`🔄 Candidate Pool refreshed with ${enrichedPosts.length} posts`);
        }
    } catch (error) {
        const errorMsg = error?.message || String(error).slice(0, 200);
        logger.error('Failed to build candidate pool: ' + errorMsg);
    }
}

// Run every 3 minutes to avoid DB connection pool starvation
cron.schedule('0 */3 * * * *', buildCandidatePool);

module.exports = { buildCandidatePool };
