const pool = require('../config/database');

class ProfessionalController {
    async renderProfessionalDashboard(req, res) {
        try {
            const userId = req.user.user_id || req.user.userId;

            // 1. Basic User Stats (Mocked where DB schema lacks tracking e.g. profile views over time)
            const [users] = await pool.query('SELECT * FROM users WHERE user_id = ?', [userId]);
            const user = users[0];

            // Real stats from DB
            const [followersCountRes] = await pool.query('SELECT COUNT(*) as count FROM follows WHERE following_id = ?', [userId]);
            const [followingCountRes] = await pool.query('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?', [userId]);
            const [postsCountRes] = await pool.query('SELECT COUNT(*) as count FROM posts WHERE user_id = ?', [userId]);

            const followers = followersCountRes[0].count;
            const following = followingCountRes[0].count;
            const totalPosts = postsCountRes[0].count;

            // Activity / Interaction stats (Real DB aggregation)
            const [likesRecv] = await pool.query(`
                SELECT COUNT(*) as count FROM sparks 
                WHERE post_id IN (SELECT post_id FROM posts WHERE user_id = ?)
            `, [userId]);

            const [commentsRecv] = await pool.query(`
                SELECT COUNT(*) as count FROM comments 
                WHERE post_id IN (SELECT post_id FROM posts WHERE user_id = ?)
            `, [userId]);

            // Determine followers vs non-followers interactions (Simulation / Estimation since we don't have interaction tracking table with follower state)
            // But we can actually query it!
            const [detailedLikes] = await pool.query(`
                SELECT 
                    SUM(CASE WHEN f.follower_id IS NOT NULL THEN 1 ELSE 0 END) as follower_likes,
                    SUM(CASE WHEN f.follower_id IS NULL THEN 1 ELSE 0 END) as non_follower_likes
                FROM sparks s
                LEFT JOIN follows f ON s.user_id = f.follower_id AND f.following_id = ?
                WHERE s.post_id IN (SELECT post_id FROM posts WHERE user_id = ?)
            `, [userId, userId]);

            const followerLikes = detailedLikes[0].follower_likes || 0;
            const nonFollowerLikes = detailedLikes[0].non_follower_likes || 0;
            
            // For mock metrics requested by tasks
            const profileViews = Math.floor(followers * 2.4) + 124; // Mock
            const followersGrowth = 12.5; // Mock %
            const accountReach = profileViews * 3; // Mock

            // Content Type breakdown (Assuming posts table has media_type or we deduce from media_url)
            const [mediaTypes] = await pool.query(`
                SELECT 
                    SUM(CASE WHEN media_url LIKE '%.mp4%' OR media_url LIKE '%.mov%' THEN 1 ELSE 0 END) as video_count,
                    SUM(CASE WHEN media_url LIKE '%.jpg%' OR media_url LIKE '%.png%' OR media_url LIKE '%.jpeg%' THEN 1 ELSE 0 END) as photo_count,
                    SUM(CASE WHEN media_url IS NULL OR media_url = '' THEN 1 ELSE 0 END) as text_count
                FROM posts WHERE user_id = ?
            `, [userId]);

            const [storyCountRes] = await pool.query('SELECT COUNT(*) as count FROM stories WHERE user_id = ?', [userId]);

            const videos = mediaTypes[0].video_count || 0;
            const photos = mediaTypes[0].photo_count || 0;
            const text = mediaTypes[0].text_count || 0;
            const stories = storyCountRes[0].count;

            const totalContent = videos + photos + text + stories || 1; // avoid division by zero
            const dist = {
                videos: Math.round((videos / totalContent) * 100),
                photos: Math.round(((photos + text) / totalContent) * 100),
                stories: Math.round((stories / totalContent) * 100)
            };

            // Top Content
            // We use likes + comments as a proxy for "views" if views column doesn't exist
            const [topPosts] = await pool.query(`
                SELECT p.*,
                (SELECT COUNT(*) FROM sparks WHERE post_id = p.post_id) as likes,
                (SELECT COUNT(*) FROM comments WHERE post_id = p.post_id) as comments,
                ((SELECT COUNT(*) FROM sparks WHERE post_id = p.post_id) + (SELECT COUNT(*) FROM comments WHERE post_id = p.post_id) * 2) as engagement_score
                FROM posts p
                WHERE p.user_id = ?
                ORDER BY engagement_score DESC
                LIMIT 5
            `, [userId]);

            // Ads/Monetization Mock stored inside localStorage on client side, but we provide base layout logic
            
            res.render('professional-dashboard', {
                title: 'Professional Dashboard - Sparkle',
                user: req.user,
                stats: {
                    followers,
                    following,
                    totalPosts,
                    profileViews,
                    followersGrowth,
                    accountReach,
                    likesRecv: likesRecv[0].count,
                    commentsRecv: commentsRecv[0].count,
                    followerLikes,
                    nonFollowerLikes
                },
                dist,
                topPosts,
                layout: 'layouts/main'
            });
        } catch (error) {
            console.error('Professional Dashboard Error:', error);
            res.status(500).send('Failed to load dashboard');
        }
    }
}

module.exports = new ProfessionalController();
