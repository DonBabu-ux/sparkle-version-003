const pool = require('../config/database');
async function check() {
    try {
        const [cols] = await pool.query('SHOW COLUMNS FROM follows');
        console.log('FOLLOWS:', cols.map(c => c.Field));
        const [cols2] = await pool.query('SHOW COLUMNS FROM follow_requests');
        console.log('FOLLOW_REQUESTS:', cols2.map(c => c.Field));
    } catch (e) { console.error(e); }
    process.exit();
}
check();
