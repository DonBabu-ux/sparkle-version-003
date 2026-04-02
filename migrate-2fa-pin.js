require('dotenv').config();
const pool = require('./config/database');

async function migrate() {
    try {
        console.log('🚀 Starting 2FA PIN migration...');

        // Add two_factor_pin and ensure two_factor_enabled exists
        const [cols] = await pool.query('DESCRIBE users');
        
        if (!cols.some(c => c.Field === 'two_factor_enabled')) {
            console.log('Adding two_factor_enabled...');
            await pool.query('ALTER TABLE users ADD COLUMN two_factor_enabled TINYINT(1) DEFAULT 0');
        }

        if (!cols.some(c => c.Field === 'two_factor_pin')) {
            console.log('Adding two_factor_pin...');
            await pool.query('ALTER TABLE users ADD COLUMN two_factor_pin VARCHAR(255) DEFAULT NULL');
        }

        console.log('✅ Users table updated successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
