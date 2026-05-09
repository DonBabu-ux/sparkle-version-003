require('dotenv').config();
const pool = require('../config/database');
async function check() {
    const [cols] = await pool.query('DESCRIBE comments');
    console.log(cols.slice(0, 3));
    process.exit(0);
}
check();
