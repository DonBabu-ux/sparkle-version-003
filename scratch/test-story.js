require('dotenv').config();
const pool = require('../config/database');

async function testStory() {
    try {
        console.log("Testing insert into stories...");
        const userId = 'f8637979-873e-4d33-b92a-32ef53a87174'; // Using the user's ID
        const storyId = require('crypto').randomUUID();
        const stickersJson = JSON.stringify([{ type: 'text', config: { text: 'Test 😊' } }]);
        
        await pool.query(
            `INSERT INTO stories (
                story_id, user_id, media_url, media_type, caption, 
                background, audio_url, audio_source, audio_start, audio_duration,
                like_count, share_count, expires_at, parent_story_id, stickers,
                music_info, type, collage_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?)`,
            [
                storyId, userId, 'text', 'text', 'Hello from test ✅', 
                null, null, null, 0, 15, 
                new Date(Date.now() + 86400000), null, stickersJson,
                null, 'text', null
            ]
        );
        console.log("Successfully inserted test story.");
        
        // Clean up
        await pool.query('DELETE FROM stories WHERE story_id = ?', [storyId]);
        process.exit(0);
    } catch (err) {
        console.error("Story insertion failed:", err.message);
        process.exit(1);
    }
}

testStory();
