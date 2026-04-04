require('dotenv').config();
const db = require('./config/database');

async function migrate() {
    console.log('🚀 Starting Messaging Patch V4 Migration...');

    try {
        // 1. Ensure personal_chats has required columns for archiving/muting
        await db.query(`
            ALTER TABLE personal_chats
            ADD COLUMN IF NOT EXISTS is_archived_p1 TINYINT(1) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS is_archived_p2 TINYINT(1) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS is_muted_p1 TINYINT(1) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS is_muted_p2 TINYINT(1) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS is_deleted_p1 TINYINT(1) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS is_deleted_p2 TINYINT(1) DEFAULT 0;
        `);

        // 2. Ensure group_chats has required columns for admin controls
        await db.query(`
            ALTER TABLE group_chats
            ADD COLUMN IF NOT EXISTS description TEXT NULL,
            ADD COLUMN IF NOT EXISTS only_admins_send TINYINT(1) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS only_admins_edit TINYINT(1) DEFAULT 0;
        `);

        // 3. Ensure messages table can handle the 'system' and 'voice_note' types if not already there
        // Note: MariaDB handles ENUM updates smoothly if they already contain the values
        // If it's a TEXT or VARCHAR column, no change needed. We'll check if it's ENUM.
        const [columns] = await db.query('SHOW COLUMNS FROM messages LIKE "type"');
        if (columns.length > 0 && columns[0].Type.includes('enum')) {
            await db.query(`
                ALTER TABLE messages
                MODIFY COLUMN type ENUM('text', 'image', 'video', 'audio', 'file', 'system', 'voice_note', 'location', 'contact') DEFAULT 'text';
            `);
        }

        console.log('✅ Migration V4 completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration V4 failed:', err);
        process.exit(1);
    }
}

migrate();
