require('dotenv').config();
const pool = require('./config/database');

async function migrateProfilePrivacyAndBirthday() {
    try {
        console.log('🚀 Starting profile privacy and birthday migration...');

        // Add columns to users table
        const addColumnsQuery = `
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS birthday DATE DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS show_contact_info TINYINT(1) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS show_birthday TINYINT(1) DEFAULT 1;
        `;

        await pool.query(addColumnsQuery);
        console.log('✅ Users table updated with birthday and privacy fields.');

        // Update example data
        const [users] = await pool.query('SELECT user_id FROM users LIMIT 1');
        if (users.length > 0) {
            await pool.query(`
                UPDATE users SET 
                birthday = '1999-05-21',
                show_birthday = 1,
                show_contact_info = 0
                WHERE user_id = ?
            `, [users[0].user_id]);
        }

        console.log('🎉 Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrateProfilePrivacyAndBirthday();
