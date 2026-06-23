require('dotenv').config();
const pool = require('../config/database');

async function run() {
    try {
        const [rows] = await pool.query('SHOW CREATE TABLE notifications');
        console.log(rows[0]['Create Table']);
    } catch (e) {
        console.error(e);
    }
    process.exit();
}
run();
