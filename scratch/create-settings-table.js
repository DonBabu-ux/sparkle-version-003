require('dotenv').config();
const pool = require('../config/database');

async function run() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS marketplace_message_settings (
                user_id VARCHAR(36) PRIMARY KEY,
                who_can_message_me ENUM('everyone', 'vouched_only', 'none') DEFAULT 'everyone',
                message_filter TINYINT(1) DEFAULT 1,
                read_receipts TINYINT(1) DEFAULT 1,
                typing_indicators TINYINT(1) DEFAULT 1,
                show_online_status TINYINT(1) DEFAULT 1,
                auto_reply_enabled TINYINT(1) DEFAULT 0,
                auto_reply_text TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            )
        `);
        console.log('Success: marketplace_message_settings table created');
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}
run();
