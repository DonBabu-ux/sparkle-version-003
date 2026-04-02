require('dotenv').config();
const pool = require('./config/database');

async function migrate() {
    try {
        console.log('Migrating users table...');
        
        // Check if security_token exists
        const [columns] = await pool.query('SHOW COLUMNS FROM users');
        const columnNames = columns.map(c => c.Field);
        
        if (!columnNames.includes('security_token')) {
            await pool.query('ALTER TABLE users ADD COLUMN security_token VARCHAR(255) DEFAULT NULL');
            console.log('Added security_token');
        }
        
        if (!columnNames.includes('two_factor_pin')) {
            await pool.query('ALTER TABLE users ADD COLUMN two_factor_pin VARCHAR(255) DEFAULT NULL');
            console.log('Added two_factor_pin');
        }

        if (!columnNames.includes('two_factor_enabled')) {
            await pool.query('ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE');
            console.log('Added two_factor_enabled');
        }

        if (!columnNames.includes('show_contact_info')) {
            await pool.query('ALTER TABLE users ADD COLUMN show_contact_info BOOLEAN DEFAULT TRUE');
            console.log('Added show_contact_info');
        }

        console.log('Migration complete!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
