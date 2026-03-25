require('dotenv').config();
const pool = require('./config/database');

async function run() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_blocks (
                block_id CHAR(36) NOT NULL,
                blocker_id CHAR(36) NOT NULL,
                blocked_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (block_id),
                UNIQUE KEY unique_block (blocker_id, blocked_id),
                FOREIGN KEY (blocker_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (blocked_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('✅ user_blocks table created (or already exists)');
    } catch (e) {
        console.error('❌ Error:', e.message);
    }
    process.exit(0);
}
run();
