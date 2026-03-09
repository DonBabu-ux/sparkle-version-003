require('dotenv').config();
const mysql = require('mysql2/promise');

async function test() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
    });

    try {
        console.log('🔍 Testing sparkMoment logic...');

        // Let's find a moment to test with
        const [moments] = await pool.query('SELECT moment_id, user_id FROM moments LIMIT 1');
        if (moments.length === 0) {
            console.log('❌ No moments found to test with.');
            return;
        }

        const id = moments[0].moment_id;
        const userId = moments[0].user_id; // Liked by owner for test

        console.log(`Moment ID: ${id}, User ID: ${userId}`);

        // Try to check if already liked
        const [existing] = await pool.query(
            'SELECT * FROM moment_likes WHERE moment_id = ? AND user_id = ?',
            [id, userId]
        );
        console.log('Existing likes:', existing.length);

        // Try to perform the like/unlike logic
        if (existing.length > 0) {
            console.log('🔄 Unliking...');
            await pool.query('DELETE FROM moment_likes WHERE moment_id = ? AND user_id = ?', [id, userId]);
            await pool.query('UPDATE moments SET like_count = like_count - 1 WHERE moment_id = ?', [id]);
        } else {
            console.log('🔄 Liking...');
            await pool.query('INSERT INTO moment_likes (moment_id, user_id) VALUES (?, ?)', [id, userId]);
            await pool.query('UPDATE moments SET like_count = like_count + 1 WHERE moment_id = ?', [id]);

            // Notification logic
            const [moment] = await pool.query('SELECT user_id FROM moments WHERE moment_id = ?', [id]);
            if (moment[0]) {
                console.log('🔔 Creating notification...');
                try {
                    await pool.query(
                        `INSERT INTO notifications 
                        (notification_id, user_id, type, title, content, related_id, related_type, actor_id, action_url) 
                        VALUES (UUID(), ?, 'spark', 'Moment Sparked!', 'Someone sparked your moment.', ?, 'moment', ?, CONCAT('/moments/', ?))`,
                        [moment[0].user_id, id, userId, id]
                    );
                    console.log('✅ Notification created.');
                } catch (notiError) {
                    console.error('❌ Notification failed (maybe table missing):', notiError.message);
                }
            }
        }

        const [result] = await pool.query('SELECT like_count FROM moments WHERE moment_id = ?', [id]);
        console.log('New like count:', result[0]?.like_count);
        console.log('✨ Test logic completed successfully!');

    } catch (err) {
        console.error('💥 CRASH in test script:', err);
    } finally {
        await pool.end();
    }
}

test();
