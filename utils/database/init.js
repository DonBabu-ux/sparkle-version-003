const pool = require('../../config/database');

const initNotificationsTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                notification_id CHAR(36) PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                type ENUM('spark', 'comment', 'follow', 'message', 'group_invite', 'achievement', 'mention', 'share') NOT NULL,
                title VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                related_id VARCHAR(50) DEFAULT NULL,
                related_type VARCHAR(50) DEFAULT NULL,
                is_read TINYINT(1) DEFAULT 0,
                is_actionable TINYINT(1) DEFAULT 1,
                action_url VARCHAR(500) DEFAULT NULL,
                actor_id CHAR(36) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                read_at TIMESTAMP NULL DEFAULT NULL,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (actor_id) REFERENCES users(user_id) ON DELETE SET NULL
            )
        `);
        console.log('✅ Notifications table verified');
    } catch (err) {
        console.error('❌ Failed to init notifications table:', err);
    }
};

const initUserInteractionsTables = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_blocks (
                block_id CHAR(36) PRIMARY KEY,
                blocker_id CHAR(36) NOT NULL,
                blocked_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (blocker_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (blocked_id) REFERENCES users(user_id) ON DELETE CASCADE,
                UNIQUE KEY unique_block (blocker_id, blocked_id)
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_reports (
                report_id CHAR(36) PRIMARY KEY,
                reporter_id CHAR(36) NOT NULL,
                reported_id CHAR(36) NOT NULL,
                reason TEXT NOT NULL,
                status ENUM('pending', 'reviewed', 'resolved') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (reporter_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (reported_id) REFERENCES users(user_id) ON DELETE CASCADE
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_mutes (
                mute_id CHAR(36) PRIMARY KEY,
                muter_id CHAR(36) NOT NULL,
                muted_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (muter_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (muted_id) REFERENCES users(user_id) ON DELETE CASCADE,
                UNIQUE KEY unique_mute (muter_id, muted_id)
            )
        `);
        console.log('✅ User interaction tables verified');
    } catch (err) {
        console.error('❌ Failed to init user interaction tables:', err);
    }
};

const initMomentsTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS moments (
                moment_id CHAR(36) PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                video_url VARCHAR(500) NOT NULL,
                thumbnail_url VARCHAR(500),
                caption TEXT,
                duration INT DEFAULT 0,
                views INT DEFAULT 0,
                shares INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                INDEX idx_created_at (created_at DESC)
            )
        `);

        // Harmonize existing table structure
        const columnsToAdd = [
            { name: 'video_url', type: 'VARCHAR(500) NOT NULL DEFAULT ""' },
            { name: 'thumbnail_url', type: 'VARCHAR(500)' },
            { name: 'caption', type: 'TEXT' },
            { name: 'duration', type: 'INT DEFAULT 0' },
            { name: 'views', type: 'INT DEFAULT 0' },
            { name: 'shares', type: 'INT DEFAULT 0' }
        ];

        for (const col of columnsToAdd) {
            try {
                await pool.query(`ALTER TABLE moments ADD COLUMN ${col.name} ${col.type}`);
                console.log(`✅ Added ${col.name} column to moments table`);
            } catch (err) {
                if (err.code !== 'ER_DUP_FIELDNAME') {
                    console.error(`Warning: Could not add ${col.name} column:`, err.message);
                }
            }
        }

        console.log('✅ Moments table verified');
    } catch (err) {
        console.error('❌ Failed to init moments table:', err);
    }
};

const initMessagesTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                message_id CHAR(36) PRIMARY KEY,
                sender_id CHAR(36) NOT NULL,
                recipient_id CHAR(36) NOT NULL,
                content TEXT NOT NULL,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (recipient_id) REFERENCES users(user_id) ON DELETE CASCADE,
                INDEX idx_sent_at (sent_at)
            )
        `);
        console.log('✅ Messages table verified');
    } catch (err) {
        console.error('❌ Failed to init messages table:', err);
    }
};

const initDB = async () => {
    await initNotificationsTable();
    await initUserInteractionsTables();
    await initMomentsTable();
    await initMessagesTable();
};

module.exports = { initDB };
