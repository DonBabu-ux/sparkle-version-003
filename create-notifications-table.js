require('dotenv').config();
const pool = require('./config/database');

async function createNotificationsTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notifications (
              notification_id CHAR(36) NOT NULL,
              user_id CHAR(36) NOT NULL,
              type ENUM('spark', 'comment', 'follow', 'message', 'group_invite', 'achievement', 'mention', 'share', 'marketplace_contact') NOT NULL,
              title VARCHAR(255) NOT NULL,
              content TEXT NOT NULL,
              related_id VARCHAR(50) DEFAULT NULL,
              related_type VARCHAR(50) DEFAULT NULL,
              actor_id CHAR(36) DEFAULT NULL,
              is_read TINYINT(1) DEFAULT 0,
              is_actionable TINYINT(1) DEFAULT 1,
              action_url VARCHAR(500) DEFAULT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              read_at TIMESTAMP NULL DEFAULT NULL,
              PRIMARY KEY (notification_id),
              FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
              FOREIGN KEY (actor_id) REFERENCES users(user_id) ON DELETE SET NULL,
              INDEX idx_notifications_user (user_id, is_read, created_at),
              INDEX idx_notifications_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('Notifications table created successfully.');
    } catch (error) {
        console.error('Error creating notifications table:', error.message);
    } finally {
        process.exit();
    }
}

createNotificationsTable();
