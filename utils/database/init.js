require('dotenv').config();
const pool = require('../../config/database');
const logger = require('../logger');

// Helper to safely extract error message
const getErrorMessage = (err) => {
    if (!err) return 'Unknown error';
    
    // Handle if error is already a string
    if (typeof err === 'string') return err.slice(0, 200);
    
    // Handle if it's an object
    if (typeof err === 'object') {
        // Check for message property
        if (err.message && typeof err.message === 'string') return err.message.slice(0, 200);
        
        // Check for code property (MySQL error codes)
        if (err.code && typeof err.code === 'string') return err.code.slice(0, 200);
        
        // Check for sqlMessage (mysql2 specific)
        if (err.sqlMessage && typeof err.sqlMessage === 'string') return err.sqlMessage.slice(0, 200);
        
        // If object has been stringified as character array (toString called), try JSON.stringify
        try {
            const str = JSON.stringify(err);
            if (str && str.length > 2) return str.slice(0, 200);
        } catch (e) {
            // Fallback below
        }
    }
    
    // Last resort - try String()
    try {
        const str = String(err).slice(0, 200);
        return str || 'Unknown error';
    } catch (e) {
        return 'Unknown error';
    }
};

// Helper to safely suppress duplicate errors
const isDuplicateError = (err) => {
    const msg = getErrorMessage(err);
    return msg.includes('Duplicate') || msg.includes('already exists') || msg.includes('UNIQUE');
};

// Test database connection
const testConnection = async () => {
    try {
        await pool.query('SELECT 1');
        return true;
    } catch (err) {
        const errorMsg = err?.message || String(err).slice(0, 200);
        logger.error('Database connection test failed: ' + errorMsg);
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

const repairUsersTable = async () => {
    try {
        // Add is_verified column if it doesn't exist
        const [isVerifiedCol] = await pool.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_verified'
        `);
        if (isVerifiedCol.length === 0) {
            await pool.query('ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE');
            logger.info('Added is_verified column to users table');
        }

        // Add role column if it doesn't exist
        const [roleCol] = await pool.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'
        `);
        if (roleCol.length === 0) {
            await pool.query("ALTER TABLE users ADD COLUMN role ENUM('user', 'moderator', 'admin') DEFAULT 'user'");
            logger.info('Added role column to users table');
        }

        // Add other missing columns
        const columnsToAdd = [
            { name: 'bio', type: 'TEXT DEFAULT NULL' },
            { name: 'campus', type: 'VARCHAR(100) DEFAULT NULL' },
            { name: 'major', type: 'VARCHAR(100) DEFAULT NULL' },
            { name: 'year_of_study', type: 'VARCHAR(50) DEFAULT NULL' },
            { name: 'profile_views', type: 'INT DEFAULT 0' },
            { name: 'note', type: 'VARCHAR(60) DEFAULT NULL' }
        ];

        for (const col of columnsToAdd) {
            const [exists] = await pool.query(`
                SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = ?
            `, [col.name]);
            if (exists.length === 0) {
                await pool.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
                logger.info(`Added ${col.name} column to users table`);
            }
        }

        // Set first user as admin if not already set
        const [users] = await pool.query('SELECT user_id, role FROM users ORDER BY joined_at LIMIT 1');
        if (users.length > 0 && users[0].role !== 'admin') {
            await pool.query('UPDATE users SET role = "admin" WHERE user_id = ?', [users[0].user_id]);
            logger.info('✅ First user set as admin.');
        }
    } catch (err) {
        logger.error('❌ Failed to repair users table:', err.message);
    }
};

const initRepostsTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS reposts (
                repost_id CHAR(36) PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                post_id CHAR(36) NOT NULL,
                comment TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_repost (user_id, post_id),
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        logger.debug('✅ Reposts table verified');
    } catch (err) {
        logger.error('❌ Failed to init reposts table:', err.message);
    }
};

const repairPostsTable = async () => {
    try {
        const columnsToAdd = [
            { name: 'original_post_id', type: 'CHAR(36) DEFAULT NULL' },
            { name: 'post_type', type: "ENUM('public', 'group', 'reshare') DEFAULT 'public'" },
            { name: 'language', type: 'VARCHAR(10) DEFAULT "en"' },
            { name: 'reshare_count', type: 'INT DEFAULT 0' },
            { name: 'feeling', type: 'VARCHAR(255) DEFAULT NULL' },
            { name: 'activity', type: 'VARCHAR(255) DEFAULT NULL' },
            { name: 'tagged_users', type: 'JSON DEFAULT NULL' }
        ];

        for (const col of columnsToAdd) {
            const [exists] = await pool.query(`
                SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'posts' AND COLUMN_NAME = ?
            `, [col.name]);
            if (exists.length === 0) {
                await pool.query(`ALTER TABLE posts ADD COLUMN ${col.name} ${col.type}`);
                logger.info(`Added ${col.name} column to posts table`);
            }
        }
        // Ensure indices for feed performance
        try {
            await pool.query('CREATE INDEX idx_posts_created_at ON posts(created_at)');
            logger.info('Created index idx_posts_created_at');
        } catch (e) { /* ignore if exists */ }
        
        try {
            await pool.query('CREATE INDEX idx_posts_campus ON posts(campus)');
            logger.info('Created index idx_posts_campus');
        } catch (e) { /* ignore if exists */ }

        try {
            await pool.query('CREATE INDEX idx_posts_user_id ON posts(user_id)');
            logger.info('Created index idx_posts_user_id');
        } catch (e) { /* ignore if exists */ }
    } catch (err) {
        logger.error('❌ Failed to repair posts table:', err.message);
    }
};

const repairStoriesTable = async () => {
    try {
        const columnsToAdd = [
            { name: 'is_archived', type: 'TINYINT(1) DEFAULT 0' },
            { name: 'expires_at', type: 'TIMESTAMP NULL DEFAULT NULL' },
            { name: 'background', type: 'VARCHAR(255) DEFAULT NULL' },
            { name: 'audio_url', type: 'VARCHAR(500) DEFAULT NULL' },
            { name: 'audio_source', type: "ENUM('local', 'online') DEFAULT NULL" },
            { name: 'audio_start', type: 'FLOAT DEFAULT 0.0' },
            { name: 'audio_duration', type: 'FLOAT DEFAULT 15.0' }
        ];

        for (const col of columnsToAdd) {
            const [exists] = await pool.query(`
                SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stories' AND COLUMN_NAME = ?
            `, [col.name]);
            if (exists.length === 0) {
                await pool.query(`ALTER TABLE stories ADD COLUMN ${col.name} ${col.type}`);
                logger.info(`Added ${col.name} column to stories table`);
            }
        }
    } catch (err) {
        logger.error('❌ Failed to repair stories table:', err.message);
    }
};

