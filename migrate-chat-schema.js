require('dotenv').config();
const pool = require('./config/database');
async function migrateChat() {
    try {
        const [pcRows] = await pool.query('DESCRIBE personal_chats');
        if (!pcRows.some(c => c.Field === 'marketplace_listing_id')) {
            console.log('Adding marketplace_listing_id to personal_chats...');
            await pool.query('ALTER TABLE personal_chats ADD COLUMN marketplace_listing_id CHAR(36) DEFAULT NULL AFTER created_at');
            await pool.query('ALTER TABLE personal_chats ADD CONSTRAINT fk_chats_listing FOREIGN KEY (marketplace_listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE SET NULL');
        } else {
            console.log('marketplace_listing_id already exists in personal_chats.');
        }
        
        const [mRows] = await pool.query('DESCRIBE messages');
        if (!mRows.some(c => c.Field === 'marketplace_listing_id')) {
            console.log('Adding marketplace_listing_id to messages...');
            await pool.query('ALTER TABLE messages ADD COLUMN marketplace_listing_id CHAR(36) DEFAULT NULL AFTER sender_id');
            await pool.query('ALTER TABLE messages ADD CONSTRAINT fk_messages_listing FOREIGN KEY (marketplace_listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE SET NULL');
        } else {
            console.log('marketplace_listing_id already exists in messages.');
        }
        
        console.log('Migration complete!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit();
    }
}
migrateChat();
