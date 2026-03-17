const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../config/database');

async function migrate() {
    try {
        console.log('Running migrations...');
        
        // Add columns to marketplace_listings
        await pool.query(`
            ALTER TABLE marketplace_listings 
            ADD COLUMN is_featured TINYINT(1) DEFAULT 0 AFTER is_sold
        `).catch(e => console.log('is_featured might already exist:', e.message));

        await pool.query(`
            ALTER TABLE marketplace_listings 
            ADD COLUMN is_negotiable TINYINT(1) DEFAULT 0 AFTER is_featured
        `).catch(e => console.log('is_negotiable might already exist:', e.message));

        console.log('Migrations completed successfully');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
