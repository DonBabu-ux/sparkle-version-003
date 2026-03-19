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
        logger.debug('✅ Notifications table verified');
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
        logger.debug('✅ User interaction tables verified');
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
                logger.debug(`✅ Added ${col.name} column to moments table`);
            } catch (err) {
                if (err.code !== 'ER_DUP_FIELDNAME') {
                    logger.warn(`Could not add ${col.name} column:`, err.message);
                }
            }
        }

        logger.debug('✅ Moments table verified');
    } catch (err) {
        logger.error('❌ Failed to init moments table:', err.message);
        throw err;
    }
};

const initGroupsTable = async () => {
    try {
        // Harmonize existing groups table structure
        const columnsToAdd = [
            { name: 'icon_url', type: 'VARCHAR(500)' }
        ];

        for (const col of columnsToAdd) {
            try {
                await pool.query(`ALTER TABLE groups ADD COLUMN ${col.name} ${col.type}`);
                logger.debug(`✅ Added ${col.name} column to groups table`);
            } catch (err) {
                if (err.code !== 'ER_DUP_FIELDNAME') {
                    logger.warn(`Could not add ${col.name} column to groups:`, err.message);
                }
            }
        }

        logger.debug('✅ Groups table verified');
    } catch (err) {
        logger.error('❌ Failed to init groups table:', err.message);
        throw err;
    }
};

const initStoriesTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS stories (
                story_id CHAR(36) NOT NULL PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                media_url VARCHAR(500) NOT NULL,
                media_type ENUM('image', 'video') DEFAULT 'image',
                caption VARCHAR(255) DEFAULT NULL,
                view_count INT DEFAULT 0,
                like_count INT DEFAULT 0,
                share_count INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL 24 HOUR),
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                INDEX idx_stories_user (user_id, created_at),
                INDEX idx_stories_active (expires_at, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        logger.debug('✅ Stories table verified');
    } catch (err) {
        logger.error('❌ Failed to init stories table:', err.message);
        throw err;
    }
};

const initStoryLikesTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS story_likes (
                like_id CHAR(36) NOT NULL PRIMARY KEY,
                story_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_story_like (story_id, user_id),
                FOREIGN KEY (story_id) REFERENCES stories(story_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                INDEX idx_story_likes_story (story_id, created_at),
                INDEX idx_story_likes_user (user_id, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        logger.debug('✅ Story likes table verified');
    } catch (err) {
        logger.error('❌ Failed to init story likes table:', err.message);
        throw err;
    }
};

const initStorySharesTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS story_shares (
                share_id CHAR(36) NOT NULL PRIMARY KEY,
                story_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (story_id) REFERENCES stories(story_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                INDEX idx_story_shares_story (story_id, created_at),
                INDEX idx_story_shares_user (user_id, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        logger.debug('✅ Story shares table verified');
    } catch (err) {
        logger.error('❌ Failed to init story shares table:', err.message);
        throw err;
    }
};

const initPersonalChatsTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS personal_chats (
                chat_id CHAR(36) NOT NULL PRIMARY KEY,
                participant1_id CHAR(36) NOT NULL,
                participant2_id CHAR(36) NOT NULL,
                last_message_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (participant1_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (participant2_id) REFERENCES users(user_id) ON DELETE CASCADE,
                UNIQUE KEY unique_participants (participant1_id, participant2_id),
                INDEX idx_personal_chats_participant1 (participant1_id, last_message_time),
                INDEX idx_personal_chats_participant2 (participant2_id, last_message_time)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        logger.debug('✅ Personal chats table verified');
    } catch (err) {
        logger.error('❌ Failed to init personal chats table:', err.message);
        throw err;
    }
};

const initMessagesTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                message_id CHAR(36) NOT NULL PRIMARY KEY,
                chat_id CHAR(36) DEFAULT NULL,
                conversation_id CHAR(36) DEFAULT NULL,
                sender_id CHAR(36) NOT NULL,
                type ENUM('text', 'image', 'video', 'voice_note', 'post_share', 'system', 'call', 'marketplace_listing', 'story_reply') DEFAULT 'text',
                content TEXT DEFAULT NULL,
                media_url VARCHAR(500) DEFAULT NULL,
                story_id CHAR(36) DEFAULT NULL,
                is_read TINYINT(1) DEFAULT 0,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                read_at TIMESTAMP NULL DEFAULT NULL,
                FOREIGN KEY (chat_id) REFERENCES group_chats(chat_id) ON DELETE CASCADE,
                FOREIGN KEY (conversation_id) REFERENCES personal_chats(chat_id) ON DELETE CASCADE,
                FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (story_id) REFERENCES stories(story_id) ON DELETE SET NULL,
                INDEX idx_messages_group_chat (chat_id, sent_at),
                INDEX idx_messages_personal_chat (conversation_id, sent_at),
                INDEX idx_messages_sender (sender_id, sent_at),
                INDEX idx_messages_unread (sender_id, is_read, sent_at),
                INDEX idx_messages_story (story_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // Harmonize existing table structure
        const columnsToAdd = [
            { name: 'conversation_id', type: 'CHAR(36) DEFAULT NULL' },
            { name: 'personal_chat_id', type: 'CHAR(36) DEFAULT NULL' }
        ];

        for (const col of columnsToAdd) {
            try {
                await pool.query(`ALTER TABLE messages ADD COLUMN ${col.name} ${col.type}`);
                logger.debug(`✅ Added ${col.name} column to messages table`);
            } catch (err) {
                if (err.code !== 'ER_DUP_FIELDNAME') {
                    logger.warn(`Could not add ${col.name} column to messages:`, err.message);
                }
            }
        }

        // Ensure foreign keys are consistent
        try {
            await pool.query(`
                ALTER TABLE messages 
                ADD CONSTRAINT fk_messages_conversation 
                FOREIGN KEY (conversation_id) REFERENCES personal_chats(chat_id) ON DELETE CASCADE
            `);
        } catch (err) {
            if (err.code !== 'ER_DUP_CONSTRAINT_NAME' && err.errno !== 121 && !String(err.message).includes('errno: 121')) {
                logger.warn('Could not add FK constraint to messages:', err.message);
            }
        }

        logger.debug('✅ Messages table verified');
    } catch (err) {
        logger.error('❌ Failed to init messages table:', err.message);
        throw err;
    }
};

const initLostFoundTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS lost_found_items (
                item_id CHAR(36) PRIMARY KEY,
                reporter_id CHAR(36) NOT NULL,
                type ENUM('lost', 'found') NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                category VARCHAR(50) DEFAULT NULL,
                campus VARCHAR(100) NOT NULL,
                location VARCHAR(255) DEFAULT NULL,
                date_lost_found DATE DEFAULT NULL,
                contact_info VARCHAR(255) DEFAULT NULL,
                status ENUM('open', 'claimed', 'closed') DEFAULT 'open',
                claimed_by CHAR(36) DEFAULT NULL,
                claimed_at TIMESTAMP NULL DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (reporter_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (claimed_by) REFERENCES users(user_id) ON DELETE SET NULL,
                INDEX idx_lost_found_campus (campus, status, created_at),
                INDEX idx_lost_found_type (type, status, created_at)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS lost_found_media (
                media_id CHAR(36) PRIMARY KEY,
                item_id CHAR(36) NOT NULL,
                media_url VARCHAR(500) NOT NULL,
                media_type ENUM('image', 'video') NOT NULL,
                upload_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (item_id) REFERENCES lost_found_items(item_id) ON DELETE CASCADE
            )
        `);
        logger.debug('✅ Lost & Found tables verified');
    } catch (err) {
        logger.error('❌ Failed to init Lost & Found tables:', err.message);
        throw err;
    }
};

const initSkillMarketTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS skill_offers (
                offer_id CHAR(36) PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                category VARCHAR(50) DEFAULT NULL,
                skill_type VARCHAR(100) DEFAULT NULL,
                price DECIMAL(10, 2) DEFAULT NULL,
                currency VARCHAR(10) DEFAULT 'USD',
                is_free TINYINT(1) DEFAULT 0,
                campus VARCHAR(100) NOT NULL,
                is_active TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                INDEX idx_skill_offers_campus (campus, is_active, created_at),
                INDEX idx_skill_offers_category (category, is_active),
                INDEX idx_skill_offers_user (user_id, created_at)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS skill_bookings (
                booking_id CHAR(36) PRIMARY KEY,
                offer_id CHAR(36) NOT NULL,
                booker_id CHAR(36) NOT NULL,
                status ENUM('pending', 'accepted', 'completed', 'cancelled') DEFAULT 'pending',
                booking_date DATETIME NOT NULL,
                duration_minutes INT DEFAULT 60,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (offer_id) REFERENCES skill_offers(offer_id) ON DELETE CASCADE,
                FOREIGN KEY (booker_id) REFERENCES users(user_id) ON DELETE CASCADE,
                INDEX idx_bookings_offer (offer_id, status),
                INDEX idx_bookings_booker (booker_id, status)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS skill_reviews (
                review_id CHAR(36) PRIMARY KEY,
                offer_id CHAR(36) NOT NULL,
                reviewer_id CHAR(36) NOT NULL,
                rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (offer_id) REFERENCES skill_offers(offer_id) ON DELETE CASCADE,
                FOREIGN KEY (reviewer_id) REFERENCES users(user_id) ON DELETE CASCADE,
                UNIQUE KEY unique_review (offer_id, reviewer_id)
            )
        `);
        logger.debug('✅ Skill Marketplace tables verified');
    } catch (err) {
        logger.error('❌ Failed to init Skill Marketplace tables:', err.message);
        throw err;
    }
};

