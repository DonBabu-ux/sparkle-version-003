const pool = require('./config/database');

async function migrate() {
    try {
        console.log('🚀 Updating group_members role ENUM...');
        
        // Add 'super_admin' and 'owner' to the role ENUM in group_members
        // We also ensure it has member, moderator, admin
        await pool.query(`
            ALTER TABLE group_members 
            MODIFY COLUMN role ENUM('member', 'moderator', 'admin', 'super_admin', 'owner') DEFAULT 'member'
        `);
        
        console.log('✅ group_members schema updated.');

        // Update existing owners to super_admin if needed
        // For now, we'll just ensure the schema is ready.
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrate();
