require('dotenv').config();
const pool = require('./config/database');

async function testQuery() {
    try {
        const currentUserId = 'cc77d853-90d5-4512-8874-912bfa4e74f1'; // dummy or actual if possible
        const params = [currentUserId, currentUserId, currentUserId, currentUserId];
        
        // Simplified query for testing
        let q = `
            SELECT 
                m.*,
                u.username, u.name as user_name, u.avatar_url,
                m.like_count as likes, m.comment_count as comments, m.share_count as shares,
                (SELECT COUNT(*) FROM moment_likes WHERE moment_id = m.moment_id AND user_id = ?) as is_liked,
                (SELECT COUNT(*) FROM saved_moments WHERE moment_id = m.moment_id AND user_id = ?) as is_saved,
                (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = m.user_id) as is_following,
                (SELECT COUNT(*) FROM moments m2 WHERE m2.moment_id = m.moment_id AND EXISTS (
                    SELECT 1 FROM moment_likes ml 
                    JOIN follows f ON ml.user_id = f.following_id 
                    WHERE ml.moment_id = m.moment_id AND f.follower_id = ?
                )) as friend_interaction_count
            FROM moments m
            JOIN users u ON m.user_id = u.user_id
            LIMIT 10
        `;
        
        console.log("Running query...");
        const [rows] = await pool.query(q, params);
        console.log("Query successful, returned", rows.length, "rows");
        if (rows.length > 0) {
            console.log("First row likes:", rows[0].likes);
        }
    } catch (err) {
        console.error("Query failed:", err);
    } finally {
        process.exit();
    }
}

testQuery();
