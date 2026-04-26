const pool = require('./config/database');

async function migrate() {
    try {
        console.log('Starting story features migration...');
        
        // Add comments_enabled column
        await pool.query(`
            ALTER TABLE stories 
            ADD COLUMN IF NOT EXISTS comments_enabled BOOLEAN DEFAULT 1
        `);
        
        // Add is_archived column
        await pool.query(`
            ALTER TABLE stories 
            ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT 0
        `);

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
