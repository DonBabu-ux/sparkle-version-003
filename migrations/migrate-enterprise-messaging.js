require('dotenv').config();
const db = require('../config/database');

async function migrateEnterpriseMessaging() {
    console.log('🚀 Starting Enterprise Messaging Schema Migration...');
    try {
        // 1. Add new columns to messages table if they don't exist
        const columnsToAdd = [
            { name: 'server_sequence', type: 'BIGINT DEFAULT 0' },
            { name: 'version', type: 'INT DEFAULT 1' },
            { name: 'delivered_at', type: 'DATETIME NULL' },
            { name: 'failed_at', type: 'DATETIME NULL' },
            { name: 'payload_hash', type: 'VARCHAR(128) NULL' }
        ];

        const [existingCols] = await db.query('SHOW COLUMNS FROM messages');
        const colNames = existingCols.map(c => c.Field);

        for (const col of columnsToAdd) {
            if (!colNames.includes(col.name)) {
                console.log(`+ Adding column ${col.name} to messages table...`);
                await db.query(`ALTER TABLE messages ADD COLUMN ${col.name} ${col.type}`);
            }
        }

        // Add index on server_sequence if missing
        try {
            await db.query('ALTER TABLE messages ADD INDEX idx_server_seq (chat_id, server_sequence)');
        } catch (e) {
            // Index might already exist
        }

        // 2. Create or alter user_sessions table
        console.log('+ Setting up user_sessions table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS user_sessions (
                session_id VARCHAR(128) PRIMARY KEY,
                user_id VARCHAR(128) NOT NULL,
                socket_id VARCHAR(128) NULL,
                platform VARCHAR(64) DEFAULT 'web',
                push_token VARCHAR(512) NULL,
                last_active_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                is_online TINYINT(1) DEFAULT 1,
                INDEX idx_user_sessions (user_id, is_online)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        `);

        // Check if user_sessions needs column migration
        const [sessionCols] = await db.query('SHOW COLUMNS FROM user_sessions');
        const sessionColNames = sessionCols.map(c => c.Field);
        const sessionColsToAdd = [
            { name: 'socket_id', type: 'VARCHAR(128) NULL' },
            { name: 'platform', type: "VARCHAR(64) DEFAULT 'web'" },
            { name: 'push_token', type: 'VARCHAR(512) NULL' },
            { name: 'last_active_at', type: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' },
            { name: 'is_online', type: 'TINYINT(1) DEFAULT 1' }
        ];

        for (const col of sessionColsToAdd) {
            if (!sessionColNames.includes(col.name)) {
                console.log(`+ Adding column ${col.name} to user_sessions table...`);
                await db.query(`ALTER TABLE user_sessions ADD COLUMN ${col.name} ${col.type}`);
            }
        }

        // 3. Create delivery_queue table
        console.log('+ Creating delivery_queue table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS delivery_queue (
                queue_id VARCHAR(128) PRIMARY KEY,
                message_id VARCHAR(128) NOT NULL,
                recipient_id VARCHAR(128) NOT NULL,
                session_id VARCHAR(128) NOT NULL,
                attempts INT DEFAULT 0,
                next_retry_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_delivery_retry (next_retry_at, attempts),
                INDEX idx_delivery_recipient (recipient_id, session_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 5. Create / Update message_reactions table
        console.log('+ Setting up message_reactions table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS message_reactions (
                reaction_id VARCHAR(128) PRIMARY KEY,
                message_id VARCHAR(128) NOT NULL,
                user_id VARCHAR(128) NOT NULL,
                emoji VARCHAR(64) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_msg_reactions (message_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        `);

        // Check if unique_reaction index exists and ensure it is on (message_id, user_id)
        try {
            // First add standalone index on message_id if missing so foreign key constraint remains happy
            try {
                await db.query('ALTER TABLE message_reactions ADD INDEX idx_msg_reactions (message_id)');
            } catch (e) {}

            const [indexes] = await db.query("SHOW KEYS FROM message_reactions WHERE Key_name = 'unique_reaction'");
            if (indexes.length > 0 && indexes.length === 3) {
                console.log('+ Dropping legacy 3-column unique_reaction index...');
                await db.query('ALTER TABLE message_reactions DROP INDEX unique_reaction');
            }

            console.log('+ Deduplicating legacy message_reactions rows...');
            await db.query(`
                DELETE r1 FROM message_reactions r1
                INNER JOIN message_reactions r2 
                ON r1.message_id = r2.message_id 
               AND r1.user_id = r2.user_id 
               AND r1.created_at < r2.created_at
            `);

            const [checkIndex] = await db.query("SHOW KEYS FROM message_reactions WHERE Key_name = 'unique_reaction'");
            if (checkIndex.length === 0) {
                console.log('+ Adding new 2-column unique_reaction (message_id, user_id) constraint...');
                await db.query('ALTER TABLE message_reactions ADD UNIQUE KEY unique_reaction (message_id, user_id)');
            }
        } catch (e) {
            console.log('Index update notice:', e.message);
        }

        // Ensure updated_at column exists in message_reactions
        const [mrCols] = await db.query('SHOW COLUMNS FROM message_reactions');
        const mrColNames = mrCols.map(c => c.Field);
        if (!mrColNames.includes('updated_at')) {
            console.log('+ Adding column updated_at to message_reactions table...');
            await db.query('ALTER TABLE message_reactions ADD COLUMN updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP');
        }

        // 6. Create message_stars table
        console.log('+ Creating message_stars table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS message_stars (
                star_id VARCHAR(128) PRIMARY KEY,
                message_id VARCHAR(128) NOT NULL,
                user_id VARCHAR(128) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_star (message_id, user_id),
                INDEX idx_user_stars (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        `);

        // 7. Create message_bookmarks table
        console.log('+ Creating message_bookmarks table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS message_bookmarks (
                bookmark_id VARCHAR(128) PRIMARY KEY,
                message_id VARCHAR(128) NOT NULL,
                user_id VARCHAR(128) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_bookmark (message_id, user_id),
                INDEX idx_user_bookmarks (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        `);

        // 8. Create message_pins table
        console.log('+ Creating message_pins table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS message_pins (
                pin_id VARCHAR(128) PRIMARY KEY,
                chat_id VARCHAR(128) NOT NULL,
                message_id VARCHAR(128) NOT NULL,
                pinned_by VARCHAR(128) NOT NULL,
                pinned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_chat_pin (chat_id, message_id),
                INDEX idx_chat_pins (chat_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        `);

        // 9. Create interaction_events table
        console.log('+ Creating interaction_events table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS interaction_events (
                event_id VARCHAR(128) PRIMARY KEY,
                chat_id VARCHAR(128) NOT NULL,
                message_id VARCHAR(128) NOT NULL,
                event_type VARCHAR(64) NOT NULL,
                payload JSON NOT NULL,
                sequence_no BIGINT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_chat_seq (chat_id, sequence_no)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        `);

        // 10. Additional columns for messages (is_edited, edited_at, is_deleted_for_everyone, deleted_at)
        const msgColsToAdd = [
            { name: 'is_edited', type: 'TINYINT(1) DEFAULT 0' },
            { name: 'edited_at', type: 'DATETIME NULL' },
            { name: 'is_deleted_for_everyone', type: 'TINYINT(1) DEFAULT 0' },
            { name: 'deleted_at', type: 'DATETIME NULL' }
        ];

        for (const col of msgColsToAdd) {
            if (!colNames.includes(col.name)) {
                console.log(`+ Adding column ${col.name} to messages table...`);
                await db.query(`ALTER TABLE messages ADD COLUMN ${col.name} ${col.type}`);
            }
        }

        console.log('✅ Migration executed successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        process.exit(0);
    }
}

migrateEnterpriseMessaging();
