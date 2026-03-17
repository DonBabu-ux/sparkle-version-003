require('dotenv').config();
const pool = require('./config/database');

async function addStatusColumn() {
    try {
        console.log('Adding status column to marketplace_listings...');
        await pool.query(`
            ALTER TABLE marketplace_listings
            ADD COLUMN IF NOT EXISTS status ENUM('active', 'sold', 'pending', 'deleted') DEFAULT 'active'
        `);
        console.log('Status column added successfully.');
    } catch (error) {
        console.error('Error adding status column:', error);
    } finally {
        process.exit();
    }
}

addStatusColumn();