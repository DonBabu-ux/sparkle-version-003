const pool = require('../../config/database');
const logger = require('../logger');

// Test database connection
const testConnection = async () => {
    try {
        await pool.query('SELECT 1');
        return true;
    } catch (err) {
        return false;
    }
};

// Retry logic with exponential backoff
const retryWithBackoff = async (fn, maxRetries = 3, initialDelay = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (err) {
            const isLastAttempt = i === maxRetries - 1;
            const delay = initialDelay * Math.pow(2, i);

            if (isLastAttempt) {
                throw err;
            }

            logger.warn(`Database operation failed, retrying in ${delay}ms... (attempt ${i + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

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
        logger.info('✅ Notifications table verified');
    } catch (err) {
        logger.error('❌ Failed to init notifications table:', err.message);
        throw err;
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
        logger.info('✅ User interaction tables verified');
    } catch (err) {
        logger.error('❌ Failed to init user interaction tables:', err.message);
        throw err;
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
                logger.info(`✅ Added ${col.name} column to moments table`);
            } catch (err) {
                if (err.code !== 'ER_DUP_FIELDNAME') {
                    logger.warn(`Could not add ${col.name} column:`, err.message);
                }
            }
        }

        logger.info('✅ Moments table verified');
    } catch (err) {
        logger.error('❌ Failed to init moments table:', err.message);
        throw err;
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
        logger.info('✅ Messages table verified');
    } catch (err) {
        logger.error('❌ Failed to init messages table:', err.message);
        throw err;
    }
};

const initStoriesTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS stories (
                story_id CHAR(36) PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                media_url VARCHAR(500) NOT NULL,
                media_type ENUM('image', 'video') NOT NULL,
                caption TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP GENERATED ALWAYS AS (created_at + INTERVAL 24 HOUR) STORED,
                views INT DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                INDEX idx_expires_at (expires_at),
                INDEX idx_user_created (user_id, created_at DESC)
            )
        `);
        logger.info('✅ Stories table verified');
    } catch (err) {
        logger.error('❌ Failed to init stories table:', err.message);
        throw err;
    }
};

const initDB = async () => {
    // Test connection first
    logger.info('Testing database connection...');
    const isConnected = await testConnection();

    if (!isConnected) {
        logger.warn('⚠️  Database is not reachable. Server will start without database initialization.');
        logger.warn('⚠️  Database operations will fail until connection is restored.');
        return;
    }

    logger.info('✅ Database connection successful');

    // Initialize tables with retry logic
    try {
        await retryWithBackoff(async () => {
            await initNotificationsTable();
            await initUserInteractionsTables();
            await initMomentsTable();
            await initMessagesTable();
            await initStoriesTable();
        });
        logger.info('✅ Database initialization complete');
    } catch (err) {
        logger.error('❌ Database initialization failed after retries:', err.message);
        logger.warn('⚠️  Server will continue running but database operations may fail');
    }
};

module.exports = { initDB };
