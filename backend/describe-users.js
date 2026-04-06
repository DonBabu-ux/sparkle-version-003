require('dotenv').config();
const pool = require('./config/database');

async function describeUsers() {
    try {
        const [cols] = await pool.query('DESCRIBE users');
        console.table(cols);
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit();
    }
}

describeUsers();
