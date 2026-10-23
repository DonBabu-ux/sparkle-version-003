require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../config/database');
const logger = require('../utils/logger');

async function migrateChatNicknamesAndDisappearing() {
    logger.info('Starting migration: 20261023_chat_nicknames_and_disappearing');

    // 1. Create chat_nicknames table
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS chat_nicknames (
                id VARCHAR(36) PRIMARY KEY,
                chat_id VARCHAR(64) NOT NULL,
                user_id VARCHAR(36) NOT NULL,
                nickname VARCHAR(64) NOT NULL,
                set_by_id VARCHAR(36) NOT NULL,
                version INT DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_chat_user_nick (chat_id, user_id),
                INDEX idx_chat_nicknames_chat (chat_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        logger.info('chat_nicknames table ensured');
    } catch (err) {
        logger.warn('[Migration] Note creating chat_nicknames table:', err.message);
    }

    // 2. Add disappearing concurrency columns to personal_chats and group_chats
    const addCol = async (table, colDef) => {
        try {
            await db.query(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
            logger.info(`+ Added column ${colDef.split(' ')[0]} to ${table}`);
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME' || err.message?.includes('Duplicate column')) {
                // Ignore
            } else {
                logger.warn(`[Migration] Column ${colDef.split(' ')[0]} on ${table}:`, err.message);
            }
        }
    };

    await addCol('personal_chats', 'disappearing_version INT DEFAULT 1');
    await addCol('personal_chats', 'disappearing_updated_at TIMESTAMP NULL');
    await addCol('personal_chats', 'disappearing_updated_by VARCHAR(36) NULL');

    await addCol('group_chats', 'disappearing_version INT DEFAULT 1');
    await addCol('group_chats', 'disappearing_updated_at TIMESTAMP NULL');
    await addCol('group_chats', 'disappearing_updated_by VARCHAR(36) NULL');

    logger.info('Migration 20261023_chat_nicknames_and_disappearing completed');
}

module.exports = migrateChatNicknamesAndDisappearing;
if (require.main === module) {
    require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
    migrateChatNicknamesAndDisappearing()
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}
