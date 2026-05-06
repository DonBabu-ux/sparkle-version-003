const cron = require('node-cron');
const pool = require('../config/database');
const redisService = require('../services/redis.service');
const logger = require('../utils/logger');

async function buildCandidatePool() {
    try {
        // 1. Fetch posts without media first
        const [posts] = await pool.query(`
            SELECT p.post_id, p.user_id, p.content, p.media_url, p.media_type, p.post_type, p.campus, 
                   p.group_id, p.location, p.created_at, p.category, p.comments_enabled,
                   u.username, u.name as user_name, u.avatar_url,
                   u.campus as user_affiliation, u.is_private, u.profile_visibility,
                   COALESCE(p.spark_count, 0) as sparks,
                   COALESCE(p.comment_count, 0) as comments,
                   COALESCE(p.share_count, 0) as shares,
                   COALESCE(p.view_count, 0) as views
            FROM posts p
            JOIN users u ON p.user_id = u.user_id
            WHERE p.created_at > NOW() - INTERVAL 30 DAY
            AND (p.scheduled_at IS NULL OR p.scheduled_at <= NOW())
            ORDER BY p.created_at DESC
            LIMIT 1000
        `);

        if (posts && posts.length > 0) {
            // 2. Fetch media for these posts in one go
            const postIds = posts.map(p => p.post_id);
            const [media] = await pool.query(`
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

            await redisService.set('feed:candidate_pool', enrichedPosts, 60); // 60 sec TTL
            logger.info(`🔄 Candidate Pool refreshed with ${enrichedPosts.length} posts`);
        }
    } catch (error) {
        logger.error('Failed to build candidate pool:', error);
    }
}

// Run every 30 seconds
cron.schedule('*/30 * * * * *', buildCandidatePool);

module.exports = { buildCandidatePool };
