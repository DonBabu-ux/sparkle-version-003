require('dotenv').config();
const pool = require('../config/database');

async function check() {
    try {
        console.log('Checking Users Table...');
        const [usersCols] = await pool.query('DESCRIBE users');
        console.table(usersCols);
        
        console.log('\nChecking Marketplace Table...');
        const [marketCols] = await pool.query('DESCRIBE marketplace_listings');
        console.table(marketCols);
        
        process.exit(0);
    } catch (err) {
        console.error('Check failed:', err.message);
        process.exit(1);
    }
}

check();