const initMarketplaceTables = async () => {
    try {
        // 1. Listings Table (Escaping `condition` which is a reserved keyword in some SQL dialects)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS marketplace_listings (
                listing_id CHAR(36) NOT NULL PRIMARY KEY,
                seller_id CHAR(36) NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                price DECIMAL(10, 2) NOT NULL,
                category VARCHAR(50) DEFAULT 'other',
                \`condition\` ENUM('new', 'like_new', 'good', 'fair', 'poor') DEFAULT 'good',
                campus VARCHAR(100) NOT NULL,
                location VARCHAR(255) DEFAULT NULL,
                is_sold TINYINT(1) DEFAULT 0,
                status ENUM('active', 'sold', 'pending', 'deleted') DEFAULT 'active',
                sold_at TIMESTAMP NULL DEFAULT NULL,
                tags JSON DEFAULT NULL,
                view_count INT DEFAULT 0,
                image_url VARCHAR(500) DEFAULT NULL,
                boost_count INT DEFAULT 0,
                last_boosted_at TIMESTAMP NULL DEFAULT NULL,
                is_promoted TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (seller_id) REFERENCES users(user_id) ON DELETE CASCADE,
                INDEX idx_marketplace_campus (campus, status, created_at),
                INDEX idx_marketplace_category (category, status),
                INDEX idx_marketplace_seller (seller_id, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // 2. Listing Media
        await pool.query(`
            CREATE TABLE IF NOT EXISTS listing_media (
                media_id CHAR(36) NOT NULL PRIMARY KEY,
                listing_id CHAR(36) NOT NULL,
                media_url VARCHAR(500) NOT NULL,
                media_type ENUM('image', 'video') NOT NULL,
                upload_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // 3. Favorites
        await pool.query(`
            CREATE TABLE IF NOT EXISTS marketplace_favorites (
                favorite_id CHAR(36) NOT NULL PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                listing_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_listing_favorite (user_id, listing_id),
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // 4. Orders (Production-Grade)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS marketplace_orders (
                order_id              CHAR(36)         NOT NULL PRIMARY KEY,
                listing_id            CHAR(36)         NOT NULL,
                buyer_id              CHAR(36)         NOT NULL,
                seller_id             CHAR(36)         NOT NULL,
                listing_title         VARCHAR(255)     NOT NULL,
                listing_description   TEXT,
                price_at_time         DECIMAL(12,2)    NOT NULL,
                status ENUM('pending','accepted','rejected','cancelled','completed','disputed') NOT NULL DEFAULT 'pending',
                created_at            TIMESTAMP        DEFAULT CURRENT_TIMESTAMP,
                updated_at            TIMESTAMP        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE CASCADE,
                FOREIGN KEY (buyer_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (seller_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // 5. Reviews
        await pool.query(`
            CREATE TABLE IF NOT EXISTS marketplace_reviews (
                review_id CHAR(36) NOT NULL PRIMARY KEY,
                listing_id CHAR(36),
                reviewer_id CHAR(36) NOT NULL,
                reviewee_id CHAR(36) NOT NULL,
                rating TINYINT NOT NULL,
                comment TEXT,
                transaction_type ENUM('buyer', 'seller') NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE SET NULL,
                FOREIGN KEY (reviewer_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (reviewee_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // 6. Safe Meetup Locations
        await pool.query(`
            CREATE TABLE IF NOT EXISTS safe_meetup_locations (
                location_id CHAR(36) NOT NULL PRIMARY KEY,
                campus VARCHAR(100) NOT NULL,
                name VARCHAR(255) NOT NULL,
                building VARCHAR(255) DEFAULT NULL,
                description TEXT DEFAULT NULL,
                is_verified TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_campus (campus)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        logger.debug('✅ Marketplace tables verified');
    } catch (err) {
        logger.error('❌ Failed to init Marketplace tables:', err.message);
        throw err;
    }
};

const initDB = async () => {
    // Test connection first with retry logic
    logger.debug('Testing database connection...');
    let isConnected = false;
    try {
        isConnected = await retryWithBackoff(testConnection, 5, 2000);
    } catch (err) {
        logger.error('❌ Database connection test failed after retries:', err.message);
    }

    if (!isConnected) {
        logger.warn('⚠️  Database is not reachable. Server will start without database initialization.');
        logger.warn('⚠️  Database operations will fail until connection is restored.');
        return;
    }

    logger.debug('✅ Database connection successful');

    // Initialize tables with retry logic
    try {
        await retryWithBackoff(async () => {
            await initNotificationsTable();
            await initUserInteractionsTables();
            await initMomentsTable();
            await initGroupsTable();
            await initMessagesTable();
            await initStoriesTable();
            await initStoryLikesTable();
            await initStorySharesTable();
            await initPersonalChatsTable();
            await initLostFoundTable();
            await initSkillMarketTable();
            await initMarketplaceTables();
        });
        logger.debug('✅ Database initialization complete');
    } catch (err) {
        logger.error('❌ Database initialization failed after retries:', err.message);
        logger.warn('⚠️  Server will continue running but database operations may fail');
    }
};

module.exports = { initDB };
