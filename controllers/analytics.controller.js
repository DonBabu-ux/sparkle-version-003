const pool = require('../config/database');

exports.getCreatorStats = async (req, res) => {
    const userId = req.user.user_id;

    try {
        // 1. Get basic user stats (followers, following, posts)
        const [userStats] = await pool.query(
            `SELECT 
                (SELECT COUNT(*) FROM follows WHERE following_id = ?) as followers,
                (SELECT COUNT(*) FROM follows WHERE follower_id = ?) as following,
                (SELECT COUNT(*) FROM posts WHERE user_id = ?) as posts_count,
                u.profile_views
             FROM users u WHERE u.user_id = ?`,
            [userId, userId, userId, userId]
        );

        const stats = userStats[0];

        // 2. Get engagement stats (total sparks, comments, shares)
        const [engagementStats] = await pool.query(
            `SELECT 
                SUM(spark_count) as total_sparks,
                SUM(comment_count) as total_comments,
                SUM(share_count) as total_shares
             FROM posts WHERE user_id = ?`,
            [userId]
        );

        const engagement = engagementStats[0];

        // 3. Content distribution
        const [distribution] = await pool.query(
            `SELECT media_type, COUNT(*) as count 
             FROM posts WHERE user_id = ? AND media_type IS NOT NULL
             GROUP BY media_type`,
            [userId]
        );

        // 4. Real Time-Series Data (Last 14 days)
        const [historicalSparks] = await pool.query(
            `SELECT DATE(s.created_at) as date, COUNT(*) as count 
             FROM sparks s
             JOIN posts p ON s.post_id = p.post_id
             WHERE p.user_id = ? AND s.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
             GROUP BY DATE(s.created_at) ORDER BY date ASC`,
            [userId]
        );

        const [historicalFollows] = await pool.query(
            `SELECT DATE(f.created_at) as date, COUNT(*) as count 
             FROM follows f
             WHERE f.following_id = ? AND f.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
             GROUP BY DATE(f.created_at) ORDER BY date ASC`,
            [userId]
        );

        const [historicalComments] = await pool.query(
            `SELECT DATE(c.created_at) as date, COUNT(*) as count 
             FROM comments c
             JOIN posts p ON c.post_id = p.post_id
             WHERE p.user_id = ? AND c.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
             GROUP BY DATE(c.created_at) ORDER BY date ASC`,
            [userId]
        );

        // Helper to fill zero-dates
        const fillSequence = (data, days = 14) => {
            const map = new Map(data.map(item => [new Date(item.date).toISOString().split('T')[0], item.count]));
            const result = [];
            for (let i = days - 1; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                result.push(map.get(dateStr) || 0);
            }
            return result;
        };

        const sparkSeries = fillSequence(historicalSparks);
        const followSeries = fillSequence(historicalFollows);
        const commentSeries = fillSequence(historicalComments);

        // 5. Apply 10% New Creator Boost if joined in last 30 days
        const isNewUser = stats?.joined_at && (new Date().getTime() - new Date(stats.joined_at).getTime()) < (30 * 24 * 60 * 60 * 1000);
        const boostMultiplier = isNewUser ? 1.1 : 1.0;

        const applyBoost = (val) => Math.round(val * boostMultiplier);
        const applySeriesBoost = (arr) => arr.map(applyBoost);

        // 6. Social RPG Reputation Logic (Algorithm 88.2)
        const followers = stats?.followers || 0;
        const totalEngagement = (engagement?.total_sparks || 0) + (engagement?.total_comments || 0);
        
        // Trust Level calculation: based on followers and consistency
        let trustLevel = 1;
        if (followers >= 5000) trustLevel = 5;
        else if (followers >= 1000) trustLevel = 4;
        else if (followers >= 500) trustLevel = 3;
        else if (followers >= 100) trustLevel = 2;

        // Prestige Score: weighted activity index
        const prestigeScore = Math.min(100, Math.round(
            (followers / 1000) * 40 + 
            (totalEngagement / 500) * 40 + 
            ((stats?.posts_count || 0) / 50) * 20
        ));

        res.json({
            profileViews: applyBoost(stats?.profile_views || 0),
            followers: followers,
            totalSparks: applyBoost(engagement?.total_sparks || 0),
            totalComments: applyBoost(engagement?.total_comments || 0),
            totalShares: applyBoost(engagement?.total_shares || 0),
            accountReach: applyBoost((engagement?.total_sparks || 0) * 4 + (engagement?.total_comments || 0) * 10 + (stats?.followers || 0) * 5),
            distribution: distribution ? distribution.reduce((acc, curr) => {
                acc[curr.media_type] = curr.count;
                return acc;
            }, {}) : {},
            series: {
                sparks: applySeriesBoost(sparkSeries),
                follows: applySeriesBoost(followSeries),
                comments: applySeriesBoost(commentSeries),
                engagement: applySeriesBoost(sparkSeries).map((s, i) => s + applySeriesBoost(commentSeries)[i])
            },
            reputation: {
                trustLevel,
                prestigeScore,
                isVerified: !!stats?.is_verified,
                joinedAt: stats?.joined_at
            },
            isBoosted: isNewUser
        });

    } catch (error) {
        console.error('Analytics Error:', error);
        res.status(500).json({ message: 'Failed to fetch analytics' });
    }
};
