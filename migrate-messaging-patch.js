require('dotenv').config();
const pool = require('./config/database');

async function migrate() {
    try {
        console.log('--- Migrating Database ---');
        
        // 1. personal_chats: Add is_deleted_p1 and is_deleted_p2
        const [pcCols] = await pool.query('SHOW COLUMNS FROM personal_chats');
        const pcColNames = pcCols.map(c => c.Field);
        
        if (!pcColNames.includes('is_deleted_p1')) {
            await pool.query('ALTER TABLE personal_chats ADD COLUMN is_deleted_p1 TINYINT(1) DEFAULT 0');
            console.log('Added is_deleted_p1 to personal_chats');
        }
        if (!pcColNames.includes('is_deleted_p2')) {
            await pool.query('ALTER TABLE personal_chats ADD COLUMN is_deleted_p2 TINYINT(1) DEFAULT 0');
            console.log('Added is_deleted_p2 to personal_chats');
        }

        // 2. group_chats: Add description, only_admins_send, only_admins_edit
        const [gcCols] = await pool.query('SHOW COLUMNS FROM group_chats');
        const gcColNames = gcCols.map(c => c.Field);
        
        if (!gcColNames.includes('description')) {
            await pool.query('ALTER TABLE group_chats ADD COLUMN description TEXT DEFAULT NULL');
            console.log('Added description to group_chats');
        }
        if (!gcColNames.includes('only_admins_send')) {
            await pool.query('ALTER TABLE group_chats ADD COLUMN only_admins_send TINYINT(1) DEFAULT 0');
            console.log('Added only_admins_send to group_chats');
        }
        if (!gcColNames.includes('only_admins_edit')) {
            await pool.query('ALTER TABLE group_chats ADD COLUMN only_admins_edit TINYINT(1) DEFAULT 0');
            console.log('Added only_admins_edit to group_chats');
        }

        // 3. user_blocks: Ensure it exists (it should, but just in case)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_blocks (
                block_id CHAR(36) PRIMARY KEY,
                blocker_id CHAR(36) NOT NULL,
                blocked_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_block (blocker_id, blocked_id)
            )
        `);
        console.log('Verified user_blocks table');

        console.log('--- Migration Complete ---');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit();
    }
}

migrate();
