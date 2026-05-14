const pool = require('./config/database');

const createFcmTable = async () => {
    const query = `
    CREATE TABLE IF NOT EXISTS fcm_tokens (
        token_id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        token VARCHAR(255) NOT NULL,
        device_type ENUM('android', 'ios', 'web') DEFAULT 'android',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (token_id),
        UNIQUE KEY unique_user_token (user_id, token),
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        INDEX idx_user_tokens (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    try {
        await pool.query(query);
        console.log('✅ FCM Tokens table created or already exists.');
    } catch (error) {
        console.error('❌ Error creating FCM Tokens table:', error);
    } finally {
        process.exit();
    }
};

createFcmTable();
