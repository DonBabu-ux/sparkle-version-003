require('dotenv').config();
const pool = require('../config/database');

async function migrate() {
    try {
        console.log('🚀 Starting Poll Discovery Engine Migration...');

        // 1. Poll Predictions Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS poll_predictions (
                prediction_id CHAR(36) PRIMARY KEY,
                poll_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                option_id CHAR(36) NOT NULL,
                is_correct TINYINT(1) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_prediction (poll_id, user_id),
                FOREIGN KEY (poll_id) REFERENCES polls(poll_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✅ Created poll_predictions table');

        // 2. Poll Comments Table (Dedicated for Hot Debates)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS poll_comments (
                comment_id CHAR(36) PRIMARY KEY,
                poll_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                content TEXT NOT NULL,
                parent_id CHAR(36) DEFAULT NULL,
                like_count INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (poll_id) REFERENCES polls(poll_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✅ Created poll_comments table');

        // 3. Update Polls Table for Advanced Discovery
        // Check if columns exist first
        const [cols] = await pool.query('DESCRIBE polls');
        const colNames = cols.map(c => c.Field);

        if (!colNames.includes('category')) {
            await pool.query('ALTER TABLE polls ADD COLUMN category VARCHAR(50) DEFAULT "General"');
            console.log('✅ Added category column to polls');
        }
        if (!colNames.includes('comment_count')) {
            await pool.query('ALTER TABLE polls ADD COLUMN comment_count INT DEFAULT 0');
            console.log('✅ Added comment_count column to polls');
        }
        if (!colNames.includes('share_count')) {
            await pool.query('ALTER TABLE polls ADD COLUMN share_count INT DEFAULT 0');
            console.log('✅ Added share_count column to polls');
        }

        console.log('✨ Migration Complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrate();
