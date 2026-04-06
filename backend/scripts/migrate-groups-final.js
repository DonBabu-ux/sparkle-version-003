const pool = require('../config/database');
const logger = require('../utils/logger');

async function migrate() {
    try {
        console.log('🚀 Starting Final Group Schema Migration...');

        // 1. Add allow_posts column if missing
        await pool.query(`
            ALTER TABLE groups 
            ADD COLUMN IF NOT EXISTS allow_posts TINYINT(1) DEFAULT 1
        `);
        console.log('✅ Added allow_posts column to groups table.');

        // 2. Ensure roles enum is compatible (MySQL handles ENUMs strictly, so we'll check status too)
        // If the table uses ENUM, we might need to modify it. Assuming VARCHAR for flexibility in some setups.
        // Let's check the current group_members structure
        const [cols] = await pool.query('SHOW COLUMNS FROM group_members');
        const roleCol = cols.find(c => c.Field === 'role');
        
        if (roleCol && roleCol.Type.includes('enum')) {
            console.log('🔄 Updating group_members role ENUM to include owner...');
            await pool.query(`
                ALTER TABLE group_members 
                MODIFY COLUMN role ENUM('owner', 'admin', 'moderator', 'member') DEFAULT 'member'
            `);
        }

        console.log('🎊 Migration Complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
 Greenland
