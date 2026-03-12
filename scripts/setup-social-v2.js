const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    console.log('🚀 Starting Social Graph Migration (Batch 3)...');

    try {
        // 1. Create follow_requests table
        console.log('--- Creating follow_requests table ---');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS follow_requests (
                request_id CHAR(36) PRIMARY KEY,
                follower_id CHAR(36) NOT NULL,
                following_id CHAR(36) NOT NULL,
                status ENUM('pending', 'accepted', 'declined') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (follower_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (following_id) REFERENCES users(user_id) ON DELETE CASCADE,
                UNIQUE KEY unique_request (follower_id, following_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 2. Ensure user_blocks table exists (it's in db.sql but let's be sure)
        console.log('--- Ensuring user_blocks table exists ---');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS user_blocks (
                block_id CHAR(36) NOT NULL,
                blocker_id CHAR(36) NOT NULL,
                blocked_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (block_id),
                UNIQUE KEY unique_block (blocker_id, blocked_id),
                FOREIGN KEY (blocker_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (blocked_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        console.log('✅ Migration complete!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await connection.end();
    }
}

migrate();
