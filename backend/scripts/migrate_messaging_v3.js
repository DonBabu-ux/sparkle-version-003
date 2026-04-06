const db = require('../config/database');
const crypto = require('crypto');

async function migrate() {
    console.log('Starting Messaging V3 migration...');
    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Update personal_chats table for archive, mute, pin
        console.log('Updating personal_chats table...');
        const [pcCols] = await connection.query(`SHOW COLUMNS FROM personal_chats`);
        const pcColNames = pcCols.map(c => c.Field);

        const pcNewCols = [
            { name: 'is_archived_p1', type: 'TINYINT(1) DEFAULT 0' },
            { name: 'is_archived_p2', type: 'TINYINT(1) DEFAULT 0' },
            { name: 'is_muted_p1', type: 'TINYINT(1) DEFAULT 0' },
            { name: 'is_muted_p2', type: 'TINYINT(1) DEFAULT 0' },
            { name: 'is_pinned_p1', type: 'TINYINT(1) DEFAULT 0' },
            { name: 'is_pinned_p2', type: 'TINYINT(1) DEFAULT 0' }
        ];

        for (const col of pcNewCols) {
            if (!pcColNames.includes(col.name)) {
                console.log(`Adding ${col.name} to personal_chats...`);
                await connection.query(`ALTER TABLE personal_chats ADD COLUMN ${col.name} ${col.type}`);
            }
        }

        // 2. Update messages table
        console.log('Updating messages table...');
        const [mCols] = await connection.query(`SHOW COLUMNS FROM messages`);
        const mColNames = mCols.map(c => c.Field);

        const mNewCols = [
            { name: 'status', type: "ENUM('sent', 'delivered', 'read') DEFAULT 'sent'" },
            { name: 'reply_to_message_id', type: 'CHAR(36) DEFAULT NULL' },
            { name: 'edited_at', type: 'TIMESTAMP NULL DEFAULT NULL' },
            { name: 'is_deleted_for_everyone', type: 'TINYINT(1) DEFAULT 0' }
        ];

        for (const col of mNewCols) {
            if (!mColNames.includes(col.name)) {
                console.log(`Adding ${col.name} to messages...`);
                await connection.query(`ALTER TABLE messages ADD COLUMN ${col.name} ${col.type}`);
            }
        }

        // Add FK for reply_to_message_id if it was just added and not yet constrained
        try {
            await connection.query(`ALTER TABLE messages ADD CONSTRAINT fk_messages_reply FOREIGN KEY (reply_to_message_id) REFERENCES messages(message_id) ON DELETE SET NULL`);
            console.log('Added FK constraint to messages.reply_to_message_id');
        } catch (fkErr) {
            if (fkErr.code !== 'ER_DUP_CONSTRAINT_NAME' && fkErr.code !== 'ER_FK_DUP_NAME') {
                console.log('FK constraint for reply_to_message_id already exists or error:', fkErr.message);
            }
        }

        // 3. Create message_reactions table
        console.log('Creating message_reactions table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS message_reactions (
                reaction_id CHAR(36) PRIMARY KEY,
                message_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                emoji VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_reaction (message_id, user_id, emoji),
                FOREIGN KEY (message_id) REFERENCES messages(message_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 4. Create message_deletions table (for "Delete for me")
        console.log('Creating message_deletions table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS message_deletions (
                deletion_id CHAR(36) PRIMARY KEY,
                message_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_deletion (message_id, user_id),
                FOREIGN KEY (message_id) REFERENCES messages(message_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 5. Ensure users table has online status fields
        console.log('Verifying users table fields...');
        const [uCols] = await connection.query(`SHOW COLUMNS FROM users`);
        const uColNames = uCols.map(c => c.Field);
        if (!uColNames.includes('is_online')) {
            console.log('Adding is_online to users...');
            await connection.query(`ALTER TABLE users ADD COLUMN is_online TINYINT(1) DEFAULT 0`);
        }
        if (!uColNames.includes('last_seen_at')) {
            console.log('Adding last_seen_at to users...');
            await connection.query(`ALTER TABLE users ADD COLUMN last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        }

        await connection.commit();
        console.log('Migration V3 completed successfully.');
        process.exit(0);
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Migration V3 failed:', error);
        process.exit(1);
    } finally {
        if (connection) connection.release();
    }
}

migrate();
