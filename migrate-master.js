require('dotenv').config();
const pool = require('./config/database');

async function migrate() {
    try {
        console.log('Starting Master Migration...');

        // 1. Update group_chats
        const [gcRows] = await pool.query('DESCRIBE group_chats');
        if (!gcRows.some(c => c.Field === 'only_admins_send')) {
            console.log('Adding only_admins_send to group_chats...');
            await pool.query('ALTER TABLE group_chats ADD COLUMN only_admins_send TINYINT(1) DEFAULT 0');
        }
        if (!gcRows.some(c => c.Field === 'edit_info')) {
            console.log('Adding edit_info to group_chats...');
            await pool.query("ALTER TABLE group_chats ADD COLUMN edit_info ENUM('admins', 'members') DEFAULT 'admins'");
        }

        // 2. Update messages
        const [mRows] = await pool.query('DESCRIBE messages');
        if (!mRows.some(c => c.Field === 'context')) {
            console.log('Adding context to messages...');
            await pool.query("ALTER TABLE messages ADD COLUMN context ENUM('chat', 'marketplace') DEFAULT 'chat' AFTER type");
        }

        console.log('Migration Successfully Completed!');
    } catch (err) {
        console.error('Migration Failed:', err);
    } finally {
        process.exit();
    }
}

migrate();
