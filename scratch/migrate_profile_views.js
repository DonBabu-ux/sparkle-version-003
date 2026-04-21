const pool = require('../config/database');

async function runMigration() {
    try {
        console.log('Running migration to add profile_views column...');
        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_views INT DEFAULT 0');
        console.log('Migration successful!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