const initStickerTables = async () => {
    try {
        // 1. Story Stickers Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS story_stickers (
                sticker_id CHAR(36) PRIMARY KEY,
                story_id CHAR(36) NOT NULL,
                type ENUM('add_yours', 'avatar_loop', 'poll', 'quiz', 'reaction', 'slider') NOT NULL,
                config JSON NOT NULL,
                position_x FLOAT DEFAULT 50.0,
                position_y FLOAT DEFAULT 50.0,
                scale FLOAT DEFAULT 1.0,
                rotation FLOAT DEFAULT 0.0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (story_id) REFERENCES stories(story_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // 2. Add Yours Prompts
        await pool.query(`
            CREATE TABLE IF NOT EXISTS add_yours_prompts (
                prompt_id CHAR(36) PRIMARY KEY,
                text VARCHAR(255) NOT NULL,
                creator_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (creator_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // 3. Add Yours Responses
        await pool.query(`
            CREATE TABLE IF NOT EXISTS add_yours_responses (
                response_id CHAR(36) PRIMARY KEY,
                prompt_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                story_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (prompt_id) REFERENCES add_yours_prompts(prompt_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (story_id) REFERENCES stories(story_id) ON DELETE CASCADE,
                UNIQUE KEY unique_response (prompt_id, user_id, story_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // 4. Story Reactions
        await pool.query(`
            CREATE TABLE IF NOT EXISTS story_reactions (
                reaction_id CHAR(36) PRIMARY KEY,
                story_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                emoji VARCHAR(10) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (story_id) REFERENCES stories(story_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // 5. Poll Votes
        await pool.query(`
            CREATE TABLE IF NOT EXISTS poll_votes (
                vote_id CHAR(36) PRIMARY KEY,
                sticker_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                option_index TINYINT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sticker_id) REFERENCES story_stickers(sticker_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                UNIQUE KEY unique_poll_vote (sticker_id, user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        logger.debug('✅ Sticker system tables verified');
    } catch (err) {
        logger.error('❌ Failed to init sticker tables:', err.message);
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
                aggregation_count INT DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                read_at TIMESTAMP NULL DEFAULT NULL,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (actor_id) REFERENCES users(user_id) ON DELETE SET NULL
            )
        `);
        logger.debug('✅ Notifications table verified');

        // Migration: Add aggregation_count if missing
        try {
            const [notifCols] = await pool.query("SHOW COLUMNS FROM notifications LIKE 'aggregation_count'");
            if (notifCols.length === 0) {
                await pool.query("ALTER TABLE notifications ADD COLUMN aggregation_count INT DEFAULT 1 AFTER actor_id");
                logger.info('Added aggregation_count column to notifications table');
            }
        } catch (e) {
            logger.warn('Failed to add aggregation_count column:', e.message);
        }
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
                streaming_url VARCHAR(500),
                resolution VARCHAR(50) DEFAULT '1080p',
                bitrate INT DEFAULT 0,
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
            { name: 'shares', type: 'INT DEFAULT 0' },
            { name: 'streaming_url', type: 'VARCHAR(500)' },
            { name: 'resolution', type: "VARCHAR(50) DEFAULT '1080p'" },
            { name: 'bitrate', type: 'INT DEFAULT 0' }
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

const initMomentCommentsTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS moment_comments (
                comment_id CHAR(36) PRIMARY KEY,
                moment_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (moment_id) REFERENCES moments(moment_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            )
        `);
        logger.debug('✅ Moment comments table verified');
    } catch (err) {
        logger.error('❌ Failed to init moment comments table:', err.message);
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

        // Migration: add privacy_settings column if missing
        try {
          const [cols] = await pool.query("SHOW COLUMNS FROM groups LIKE 'privacy_settings'");
          if (cols.length === 0) {
            await pool.query("ALTER TABLE groups ADD COLUMN privacy_settings JSON NULL");
            logger.info('Added privacy_settings column to groups table');
          }
        } catch (e) {
          logger.warn('Failed to add privacy_settings column to groups:', e.message);
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
                media_type ENUM('image', 'video', 'text') DEFAULT 'image',
                caption VARCHAR(255) DEFAULT NULL,
                background VARCHAR(255) DEFAULT NULL,
                audio_url VARCHAR(500) DEFAULT NULL,
                audio_source ENUM('local', 'online') DEFAULT NULL,
                audio_start FLOAT DEFAULT 0.0,
                audio_duration FLOAT DEFAULT 15.0,
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

        // Migration: ensure media_type supports 'text'
        try {
            await pool.query("ALTER TABLE stories MODIFY COLUMN media_type ENUM('image', 'video', 'text') DEFAULT 'image'");
        } catch (e) {
            // Might fail if column doesn't exist or other issues, usually OK if already correct
        }
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

const initCommentLikesTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS comment_likes (
                like_id CHAR(36) NOT NULL PRIMARY KEY,
                comment_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_comment_like (comment_id, user_id),
                FOREIGN KEY (comment_id) REFERENCES comments(comment_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        
        // Also ensure like_count exists on comments
        try {
            await pool.query('ALTER TABLE comments ADD COLUMN like_count INT DEFAULT 0');
            logger.debug('✅ Added like_count column to comments table');
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') throw e;
        }

        logger.debug('✅ Comment likes table verified');
    } catch (err) {
        logger.error('❌ Failed to init comment likes table:', err.message);
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
                marketplace_listing_id CHAR(36) DEFAULT NULL,
                last_message_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (participant1_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (participant2_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (marketplace_listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE SET NULL,
                INDEX idx_personal_chats_participant1 (participant1_id, last_message_time, marketplace_listing_id),
                INDEX idx_personal_chats_participant2 (participant2_id, last_message_time, marketplace_listing_id),
                INDEX idx_marketplace_chat (marketplace_listing_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        // Migration: add privacy_settings column if missing
try {
  const [cols] = await pool.query("SHOW COLUMNS FROM personal_chats LIKE 'privacy_settings'");
  if (cols.length === 0) {
    await pool.query("ALTER TABLE personal_chats ADD COLUMN privacy_settings JSON NULL");
    logger.info('Added privacy_settings column to personal_chats table');
  }
} catch (e) {
  logger.warn('Failed to add privacy_settings column to personal_chats:', e.message);
}
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
                marketplace_listing_id CHAR(36) DEFAULT NULL,
                is_read TINYINT(1) DEFAULT 0,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                read_at TIMESTAMP NULL DEFAULT NULL,
                FOREIGN KEY (chat_id) REFERENCES group_chats(chat_id) ON DELETE CASCADE,
                FOREIGN KEY (conversation_id) REFERENCES personal_chats(chat_id) ON DELETE CASCADE,
                FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (story_id) REFERENCES stories(story_id) ON DELETE SET NULL,
                FOREIGN KEY (marketplace_listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE SET NULL,
                INDEX idx_messages_group_chat (chat_id, sent_at),
                INDEX idx_messages_personal_chat (conversation_id, sent_at),
                INDEX idx_messages_sender (sender_id, sent_at),
                INDEX idx_messages_marketplace (marketplace_listing_id),
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

        // Add privacy snapshot columns to messages table
        const privacyCols = [
            { name: 'allow_forward', type: 'TINYINT(1) DEFAULT 1' },
            { name: 'allow_copy', type: 'TINYINT(1) DEFAULT 1' },
            { name: 'block_screenshot', type: 'TINYINT(1) DEFAULT 0' },
            { name: 'blur_screen_recording', type: 'TINYINT(1) DEFAULT 1' },
            { name: 'notify_screenshot_attempts', type: 'TINYINT(1) DEFAULT 1' }
        ];
        for (const col of privacyCols) {
            try {
                await pool.query(`ALTER TABLE messages ADD COLUMN ${col.name} ${col.type}`);
                logger.debug(`✅ Added privacy snapshot column ${col.name} to messages table`);
            } catch (err) {
                if (err.code !== 'ER_DUP_FIELDNAME') {
                    logger.warn(`Could not add privacy snapshot column ${col.name} to messages:`, err.message);
                }
            }
        }
    } catch (err) {
        logger.error('❌ Failed to init messages table:', err.message);
        throw err;
    }
};

const initChatPrivacySettingsTable = async () => {
    try {
        // 1. chat_privacy_settings
        await pool.query(`
            CREATE TABLE IF NOT EXISTS chat_privacy_settings (
                id CHAR(36) PRIMARY KEY,
                chat_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                allow_forward TINYINT(1) DEFAULT 1,
                allow_copy TINYINT(1) DEFAULT 1,
                block_screenshot TINYINT(1) DEFAULT 0,
                blur_screen_recording TINYINT(1) DEFAULT 1,
                notify_screenshot_attempts TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_chat_user (chat_id, user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        
        try {
            await pool.query('CREATE INDEX idx_chat_privacy_settings_lookup ON chat_privacy_settings(chat_id, user_id)');
        } catch (e) {}

        // 2. capture_attempts
        await pool.query(`
            CREATE TABLE IF NOT EXISTS capture_attempts (
                id CHAR(36) PRIMARY KEY,
                chat_id CHAR(36) NOT NULL,
                owner_user_id CHAR(36) NOT NULL,
                actor_user_id CHAR(36) NOT NULL,
                attempt_type VARCHAR(50) NOT NULL,
                detection_method VARCHAR(50),
                device_info JSON,
                metadata JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        
        try {
            await pool.query('CREATE INDEX idx_capture_attempts_owner ON capture_attempts(owner_user_id, created_at DESC)');
        } catch (e) {}
        try {
            await pool.query('CREATE INDEX idx_capture_attempts_chat ON capture_attempts(chat_id, created_at DESC)');
        } catch (e) {}

        // 3. capture_notifications
        await pool.query(`
            CREATE TABLE IF NOT EXISTS capture_notifications (
                id CHAR(36) PRIMARY KEY,
                recipient_user_id CHAR(36) NOT NULL,
                capture_attempt_id CHAR(36) NOT NULL,
                is_read TINYINT(1) DEFAULT 0,
                delivered_via_websocket TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_attempt_recipient (capture_attempt_id, recipient_user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // 4. capture_audit_log (immutable)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS capture_audit_log (
                id CHAR(36) PRIMARY KEY,
                capture_attempt_id CHAR(36) NOT NULL,
                actor_user_id CHAR(36) NOT NULL,
                owner_user_id CHAR(36) NOT NULL,
                chat_id CHAR(36) NOT NULL,
                action VARCHAR(100) NOT NULL,
                before_state JSON,
                after_state JSON,
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        logger.debug('✅ chat_privacy_settings and capture tables verified');
    } catch (err) {
        logger.error('❌ Failed to init chat_privacy_settings and capture tables:', err.message);
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
        // 1. Listings Table
        const createListingsTable = 'CREATE TABLE IF NOT EXISTS marketplace_listings (' +
            'listing_id CHAR(36) NOT NULL PRIMARY KEY, ' +
            'seller_id CHAR(36) NOT NULL, ' +
            'title VARCHAR(255) NOT NULL, ' +
            'description TEXT, ' +
            'price DECIMAL(10, 2) NOT NULL, ' +
            'category VARCHAR(50) DEFAULT "other", ' +
            '`condition` ENUM("new", "like_new", "good", "fair", "poor") DEFAULT "good", ' +
            'campus VARCHAR(100) NOT NULL, ' +
            'location VARCHAR(255) DEFAULT NULL, ' +
            'latitude DECIMAL(10, 8) DEFAULT NULL, ' +
            'longitude DECIMAL(11, 8) DEFAULT NULL, ' +
            'is_sold TINYINT(1) DEFAULT 0, ' +
            'status ENUM("active", "sold", "pending", "deleted") DEFAULT "active", ' +
            'sold_at TIMESTAMP NULL DEFAULT NULL, ' +
            'tags JSON DEFAULT NULL, ' +
            'view_count INT DEFAULT 0, ' +
            'image_url VARCHAR(500) DEFAULT NULL, ' +
            'boost_count INT DEFAULT 0, ' +
            'last_boosted_at TIMESTAMP NULL DEFAULT NULL, ' +
            'is_promoted TINYINT(1) DEFAULT 0, ' +
            'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, ' +
            'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, ' +
            'FOREIGN KEY (seller_id) REFERENCES users(user_id) ON DELETE CASCADE, ' +
            'INDEX idx_marketplace_campus (campus, status, created_at), ' +
            'INDEX idx_marketplace_category (category, status), ' +
            'INDEX idx_marketplace_seller (seller_id, created_at), ' +
            'INDEX idx_marketplace_geo (latitude, longitude) ' +
            ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;';
        
        await pool.query(createListingsTable);

        // Migration: Add latitude/longitude if missing
        try {
            const [cols] = await pool.query("SHOW COLUMNS FROM marketplace_listings LIKE 'latitude'");
            if (cols.length === 0) {
                await pool.query("ALTER TABLE marketplace_listings ADD COLUMN latitude DECIMAL(10, 8) DEFAULT NULL AFTER location");
                await pool.query("ALTER TABLE marketplace_listings ADD COLUMN longitude DECIMAL(11, 8) DEFAULT NULL AFTER latitude");
                await pool.query("CREATE INDEX idx_marketplace_geo ON marketplace_listings(latitude, longitude)");
                logger.info('Added geo-spatial columns to marketplace_listings table');
            }
        } catch (err) {
            logger.warn('Failed to add geo-spatial columns to marketplace_listings:', err.message);
        }

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

        // 3. Listing Tags
        await pool.query(`
            CREATE TABLE IF NOT EXISTS listing_tags (
                listing_id CHAR(36) NOT NULL,
                tag_name VARCHAR(50) NOT NULL,
                PRIMARY KEY (listing_id, tag_name),
                FOREIGN KEY (listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // 4. Favorites
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

        // 5. Orders (Production-Grade)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS marketplace_orders (
                order_id              CHAR(36)         NOT NULL PRIMARY KEY,
                listing_id            CHAR(36)         NOT NULL,
                buyer_id              CHAR(36)         NOT NULL,
                seller_id             CHAR(36)         NOT NULL,
                listing_title         VARCHAR(255)     NOT NULL,
                listing_description   TEXT,
                price_at_time         DECIMAL(12,2)    NOT NULL,
                currency              VARCHAR(10)      DEFAULT 'KES',
                item_condition        VARCHAR(50)      DEFAULT NULL,
                status ENUM('pending','accepted','rejected','cancelled','completed','disputed') NOT NULL DEFAULT 'pending',
                
                -- Dynamic details from suggested fix
                agreed_price          DECIMAL(12,2)    DEFAULT NULL,
                campus                VARCHAR(100)     DEFAULT NULL,
                location_description   TEXT            DEFAULT NULL,
                scheduled_time        TIMESTAMP        NULL DEFAULT NULL,
                
                -- Timestamps for lifecycle
                accepted_at           TIMESTAMP        NULL DEFAULT NULL,
                rejected_at           TIMESTAMP        NULL DEFAULT NULL,
                cancelled_at          TIMESTAMP        NULL DEFAULT NULL,
                completed_at          TIMESTAMP        NULL DEFAULT NULL,
                disputed_at           TIMESTAMP        NULL DEFAULT NULL,
                
                -- Audit
                last_action_by        CHAR(36)         NULL,
                last_action_at        TIMESTAMP        NULL DEFAULT NULL,
                
                created_at            TIMESTAMP        DEFAULT CURRENT_TIMESTAMP,
                updated_at            TIMESTAMP        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE CASCADE,
                FOREIGN KEY (buyer_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (seller_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // Migration: Add missing columns if they don't exist
        const orderResult = await pool.query("SHOW COLUMNS FROM marketplace_orders");
        const [orderCols] = Array.isArray(orderResult) ? [orderResult] : orderResult || [];
        const orderColNames = (Array.isArray(orderCols) ? orderCols : []).map(c => c.Field);
        
        const missingOrderCols = [
            'currency', 'item_condition', 'agreed_price', 'campus', 'location_description',
            'scheduled_time', 'accepted_at', 'rejected_at', 'cancelled_at', 'completed_at',
            'disputed_at', 'last_action_by', 'last_action_at', 'listing_title', 'listing_description', 'price_at_time',
            'cancelled_by', 'cancellation_reason', 'meetup_confirmed_by_buyer', 'meetup_confirmed_by_seller'
        ];

        for (const col of missingOrderCols) {
            if (!orderColNames.includes(col)) {
                let colDef = '';
                if (col.endsWith('_at') || col === 'scheduled_time') colDef = 'TIMESTAMP NULL DEFAULT NULL';
                else if (col === 'agreed_price' || col === 'price_at_time') colDef = 'DECIMAL(12,2) DEFAULT NULL';
                else if (col === 'last_action_by' || col === 'cancelled_by') colDef = 'CHAR(36) NULL';
                else if (col === 'currency') colDef = 'VARCHAR(10) DEFAULT "KES"';
                else if (col === 'listing_title') colDef = 'VARCHAR(255) NULL';
                else if (col === 'meetup_confirmed_by_buyer' || col === 'meetup_confirmed_by_seller') colDef = 'TINYINT(1) DEFAULT 0';
                else colDef = 'TEXT NULL';
                
                try {
                    await pool.query(`ALTER TABLE marketplace_orders ADD COLUMN ${col} ${colDef}`);
                    logger.debug(`Added column ${col} to marketplace_orders`);
                } catch (e) {
                    logger.warn(`Failed to add column ${col}: ${e.message}`);
                }
            }
        }

        try {
            await pool.query(`ALTER TABLE marketplace_orders ADD CONSTRAINT fk_mo_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users(user_id) ON DELETE SET NULL`);
        } catch (e) {
            // FK already exists or cancelled_by column not present yet — safe to ignore
        }

        try {
            await pool.query('ALTER TABLE marketplace_orders MODIFY COLUMN price DECIMAL(10,2) NULL');
            logger.debug('Modified price to be NULLABLE in marketplace_orders');
        } catch (e) {
            // Price might not exist anymore, or syntax error
        }

        // Migration: Add tags to listings
        try {
            const [listingCols] = await pool.query("SHOW COLUMNS FROM marketplace_listings");
            if (!listingCols.find(c => c.Field === 'tags')) {
                await pool.query('ALTER TABLE marketplace_listings ADD COLUMN tags JSON NULL');
                logger.debug('Added tags column to marketplace_listings');
            }
        } catch (e) {
            logger.warn('Failed to migrate marketplace_listings tags: ' + e.message);
        }

        // 6. Reviews
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

        // 7. Safe Meetup Locations
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

        // 8. Tags Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS listing_tags (
                listing_id CHAR(36) NOT NULL,
                tag_name VARCHAR(100) NOT NULL,
                PRIMARY KEY (listing_id, tag_name),
                FOREIGN KEY (listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        logger.debug('✅ Marketplace tables verified');
    } catch (err) {
        logger.error('❌ Failed to init Marketplace tables:', err.message);
        throw err;
    }
};

const initConfessionTables = async () => {
    try {
        // 1. Ensure confessions table exists with all modern columns
        await pool.query(`
            CREATE TABLE IF NOT EXISTS confessions (
                confession_id   CHAR(36) PRIMARY KEY,
                user_id         CHAR(36) NOT NULL,
                content         TEXT NOT NULL,
                campus          VARCHAR(100) NOT NULL,
                category        VARCHAR(50) DEFAULT 'general',
                author_alias    VARCHAR(50) DEFAULT NULL,
                image_url       VARCHAR(500) DEFAULT NULL,
                heart_count     INT DEFAULT 0,
                fire_count      INT DEFAULT 0,
                smile_count     INT DEFAULT 0,
                relate_count    INT DEFAULT 0,
                support_count   INT DEFAULT 0,
                downvote_count  INT DEFAULT 0,
                rating_count    INT DEFAULT 0,
                comment_count   INT DEFAULT 0,
                discovery_score FLOAT DEFAULT 0,
                is_approved     TINYINT(1) DEFAULT 1,
                is_best_of_day  TINYINT(1) DEFAULT 0,
                is_best_of_week TINYINT(1) DEFAULT 0,
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                approved_at     TIMESTAMP NULL DEFAULT NULL,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // Migration: Add missing columns if they don't exist
        const colResult = await pool.query("SHOW COLUMNS FROM confessions");
        const [cols] = Array.isArray(colResult) ? [colResult] : colResult || [];
        const colNames = (Array.isArray(cols) ? cols : []).map(c => c.Field);
        
        const confessionsCols = [
            { name: 'user_id', type: 'CHAR(36) NULL' },
            { name: 'author_alias', type: 'VARCHAR(50) DEFAULT NULL' },
            { name: 'image_url', type: 'VARCHAR(500) DEFAULT NULL' },
            { name: 'heart_count', type: 'INT DEFAULT 0' },
            { name: 'fire_count', type: 'INT DEFAULT 0' },
            { name: 'smile_count', type: 'INT DEFAULT 0' },
            { name: 'relate_count', type: 'INT DEFAULT 0' },
            { name: 'support_count', type: 'INT DEFAULT 0' },
            { name: 'downvote_count', type: 'INT DEFAULT 0' },
            { name: 'rating_count', type: 'INT DEFAULT 0' },
            { name: 'comment_count', type: 'INT DEFAULT 0' },
            { name: 'discovery_score', type: 'FLOAT DEFAULT 0' },
            { name: 'is_best_of_day', type: 'TINYINT(1) DEFAULT 0' },
            { name: 'is_best_of_week', type: 'TINYINT(1) DEFAULT 0' },
            { name: 'approved_at', type: 'TIMESTAMP NULL DEFAULT NULL' }
        ];

        for (const col of confessionsCols) {
            if (!colNames.includes(col.name)) {
                try {
                    await pool.query(`ALTER TABLE confessions ADD COLUMN ${col.name} ${col.type}`);
                    logger.info(`Added column ${col.name} to confessions table`);
                } catch (err) {
                    logger.warn(`Failed to add column ${col.name} to confessions:`, err.message);
                }
            }
        }

        // 2. Ensure confession_reactions exists and has full ENUM
        await pool.query(`
            CREATE TABLE IF NOT EXISTS confession_reactions (
                reaction_id     CHAR(36) PRIMARY KEY,
                confession_id   CHAR(36) NOT NULL,
                user_id         CHAR(36) NOT NULL,
                reaction_type   ENUM('upvote', 'downvote', 'heart', 'fire', 'smile', 'laugh', 'funny', 'relate', 'support') NOT NULL,
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_confession_reaction (user_id, confession_id),
                FOREIGN KEY (confession_id) REFERENCES confessions(confession_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // Migration: Update reaction_type enum to support all types
        try {
            await pool.query(`
                ALTER TABLE confession_reactions 
                MODIFY COLUMN reaction_type ENUM('upvote', 'downvote', 'heart', 'fire', 'smile', 'laugh', 'funny', 'relate', 'support') NOT NULL
            `);
        } catch (err) {
            logger.warn('Failed to update confession_reactions enum:', err.message);
        }

        // 3. Ensure confession_comments table exists with parent_id and author_alias
        await pool.query(`
            CREATE TABLE IF NOT EXISTS confession_comments (
                comment_id      CHAR(36) PRIMARY KEY,
                confession_id   CHAR(36) NOT NULL,
                user_id         CHAR(36) NOT NULL,
                parent_id       CHAR(36) DEFAULT NULL,
                content         TEXT NOT NULL,
                author_alias    VARCHAR(50) DEFAULT NULL,
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (confession_id) REFERENCES confessions(confession_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (parent_id) REFERENCES confession_comments(comment_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // Migration: Add parent_id and author_alias to confession_comments
        try {
            const ccolResult = await pool.query("SHOW COLUMNS FROM confession_comments");
            const ccols = (Array.isArray(ccolResult) ? ccolResult : (Array.isArray(ccolResult?.[0]) ? ccolResult[0] : []));
            const ccolNames = (Array.isArray(ccols) ? ccols : []).map(c => c.Field);
            
            if (!ccolNames.includes('parent_id')) {
                await pool.query('ALTER TABLE confession_comments ADD COLUMN parent_id CHAR(36) DEFAULT NULL AFTER user_id');
                await pool.query('ALTER TABLE confession_comments ADD FOREIGN KEY (parent_id) REFERENCES confession_comments(comment_id) ON DELETE CASCADE');
                logger.info('Added parent_id to confession_comments');
            }
            
            if (!ccolNames.includes('author_alias')) {
                await pool.query('ALTER TABLE confession_comments ADD COLUMN author_alias VARCHAR(50) DEFAULT NULL AFTER parent_id');
                logger.info('Added author_alias to confession_comments');
            }
        } catch (err) {
            logger.warn('Failed to migrate confession_comments:', err.message);
        }

        // 4. Ensure confession_reports table exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS confession_reports (
                report_id       CHAR(36) PRIMARY KEY,
                confession_id   CHAR(36) NOT NULL,
                reporter_id     CHAR(36) NOT NULL,
                reason          TEXT NOT NULL,
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_confession_report (reporter_id, confession_id),
                FOREIGN KEY (confession_id) REFERENCES confessions(confession_id) ON DELETE CASCADE,
                FOREIGN KEY (reporter_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        logger.debug('✅ Confessions tables verified and modernized');
    } catch (err) {
        logger.error('❌ Failed to init Confessions tables:', err.message);
        throw err;
    }
};

const initSearchTables = async () => {
    try {
        // 1. Search History
        await pool.query(`
            CREATE TABLE IF NOT EXISTS search_history (
                id CHAR(36) PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                query VARCHAR(255) NOT NULL,
                searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                UNIQUE KEY unique_user_search (user_id, query)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // 2. Hashtags (Global)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS hashtags (
                tag_id CHAR(36) PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                post_count INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // 3. Post Hashtags (Mapping)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS post_hashtags (
                post_id CHAR(36) NOT NULL,
                tag_id CHAR(36) NOT NULL,
                PRIMARY KEY (post_id, tag_id),
                FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES hashtags(tag_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // 4. Moment Hashtags (Legacy compatibility for suggestions)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS moment_hashtags (
                moment_id CHAR(36) NOT NULL,
                hashtag VARCHAR(100) NOT NULL,
                PRIMARY KEY (moment_id, hashtag),
                FOREIGN KEY (moment_id) REFERENCES moments(moment_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        logger.debug('✅ Search & Hashtag tables verified');
    } catch (err) {
        logger.error('❌ Failed to init search tables:', err.message);
    }
};

const initHighlightsTables = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS highlights (
                highlight_id CHAR(36) PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                title VARCHAR(100) NOT NULL,
                cover_url VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                INDEX idx_highlights_user (user_id, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS highlight_stories (
                id CHAR(36) PRIMARY KEY,
                highlight_id CHAR(36) NOT NULL,
                story_id CHAR(36) NOT NULL,
                position INT DEFAULT 0,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (highlight_id) REFERENCES highlights(highlight_id) ON DELETE CASCADE,
                FOREIGN KEY (story_id) REFERENCES stories(story_id) ON DELETE CASCADE,
                UNIQUE KEY unique_highlight_story (highlight_id, story_id),
                INDEX idx_highlight_stories (highlight_id, position)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        logger.debug('✅ Highlights tables verified');
    } catch (err) {
        logger.error('❌ Failed to init highlights tables:', err.message);
        throw err;
    }
};

const initUserActionsTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_actions (
                action_id CHAR(36) PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                post_id CHAR(36) NOT NULL,
                creator_id CHAR(36) DEFAULT NULL,
                action_type ENUM('click', 'like', 'dwell', 'share', 'view', 'comment') NOT NULL,
                action_value FLOAT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_action (user_id, post_id, action_type),
                INDEX idx_user_post (user_id, post_id),
                INDEX idx_action_type (action_type),
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        
        // Migration: ensure action_value exists
        const [cols] = await pool.query("SHOW COLUMNS FROM user_actions LIKE 'action_value'");
        if (cols.length === 0) {
            await pool.query("ALTER TABLE user_actions ADD COLUMN action_value FLOAT DEFAULT 0 AFTER action_type");
            logger.info('Added action_value column to user_actions table');
        }

        // Migration: ensure unique key exists for UPSERT
        try {
            const [keys] = await pool.query("SHOW INDEX FROM user_actions WHERE Key_name = 'unique_user_action'");
            if (keys.length === 0) {
                await pool.query("ALTER TABLE user_actions ADD UNIQUE KEY unique_user_action (user_id, post_id, action_type)");
                logger.info('Added unique_user_action key to user_actions table');
            }
        } catch (e) {
            logger.warn('Failed to add unique key to user_actions:', e.message);
        }

        logger.debug('✅ User actions table verified');
    } catch (err) {
        logger.error('❌ Failed to init user actions table:', err.message);
    }
};

const initModerationTables = async () => {
    try {
        // Ensure posts has status and visibility_score
        const columnsToAdd = [
            { name: 'status', type: 'ENUM("active", "limited", "removed") DEFAULT "active"' },
            { name: 'visibility_score', type: 'FLOAT DEFAULT 1.0' }
        ];

        for (const col of columnsToAdd) {
            const [exists] = await pool.query(`
                SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'posts' AND COLUMN_NAME = ?
            `, [col.name]);
            if (exists.length === 0) {
                await pool.query(`ALTER TABLE posts ADD COLUMN ${col.name} ${col.type}`);
                logger.debug(`✅ Added ${col.name} column to posts table for moderation`);
            }
        }

        await pool.query(`
            CREATE TABLE IF NOT EXISTS reports (
                id CHAR(36) PRIMARY KEY,
                post_id CHAR(36) NOT NULL,
                reporter_id CHAR(36) NOT NULL,
                reason VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
                FOREIGN KEY (reporter_id) REFERENCES users(user_id) ON DELETE CASCADE,
                UNIQUE KEY unique_report (post_id, reporter_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS moderation_scores (
                post_id CHAR(36) PRIMARY KEY,
                toxicity_score FLOAT DEFAULT 0,
                nsfw_score FLOAT DEFAULT 0,
                violence_score FLOAT DEFAULT 0,
                spam_score FLOAT DEFAULT 0,
                confidence FLOAT DEFAULT 0,
                last_scored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS appeals (
                id CHAR(36) PRIMARY KEY,
                post_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                reason TEXT NOT NULL,
                status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reviewed_at TIMESTAMP NULL DEFAULT NULL,
                FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_trust (
                user_id CHAR(36) PRIMARY KEY,
                trust_score FLOAT DEFAULT 1.0,
                false_report_count INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        logger.debug('✅ Moderation tables verified');
    } catch (err) {
        logger.error('❌ Failed to init moderation tables:', err.message);
        throw err;
    }
};

const initOtaTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sparkle_ota_versions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                version VARCHAR(20) NOT NULL UNIQUE,
                min_apk_version VARCHAR(20) NOT NULL,
                bundle_url VARCHAR(500) NOT NULL,
                bundle_hash VARCHAR(64) NOT NULL,
                signature TEXT NOT NULL,
                is_mandatory TINYINT(1) DEFAULT 0,
                changelog TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        logger.debug('✅ OTA versions table verified');
    } catch (err) {
        logger.error('❌ Failed to init OTA versions table:', err.message);
        throw err;
    }
};

// ============================================================
// Recovered tables: consolidated from git history (scripts/),
// utils/database/migrations/, models/Marketplace.js inline
// creates, and live app SQL usage. All statements are
// idempotent (IF NOT EXISTS); executed sequentially and each
// failure is logged without aborting the rest.
// ============================================================
const RECOVERED_TABLES = [
    // ---- auth / security (scripts history + 008 migration) ----
    {
        name: 'refresh_tokens',
        sql: `CREATE TABLE IF NOT EXISTS refresh_tokens (
            token_id CHAR(36) PRIMARY KEY,
            user_id CHAR(36) NOT NULL,
            token VARCHAR(512) NOT NULL UNIQUE,
            device_id VARCHAR(255),
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'login_activity',
        sql: `CREATE TABLE IF NOT EXISTS login_activity (
            activity_id CHAR(36) PRIMARY KEY,
            user_id CHAR(36) NOT NULL,
            device_id VARCHAR(255),
            ip_address VARCHAR(45),
            user_agent TEXT,
            location VARCHAR(255),
            is_verified TINYINT(1) DEFAULT 0,
            last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_user_device (user_id, device_id),
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'user_sessions',
        sql: `CREATE TABLE IF NOT EXISTS user_sessions (
            session_id CHAR(36) PRIMARY KEY,
            user_id CHAR(36) NOT NULL,
            device_id VARCHAR(255),
            device_name VARCHAR(255),
            ip_address VARCHAR(45),
            last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'login_attempts',
        sql: `CREATE TABLE IF NOT EXISTS login_attempts (
            attempt_id CHAR(36) NOT NULL,
            user_id CHAR(36) DEFAULT NULL,
            login_id VARCHAR(255) NOT NULL,
            ip_address VARCHAR(45) NOT NULL,
            attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_successful TINYINT(1) DEFAULT 0,
            PRIMARY KEY (attempt_id),
            INDEX idx_login_attempts_id_time (login_id, attempt_time),
            INDEX idx_login_attempts_ip_time (ip_address, attempt_time)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'verification_requests',
        sql: `CREATE TABLE IF NOT EXISTS verification_requests (
            request_id CHAR(36) NOT NULL,
            user_id CHAR(36) NOT NULL,
            type ENUM('email', 'sms', 'password_reset', 'identity') NOT NULL,
            status ENUM('pending', 'approved', 'rejected', 'expired') DEFAULT 'pending',
            id_document_url VARCHAR(255) DEFAULT NULL,
            requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            reviewed_by CHAR(36) DEFAULT NULL,
            review_notes TEXT DEFAULT NULL,
            reviewed_at TIMESTAMP NULL DEFAULT NULL,
            PRIMARY KEY (request_id),
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
            FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL,
            INDEX idx_verif_requests_user_time (user_id, type, requested_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'follow_requests',
        sql: `CREATE TABLE IF NOT EXISTS follow_requests (
            id CHAR(36) NOT NULL,
            requester_id CHAR(36) NOT NULL,
            target_user_id CHAR(36) NOT NULL,
            status ENUM('pending', 'accepted', 'rejected', 'cancelled') DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY unique_follow_request (requester_id, target_user_id, status),
            FOREIGN KEY (requester_id) REFERENCES users(user_id) ON DELETE CASCADE,
            FOREIGN KEY (target_user_id) REFERENCES users(user_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'post_reports',
        sql: `CREATE TABLE IF NOT EXISTS post_reports (
            report_id CHAR(36) NOT NULL,
            post_id CHAR(36) NOT NULL,
            reporter_id CHAR(36) NOT NULL,
            reason VARCHAR(255) NOT NULL,
            status ENUM('pending', 'resolved', 'dismissed') DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP NULL DEFAULT NULL,
            resolved_by CHAR(36) DEFAULT NULL,
            PRIMARY KEY (report_id),
            FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
            FOREIGN KEY (reporter_id) REFERENCES users(user_id) ON DELETE CASCADE,
            FOREIGN KEY (resolved_by) REFERENCES users(user_id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'admin_logs',
        sql: `CREATE TABLE IF NOT EXISTS admin_logs (
            log_id CHAR(36) PRIMARY KEY,
            admin_id CHAR(36) NOT NULL,
            action VARCHAR(100) NOT NULL,
            target_type VARCHAR(50),
            target_id CHAR(36),
            details JSON,
            level ENUM('info', 'warning', 'danger') DEFAULT 'info',
            ip_address VARCHAR(45),
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_al_admin_id (admin_id),
            INDEX idx_al_created_at (created_at),
            INDEX idx_al_target (target_type, target_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'email_verifications',
        sql: `CREATE TABLE IF NOT EXISTS email_verifications (
            verification_id CHAR(36) PRIMARY KEY,
            user_id CHAR(36) NOT NULL,
            email VARCHAR(255) NOT NULL,
            code VARCHAR(10) NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            verified_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_ev_user_id (user_id),
            INDEX idx_ev_code (code),
            UNIQUE KEY unique_user_email (user_id, email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'password_resets',
        sql: `CREATE TABLE IF NOT EXISTS password_resets (
            reset_id CHAR(36) PRIMARY KEY,
            user_id CHAR(36) NOT NULL,
            email VARCHAR(255) NOT NULL,
            token VARCHAR(64) NOT NULL UNIQUE,
            expires_at TIMESTAMP NOT NULL,
            used_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_pr_token (token),
            INDEX idx_pr_user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },

    // ---- push / notifications (migrations + 008) ----
    {
        name: 'push_notifications',
        sql: `CREATE TABLE IF NOT EXISTS push_notifications (
            notification_id CHAR(36) PRIMARY KEY,
            user_id CHAR(36) NOT NULL,
            type VARCHAR(50) NOT NULL,
            title VARCHAR(255),
            body TEXT,
            data JSON,
            sent_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_pn_user_id (user_id),
            INDEX idx_pn_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'fcm_tokens',
        sql: `CREATE TABLE IF NOT EXISTS fcm_tokens (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'push_subscriptions',
        sql: `CREATE TABLE IF NOT EXISTS push_subscriptions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id CHAR(36) NOT NULL,
            endpoint VARCHAR(500) NOT NULL,
            p256dh VARCHAR(255) NOT NULL,
            auth VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_user_endpoint (user_id, endpoint),
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },

    // ---- direct-message meta (migrations + scripts history) ----
    {
        name: 'message_hidden',
        sql: `CREATE TABLE IF NOT EXISTS message_hidden (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id CHAR(36) NOT NULL,
            message_id CHAR(36) NOT NULL,
            hidden_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_hidden (user_id, message_id),
            INDEX idx_hidden_user (user_id),
            INDEX idx_hidden_message (message_id),
            CONSTRAINT fk_hidden_user
                FOREIGN KEY (user_id) REFERENCES users(user_id)
                ON DELETE CASCADE,
            CONSTRAINT fk_hidden_message
                FOREIGN KEY (message_id) REFERENCES messages(message_id)
                ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'message_reactions',
        sql: `CREATE TABLE IF NOT EXISTS message_reactions (
            reaction_id CHAR(36) PRIMARY KEY,
            message_id CHAR(36) NOT NULL,
            user_id CHAR(36) NOT NULL,
            emoji VARCHAR(50) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_reaction (message_id, user_id, emoji),
            FOREIGN KEY (message_id) REFERENCES messages(message_id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'message_deletions',
        sql: `CREATE TABLE IF NOT EXISTS message_deletions (
            deletion_id CHAR(36) PRIMARY KEY,
            message_id CHAR(36) NOT NULL,
            user_id CHAR(36) NOT NULL,
            deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_deletion (message_id, user_id),
            FOREIGN KEY (message_id) REFERENCES messages(message_id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },

    // ---- marketplace chat (scripts history, adjusted to live usage) ----
    {
        name: 'marketplace_conversations',
        sql: `CREATE TABLE IF NOT EXISTS marketplace_conversations (
            id VARCHAR(36) PRIMARY KEY,
            buyer_id VARCHAR(36) NOT NULL,
            seller_id VARCHAR(36) NOT NULL,
            listing_id CHAR(36) NOT NULL,
            last_message TEXT,
            last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            reminder_sent BOOLEAN DEFAULT FALSE,
            is_muted TINYINT(1) NOT NULL DEFAULT 0,
            is_archived TINYINT(1) NOT NULL DEFAULT 0,
            is_pinned TINYINT(1) NOT NULL DEFAULT 0,
            UNIQUE KEY unique_conversation (buyer_id, seller_id, listing_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'marketplace_messages',
        sql: `CREATE TABLE IF NOT EXISTS marketplace_messages (
            id VARCHAR(36) PRIMARY KEY,
            conversation_id VARCHAR(36) NOT NULL,
            sender_id VARCHAR(36) NOT NULL,
            message_text TEXT,
            message_type ENUM('text', 'image', 'offer', 'system') DEFAULT 'text',
            media_url VARCHAR(500) DEFAULT NULL,
            reply_to_id VARCHAR(36) DEFAULT NULL,
            is_edited BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES marketplace_conversations(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'marketplace_message_status',
        sql: `CREATE TABLE IF NOT EXISTS marketplace_message_status (
            message_id VARCHAR(36) PRIMARY KEY,
            delivered_at TIMESTAMP NULL,
            read_at TIMESTAMP NULL,
            FOREIGN KEY (message_id) REFERENCES marketplace_messages(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'marketplace_message_reactions',
        sql: `CREATE TABLE IF NOT EXISTS marketplace_message_reactions (
            reaction_id CHAR(36) PRIMARY KEY,
            message_id VARCHAR(36) NOT NULL,
            user_id CHAR(36) NOT NULL,
            emoji VARCHAR(10) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_reaction (message_id, user_id, emoji),
            FOREIGN KEY (message_id) REFERENCES marketplace_messages(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'marketplace_blocks',
        sql: `CREATE TABLE IF NOT EXISTS marketplace_blocks (
            block_id CHAR(36) PRIMARY KEY,
            blocker_id CHAR(36) NOT NULL,
            blocked_id CHAR(36) NOT NULL,
            reason TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_block (blocker_id, blocked_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'marketplace_seller_favorites',
        sql: `CREATE TABLE IF NOT EXISTS marketplace_seller_favorites (
            id CHAR(36) PRIMARY KEY,
            user_id CHAR(36) NOT NULL,
            seller_id CHAR(36) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_seller_fav (user_id, seller_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'marketplace_message_settings',
        sql: `CREATE TABLE IF NOT EXISTS marketplace_message_settings (
            user_id CHAR(36) PRIMARY KEY,
            who_can_message_me VARCHAR(20) NOT NULL DEFAULT 'everyone',
            message_filter VARCHAR(20) NOT NULL DEFAULT 'all',
            read_receipts TINYINT(1) NOT NULL DEFAULT 1,
            typing_indicators TINYINT(1) NOT NULL DEFAULT 1,
            show_online_status TINYINT(1) NOT NULL DEFAULT 1,
            auto_reply_enabled TINYINT(1) NOT NULL DEFAULT 0,
            auto_reply_text TEXT DEFAULT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'marketplace_wishlist',
        sql: `CREATE TABLE IF NOT EXISTS marketplace_wishlist (
            wishlist_id CHAR(36) PRIMARY KEY,
            user_id CHAR(36) NOT NULL,
            listing_id CHAR(36) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_wishlist_entry (user_id, listing_id),
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
            FOREIGN KEY (listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },

    // ---- clubs / campus ----
    {
        name: 'club_announcements',
        sql: `CREATE TABLE IF NOT EXISTS club_announcements (
            announcement_id CHAR(36) PRIMARY KEY,
            club_id CHAR(36) NOT NULL,
            user_id CHAR(36) NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_ca_club (club_id, created_at),
            INDEX idx_ca_user (user_id),
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'club_event_rsvps',
        sql: `CREATE TABLE IF NOT EXISTS club_event_rsvps (
            rsvp_id CHAR(36) PRIMARY KEY,
            club_id CHAR(36) NOT NULL,
            event_id CHAR(36) NOT NULL,
            user_id CHAR(36) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'going',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_club_event_rsvp (club_id, event_id, user_id),
            INDEX idx_cer_event (event_id),
            INDEX idx_cer_user (user_id),
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'poll_invites',
        sql: `CREATE TABLE IF NOT EXISTS poll_invites (
            invite_id CHAR(36) PRIMARY KEY,
            poll_id CHAR(36) NOT NULL,
            inviter_id CHAR(36) NOT NULL,
            invitee_id CHAR(36) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_pi_poll (poll_id, invitee_id),
            INDEX idx_pi_invitee (invitee_id),
            FOREIGN KEY (inviter_id) REFERENCES users(user_id) ON DELETE CASCADE,
            FOREIGN KEY (invitee_id) REFERENCES users(user_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'poll_predictions',
        sql: `CREATE TABLE IF NOT EXISTS poll_predictions (
            prediction_id CHAR(36) PRIMARY KEY,
            poll_id CHAR(36) NOT NULL,
            user_id CHAR(36) NOT NULL,
            option_id CHAR(36) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_prediction (poll_id, user_id),
            INDEX idx_pp_poll (poll_id),
            INDEX idx_pp_user (user_id),
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'user_poll_interests',
        sql: `CREATE TABLE IF NOT EXISTS user_poll_interests (
            user_id CHAR(36) NOT NULL,
            category VARCHAR(50) NOT NULL,
            interaction_count INT NOT NULL DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, category),
            INDEX idx_upi_user (user_id),
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'user_signals_bridge',
        sql: `CREATE TABLE IF NOT EXISTS user_signals_bridge (
            user_id CHAR(36) NOT NULL,
            category VARCHAR(50) NOT NULL,
            signal_strength INT NOT NULL DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, category),
            INDEX idx_usb_user (user_id),
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },

    // ---- feeds / engagement ----
    {
        name: 'post_reshares',
        sql: `CREATE TABLE IF NOT EXISTS post_reshares (
            id INT AUTO_INCREMENT PRIMARY KEY,
            post_id CHAR(36) NOT NULL,
            user_id CHAR(36) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_reshare (post_id, user_id),
            INDEX idx_pr_post (post_id),
            INDEX idx_pr_user (user_id),
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'saved_posts',
        sql: `CREATE TABLE IF NOT EXISTS saved_posts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            post_id CHAR(36) NOT NULL,
            user_id CHAR(36) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_saved (post_id, user_id),
            INDEX idx_sp_post (post_id),
            INDEX idx_sp_user (user_id),
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },

    // ---- stories ----
    {
        name: 'story_comments',
        sql: `CREATE TABLE IF NOT EXISTS story_comments (
            comment_id CHAR(36) PRIMARY KEY,
            story_id CHAR(36) NOT NULL,
            user_id CHAR(36) NOT NULL,
            text TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_story_comments_story (story_id, created_at),
            FOREIGN KEY (story_id) REFERENCES stories(story_id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'story_views',
        sql: `CREATE TABLE IF NOT EXISTS story_views (
            view_id CHAR(36) PRIMARY KEY,
            story_id CHAR(36) NOT NULL,
            user_id CHAR(36) NOT NULL,
            viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_story_view (story_id, user_id),
            INDEX idx_story_views_story (story_id),
            FOREIGN KEY (story_id) REFERENCES stories(story_id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'story_privacy_blocks',
        sql: `CREATE TABLE IF NOT EXISTS story_privacy_blocks (
            block_id CHAR(36) PRIMARY KEY,
            user_id CHAR(36) NOT NULL,
            blocked_user_id CHAR(36) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_story_block (user_id, blocked_user_id),
            INDEX idx_spb_blocked (blocked_user_id),
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
            FOREIGN KEY (blocked_user_id) REFERENCES users(user_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },

    // ---- live streams ----
    {
        name: 'stream_followers',
        sql: `CREATE TABLE IF NOT EXISTS stream_followers (
            follow_id CHAR(36) PRIMARY KEY,
            stream_id CHAR(36) NOT NULL,
            user_id CHAR(36) NOT NULL,
            followed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_stream_follow (stream_id, user_id),
            INDEX idx_stream_followers_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'stream_updates',
        sql: `CREATE TABLE IF NOT EXISTS stream_updates (
            update_id CHAR(36) PRIMARY KEY,
            stream_id CHAR(36) NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_stream_updates_stream (stream_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },

    // ---- media / support / audit ----
    {
        name: 'media_registry',
        sql: `CREATE TABLE IF NOT EXISTS media_registry (
            media_id CHAR(36) PRIMARY KEY,
            owner_id CHAR(36) NOT NULL,
            category VARCHAR(50) DEFAULT NULL,
            cloudinary_public_id VARCHAR(255) DEFAULT NULL,
            secure_url VARCHAR(500) DEFAULT NULL,
            thumbnail_url VARCHAR(500) DEFAULT NULL,
            lifecycle_state VARCHAR(30) DEFAULT 'active',
            expires_at DATETIME DEFAULT NULL,
            is_reusable TINYINT(1) DEFAULT 1,
            referenced_by_features JSON DEFAULT NULL,
            file_size_bytes BIGINT DEFAULT 0,
            hash_checksum VARCHAR(64) DEFAULT NULL,
            local_template_path VARCHAR(500) DEFAULT NULL,
            last_accessed_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_mr_owner (owner_id),
            INDEX idx_mr_checksum (owner_id, hash_checksum),
            INDEX idx_mr_expires (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'screenshot_audit',
        sql: `CREATE TABLE IF NOT EXISTS screenshot_audit (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id CHAR(36) NOT NULL,
            chat_id CHAR(36) DEFAULT NULL,
            method VARCHAR(30) DEFAULT NULL,
            ip_address VARCHAR(45) DEFAULT NULL,
            attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_sa_user (user_id, attempted_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
        name: 'support_requests',
        sql: `CREATE TABLE IF NOT EXISTS support_requests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) DEFAULT NULL,
            email VARCHAR(255) DEFAULT NULL,
            type VARCHAR(50) DEFAULT NULL,
            message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_sr_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    }
];

const initRecoveredTables = async () => {
    let ok = 0;
    let failed = 0;
    for (const t of RECOVERED_TABLES) {
        try {
            await pool.query(t.sql);
            ok++;
        } catch (err) {
            failed++;
            if (!isDuplicateError(err)) {
                logger.warn(`Recovered table '${t.name}' init failed:`, getErrorMessage(err));
            }
        }
    }
    logger.debug(`✅ Recovered tables verified: ${ok}/${RECOVERED_TABLES.length} ok, ${failed} failed/skipped`);
};

const RECOVERED_COLUMNS = [
    // push logging writes notification_id + created_at (older table shape lacks them)
    { table: 'push_notifications', column: 'notification_id', ddl: 'CHAR(36) NULL AFTER id' },
    { table: 'push_notifications', column: 'created_at', ddl: 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER data' },
    // admin identity-verification review flow (admin.controller)
    { table: 'verification_requests', column: 'status', ddl: "ENUM('pending','approved','rejected','expired') DEFAULT 'pending'" },
    { table: 'verification_requests', column: 'id_document_url', ddl: 'VARCHAR(255) NULL' },
    { table: 'verification_requests', column: 'reviewed_by', ddl: 'CHAR(36) NULL' },
    { table: 'verification_requests', column: 'review_notes', ddl: 'TEXT NULL' },
    { table: 'verification_requests', column: 'reviewed_at', ddl: 'TIMESTAMP NULL DEFAULT NULL' },
    // mention notifications (models/Post.js)
    { table: 'notifications', column: 'target_id', ddl: 'CHAR(36) NULL' },
    // listing share counter (marketplace.controller recordShare)
    { table: 'marketplace_listings', column: 'share_count', ddl: 'INT NOT NULL DEFAULT 0' },
    // message forward counter (forwardcontroller)
    { table: 'messages', column: 'forward_count', ddl: 'INT NOT NULL DEFAULT 0' },
    // chat preview text (Marketplace.js send flow)
    { table: 'personal_chats', column: 'last_message', ddl: 'TEXT NULL' },
    // login/session meta parity with canonical schema
    { table: 'login_activity', column: 'location', ddl: 'VARCHAR(255) NULL' },
    { table: 'user_sessions', column: 'device_id', ddl: 'VARCHAR(255) NULL' },
    { table: 'follow_requests', column: 'updated_at', ddl: 'TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP' },
    { table: 'user_poll_interests', column: 'updated_at', ddl: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' },
    { table: 'admin_logs', column: 'level', ddl: "ENUM('info','warning','danger') DEFAULT 'info'" },
    { table: 'admin_logs', column: 'ip_address', ddl: 'VARCHAR(45) NULL' },
    { table: 'admin_logs', column: 'user_agent', ddl: 'TEXT NULL' }
];

const repairRecoveredSchemas = async () => {
    for (const c of RECOVERED_COLUMNS) {
        try {
            const [rows] = await pool.query(
                'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
                [c.table, c.column]
            );
            if (Array.isArray(rows) && rows.length === 0) {
                await pool.query(`ALTER TABLE \`${c.table}\` ADD COLUMN \`${c.column}\` ${c.ddl}`);
                logger.debug(`Added column ${c.table}.${c.column}`);
            }
        } catch (e) {
            logger.warn(`Column repair failed for ${c.table}.${c.column}:`, getErrorMessage(e));
        }
    }

    // Missing indexes from canonical schema / migrations
    const recoveredIndexes = [
        { table: 'verification_requests', ddl: 'ALTER TABLE verification_requests ADD INDEX IF NOT EXISTS idx_verif_requests_user_time (user_id, type, requested_at)' },
        { table: 'sparks', ddl: 'ALTER TABLE sparks ADD INDEX IF NOT EXISTS idx_sparks_post_user (post_id, user_id)' }
    ];
    for (const idx of recoveredIndexes) {
        try {
            await pool.query(idx.ddl);
        } catch (e) {
            logger.warn(`Index repair failed for ${idx.table}:`, getErrorMessage(e));
        }
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

    // Initialize tables with retry logic (Batch 3 Priority)
    await retryWithBackoff(async () => {
        // Priority for current feature batch
        try { await initConfessionTables(); } catch (e) { if (!isDuplicateError(e)) logger.error('Confessions Init Error:', getErrorMessage(e)); }
        try { await repairPostsTable(); } catch (e) { if (!isDuplicateError(e)) logger.warn('Posts repair failed:', getErrorMessage(e)); }
        try { await repairStoriesTable(); } catch (e) { if (!isDuplicateError(e)) logger.warn('Stories repair failed:', getErrorMessage(e)); }
        try { await initStickerTables(); } catch (e) { if (!isDuplicateError(e)) logger.warn('Stickers init failed:', getErrorMessage(e)); }
        try { await initRepostsTable(); } catch (e) { if (!isDuplicateError(e)) logger.warn('Reposts init failed:', getErrorMessage(e)); }
        
        try { await repairUsersTable(); } catch (e) { if (!isDuplicateError(e)) logger.warn('Users repair failed:', getErrorMessage(e)); }
        try { await initHighlightsTables(); } catch (e) { if (!isDuplicateError(e)) logger.warn('Highlights init failed:', getErrorMessage(e)); }
        try { await initNotificationsTable(); } catch (e) { if (!isDuplicateError(e)) logger.warn('Notifications init failed:', getErrorMessage(e)); }
        try { await initUserInteractionsTables(); } catch (e) { if (!isDuplicateError(e)) logger.warn('Interactions init failed:', getErrorMessage(e)); }
        try { await initMomentsTable(); } catch (e) { if (!isDuplicateError(e)) logger.warn('Moments init failed:', getErrorMessage(e)); }
        try { await initMomentCommentsTable(); } catch (e) { if (!isDuplicateError(e)) logger.warn('Moment comments init failed:', getErrorMessage(e)); }
        try { await initGroupsTable(); } catch (e) { if (!isDuplicateError(e)) logger.warn('Groups init failed:', getErrorMessage(e)); }
        try { await initMessagesTable(); } catch (e) { if (!isDuplicateError(e)) logger.warn('Messages init failed:', getErrorMessage(e)); }
        try { await initStoriesTable(); } catch (e) { if (!isDuplicateError(e)) logger.warn('Stories init failed:', getErrorMessage(e)); }
        try { await initStoryLikesTable(); } catch (e) { if (!isDuplicateError(e)) logger.warn('Story likes init failed:', getErrorMessage(e)); }
        try { await initStorySharesTable(); } catch (e) { if (!isDuplicateError(e)) logger.warn('Story shares init failed:', getErrorMessage(e)); }
        try { await initCommentLikesTable(); } catch (e) { if (!isDuplicateError(e)) logger.warn('Comment likes init failed:', getErrorMessage(e)); }
        try { await initPersonalChatsTable(); } catch (e) { if (!isDuplicateError(e)) logger.warn('Personal chats init failed:', getErrorMessage(e)); }
        try { await initChatPrivacySettingsTable(); } catch (e) { if (!isDuplicateError(e)) logger.warn('Chat privacy settings table init failed:', getErrorMessage(e)); }
        try { await initLostFoundTable(); } catch (e) { if (!isDuplicateError(e)) logger.warn('LostFound init failed:', getErrorMessage(e)); }
        try { await initSkillMarketTable(); } catch (e) { if (!isDuplicateError(e)) logger.warn('SkillMarket init failed:', getErrorMessage(e)); }
        try { await initMarketplaceTables(); } catch (e) { if (!isDuplicateError(e)) logger.error('Marketplace Init Error:', getErrorMessage(e)); }
        try { await initSearchTables(); } catch (e) { if (!isDuplicateError(e)) logger.error('Search Tables Init Error:', getErrorMessage(e)); }
        try { await initHighlightsTables(); } catch (e) { if (!isDuplicateError(e)) logger.error('Highlights Tables Init Error:', getErrorMessage(e)); }
        try { await initUserActionsTable(); } catch (e) { if (!isDuplicateError(e)) logger.error('User Actions Init Error:', getErrorMessage(e)); }
        try { await initModerationTables(); } catch (e) { if (!isDuplicateError(e)) logger.error('Moderation Tables Init Error:', getErrorMessage(e)); }
        try { await initOtaTable(); } catch (e) { if (!isDuplicateError(e)) logger.error('OTA Init Error:', getErrorMessage(e)); }
        try { await initRecoveredTables(); } catch (e) { if (!isDuplicateError(e)) logger.error('Recovered Tables Init Error:', getErrorMessage(e)); }
        try { await repairRecoveredSchemas(); } catch (e) { if (!isDuplicateError(e)) logger.error('Recovered Schemas Repair Error:', getErrorMessage(e)); }
    });
    
    logger.debug('✅ Database initialization process complete');
};

module.exports = { initDB };
