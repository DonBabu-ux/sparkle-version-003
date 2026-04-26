require('dotenv').config();
const pool = require('./config/database');

async function migrate() {
    try {
        console.log('Starting story features migration...');
        
        // Add comments_enabled column
        try {
            await pool.query(`ALTER TABLE stories ADD COLUMN comments_enabled BOOLEAN DEFAULT 1`);
        } catch (e) { console.log('comments_enabled might already exist'); }
        
        // Add is_archived column
        try {
            await pool.query(`ALTER TABLE stories ADD COLUMN is_archived BOOLEAN DEFAULT 0`);
        } catch (e) { console.log('is_archived might already exist'); }

        // Create story_privacy_blocks table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS story_privacy_blocks (
                block_id CHAR(36) PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                blocked_user_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_block (user_id, blocked_user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        console.log('✅ Migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
