require('dotenv').config();
const pool = require('../config/database');

async function check() {
    try {
        const [sample] = await pool.query('SELECT username, username_normalized FROM users LIMIT 1');
        console.log('Sample user:', sample[0]);

        const [explain] = await pool.query(
            'EXPLAIN SELECT 1 FROM users WHERE username_normalized = ? LIMIT 1',
            [sample[0].username_normalized]
        );
        console.log('--- EXPLAIN SELECT 1 FROM users WHERE username_normalized = ? LIMIT 1 ---');
        console.table(explain);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}
check();
