require('dotenv').config();
const pool = require('./config/database');
async function test() {
    try {
        const userId = 'dummy';
        console.log('Testing query 1...');
        await pool.query(`
            SELECT 
                m.moment_id,
                m.user_id,
                m.caption,
                m.media_url,
                m.media_type,
                m.like_count,
                m.comment_count,
                m.share_count,
                m.created_at,
                m.category,
                u.username,
                u.name as user_name,
                u.avatar_url,
                (SELECT COUNT(*) FROM follows WHERE following_id = m.user_id) as follower_count,
                (SELECT COUNT(*) FROM moment_likes WHERE moment_id = m.moment_id AND user_id = ?) as is_liked,
                (SELECT COUNT(*) FROM saved_moments WHERE moment_id = m.moment_id AND user_id = ?) as is_saved,
                (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = m.user_id) as is_following
            FROM moments m 
            JOIN users u ON m.user_id = u.user_id 
            ORDER BY 
                CASE WHEN m.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 2 END,
                m.like_count DESC,
                m.created_at DESC
            LIMIT 50
        `, [userId, userId, userId]);
        console.log('Query 1 OK');

        console.log('Testing query 2...');
        await pool.query(`
            SELECT 
                hashtag,
                COUNT(*) as usage_count,
                MAX(created_at) as last_used
            FROM moment_hashtags 
            WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY hashtag
            ORDER BY usage_count DESC, last_used DESC
            LIMIT 10
        `);
        console.log('Query 2 OK');

        console.log('Testing query 3...');
        await pool.query(`
            SELECT 
                u.user_id,
                u.username,
                u.name,
                u.avatar_url,
                (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) as follower_count
            FROM users u
            WHERE u.user_id != ? 
            AND u.user_id NOT IN (
                SELECT following_id FROM follows WHERE follower_id = ?
            )
            ORDER BY RAND()
            LIMIT 5
        `, [userId, userId]);
        console.log('Query 3 OK');
        
        console.log('Testing Query 4...');
        await pool.query(`
                SELECT DISTINCT category 
                FROM user_interests 
                WHERE user_id = ?
            `, [userId]);
        console.log('Query 4 OK');
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        process.exit();
    }
}
test();
