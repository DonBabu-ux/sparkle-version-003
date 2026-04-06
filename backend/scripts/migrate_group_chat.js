const db = require('../config/database');

async function migrate() {
    console.log('Starting migration...');
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Create group_chats
        console.log('Creating group_chats table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`group_chats\` (
              \`chat_id\` CHAR(36) NOT NULL,
              \`creator_id\` CHAR(36) NOT NULL,
              \`name\` VARCHAR(100) DEFAULT NULL,
              \`photo_url\` VARCHAR(500) DEFAULT NULL,
              \`privacy\` ENUM('open', 'locked') DEFAULT 'open',
              \`is_private\` TINYINT(1) DEFAULT 1,
              \`approval_required\` TINYINT(1) DEFAULT 0,
              \`allow_media\` TINYINT(1) DEFAULT 1,
              \`allow_voice_notes\` TINYINT(1) DEFAULT 1,
              \`allow_video_calls\` TINYINT(1) DEFAULT 1,
              \`allow_reactions\` TINYINT(1) DEFAULT 1,
              \`allow_message_sharing\` TINYINT(1) DEFAULT 1,
              \`last_message_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (\`chat_id\`),
              FOREIGN KEY (\`creator_id\`) REFERENCES \`users\`(\`user_id\`) ON DELETE CASCADE,
              INDEX \`idx_group_chats_creator\` (\`creator_id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 2. Create group_chat_members
        console.log('Creating group_chat_members table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`group_chat_members\` (
              \`membership_id\` CHAR(36) NOT NULL,
              \`chat_id\` CHAR(36) NOT NULL,
              \`user_id\` CHAR(36) NOT NULL,
              \`role\` ENUM('member', 'admin', 'creator') DEFAULT 'member',
              \`status\` ENUM('active', 'muted', 'left', 'removed', 'pending') DEFAULT 'active',
              \`nickname\` VARCHAR(50) DEFAULT NULL,
              \`joined_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              \`last_seen\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (\`membership_id\`),
              UNIQUE KEY \`unique_chat_member\` (\`chat_id\`, \`user_id\`),
              FOREIGN KEY (\`chat_id\`) REFERENCES \`group_chats\`(\`chat_id\`) ON DELETE CASCADE,
              FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`user_id\`) ON DELETE CASCADE,
              INDEX \`idx_chat_members_user\` (\`user_id\`, \`joined_at\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 3. Create video_calls
        console.log('Creating video_calls table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`video_calls\` (
              \`call_id\` CHAR(36) NOT NULL,
              \`chat_id\` CHAR(36) NOT NULL,
              \`started_by\` CHAR(36) NOT NULL,
              \`status\` ENUM('active', 'ended', 'missed') DEFAULT 'active',
              \`started_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              \`ended_at\` TIMESTAMP NULL DEFAULT NULL,
              PRIMARY KEY (\`call_id\`),
              FOREIGN KEY (\`chat_id\`) REFERENCES \`group_chats\`(\`chat_id\`) ON DELETE CASCADE,
              FOREIGN KEY (\`started_by\` ) REFERENCES \`users\`(\`user_id\`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 4. Update messages table
        console.log('Updating messages table...');

        // Helper to check column existence
        const [columns] = await connection.query(`SHOW COLUMNS FROM messages LIKE 'chat_id'`);
        if (columns.length === 0) {
            console.log('Adding chat_id column...');
            await connection.query(`ALTER TABLE \`messages\` ADD COLUMN \`chat_id\` CHAR(36) DEFAULT NULL AFTER \`message_id\``);
            await connection.query(`ALTER TABLE \`messages\` ADD CONSTRAINT \`fk_messages_chat\` FOREIGN KEY (\`chat_id\`) REFERENCES \`group_chats\`(\`chat_id\`) ON DELETE CASCADE`);
            await connection.query(`CREATE INDEX \`idx_messages_chat\` ON \`messages\`(\`chat_id\`, \`sent_at\`)`);
        } else {
            console.log('chat_id already exists.');
        }

        const [typeCol] = await connection.query(`SHOW COLUMNS FROM messages LIKE 'type'`);
        if (typeCol.length === 0) {
            console.log('Adding type and media_url columns...');
            await connection.query(`ALTER TABLE \`messages\` ADD COLUMN \`type\` ENUM('text', 'image', 'video', 'voice_note', 'post_share', 'system', 'call') DEFAULT 'text' AFTER \`recipient_id\``);
            await connection.query(`ALTER TABLE \`messages\` ADD COLUMN \`media_url\` VARCHAR(500) DEFAULT NULL AFTER \`content\``);
        } else {
            console.log('type/media_url already exist.');
        }

        // Fix nullable recipient_id (it was NOT NULL before, assuming direct messages only)
        // We need to make recipient_id nullable because group messages don't have a recipient_id
        console.log('Modifying recipient_id to be nullable...');
        await connection.query(`ALTER TABLE \`messages\` MODIFY COLUMN \`recipient_id\` CHAR(36) NULL`);

        // Add constraint check ? (Optional, maybe too complex for simple migration if data exists)
        // await connection.query(`ALTER TABLE messages ADD CONSTRAINT chk_msg_dest CHECK ((chat_id IS NOT NULL AND recipient_id IS NULL) OR (chat_id IS NULL AND recipient_id IS NOT NULL))`);

        await connection.commit();
        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        await connection.rollback();
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        connection.release();
    }
}

migrate();
