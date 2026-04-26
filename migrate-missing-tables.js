require('dotenv').config();
const pool = require('./config/database');

async function migrate() {
    try {
        console.log('🚀 Starting Missing Tables Migration...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS story_views (
                view_id CHAR(36) NOT NULL PRIMARY KEY,
                story_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_story_view (story_id, user_id),
                FOREIGN KEY (story_id) REFERENCES stories(story_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS story_privacy_blocks (
                block_id CHAR(36) NOT NULL PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                blocked_user_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_story_block (user_id, blocked_user_id),
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (blocked_user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        console.log('✅ Missing Tables Migration Completed Successfully!');
    } catch (error) {
        console.error('❌ Migration Failed:', error);
    } finally {
        process.exit();
    }
}

migrate();
