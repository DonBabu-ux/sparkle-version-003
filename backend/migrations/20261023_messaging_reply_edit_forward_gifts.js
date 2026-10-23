const db = require('../config/database');
const logger = require('../utils/logger');

async function migrateMessagingReplyEditForwardGifts() {
    logger.info('Starting migration: 20261023_messaging_reply_edit_forward_gifts');

    // 1. Columns for messages table
    const columns = [
        { name: 'is_edited', type: 'TINYINT(1) DEFAULT 0' },
        { name: 'edited', type: 'TINYINT(1) DEFAULT 0' },
        { name: 'edited_at', type: 'DATETIME NULL' },
        { name: 'reply_to_message_id', type: 'VARCHAR(36) NULL' },
        { name: 'forwarded', type: 'TINYINT(1) DEFAULT 0' },
        { name: 'forwarded_from', type: 'VARCHAR(128) NULL' },
        { name: 'forward_count', type: 'INT DEFAULT 0' },
        { name: 'source_message_id', type: 'VARCHAR(36) NULL' },
        { name: 'forward_lineage_id', type: 'VARCHAR(36) NULL' },
        { name: 'idempotency_key', type: 'VARCHAR(128) NULL' }
    ];

    try {
        const [existingCols] = await db.query('SHOW COLUMNS FROM messages');
        const colNames = new Set((existingCols || []).map(c => c.Field));

        for (const col of columns) {
            if (!colNames.has(col.name)) {
                logger.info(`+ Adding column ${col.name} to messages`);
                await db.query(`ALTER TABLE messages ADD COLUMN ${col.name} ${col.type}`);
            }
        }
    } catch (err) {
        logger.warn('[Migration] Note on adding columns to messages:', err.message);
    }

    // 2. Indexes on messages
    const indexes = [
        { name: 'idx_messages_reply_to', sql: 'ALTER TABLE messages ADD INDEX idx_messages_reply_to (reply_to_message_id)' },
        { name: 'idx_messages_forward_lineage', sql: 'ALTER TABLE messages ADD INDEX idx_messages_forward_lineage (forward_lineage_id)' },
        { name: 'idx_messages_idempotency', sql: 'ALTER TABLE messages ADD INDEX idx_messages_idempotency (idempotency_key)' }
    ];

    for (const idx of indexes) {
        try {
            await db.query(idx.sql);
        } catch (e) {
            // Already exists or index supported
        }
    }

    // 3. Create canonical_media_assets table
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS canonical_media_assets (
                asset_id VARCHAR(128) PRIMARY KEY,
                provider VARCHAR(64) NOT NULL,
                provider_media_id VARCHAR(128) NULL,
                media_url VARCHAR(1024) NOT NULL,
                media_type VARCHAR(32) NOT NULL DEFAULT 'gif',
                metadata JSON NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_canonical_provider (provider, provider_media_id),
                INDEX idx_canonical_url (media_url(255))
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        logger.info('Canonical media assets table ensured');
    } catch (err) {
        logger.warn('[Migration] Error creating canonical_media_assets:', err.message);
    }

    // 4. Create message_forward_deliveries table
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS message_forward_deliveries (
                delivery_id VARCHAR(36) PRIMARY KEY,
                source_message_id VARCHAR(36) NOT NULL,
                forwarded_message_id VARCHAR(36) NOT NULL,
                destination_chat_id VARCHAR(36) NOT NULL,
                forwarded_by_user_id VARCHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                idempotency_key VARCHAR(128) UNIQUE,
                INDEX idx_fwd_source (source_message_id),
                INDEX idx_fwd_dest (destination_chat_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        logger.info('Message forward deliveries table ensured');
    } catch (err) {
        logger.warn('[Migration] Error creating message_forward_deliveries:', err.message);
    }

    logger.info('Migration 20261023_messaging_reply_edit_forward_gifts completed');
}

module.exports = migrateMessagingReplyEditForwardGifts;
if (require.main === module) {
    migrateMessagingReplyEditForwardGifts()
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}
