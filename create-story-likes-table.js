const pool = require('./config/database');

async function createStoryLikesTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS story_likes (
                like_id CHAR(36) NOT NULL PRIMARY KEY,
                story_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_like (story_id, user_id),
                FOREIGN KEY (story_id) REFERENCES stories(story_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('story_likes table ensured');
    } catch (err) {
        console.error('Failed to create story_likes table:', err.message);
    }
}

createStoryLikesTable();
