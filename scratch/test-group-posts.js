const pool = require('./config/db');

async function test() {
    try {
        const [groups] = await pool.query('SELECT group_id FROM groups LIMIT 1');
        if (groups.length === 0) {
            console.log('No groups found.');
            process.exit(0);
        }
        const groupId = groups[0].group_id;
        
        const [posts] = await pool.query(`SELECT p.*, p.media_url, 
                    u.username, u.avatar_url, g.name AS group_name, g.icon_url AS group_icon,
                    (SELECT COUNT(*) FROM sparks s WHERE s.post_id = p.post_id) as spark_count,
                    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id) as comment_count,
                    (SELECT JSON_ARRAYAGG(JSON_OBJECT('url', pm.media_url, 'type', pm.media_type)) 
                     FROM post_media pm WHERE pm.post_id = p.post_id ORDER BY pm.upload_order ASC) as media_files
             FROM posts p
             JOIN users u ON p.user_id = u.user_id
             JOIN groups g ON p.group_id = g.group_id
             WHERE p.group_id = ?
             ORDER BY p.created_at DESC
             LIMIT ? OFFSET ?`, [groupId, 10, 0]);
             
        console.log("Posts fetched successfully:", posts.length);
    } catch (err) {
        console.error("Error:", err);
    }
    process.exit(0);
}

test();
