require('dotenv').config();
const pool = require('./config/database');
async function test() {
    try {
        console.log('Attempting to connect to:', process.env.DB_HOST);
        const [rows] = await pool.query('SELECT 1 + 1 AS result');
        console.log('Connection successful! Result:', rows[0].result);
        process.exit(0);
    } catch (err) {
        console.error('Connection failed!');
        console.error('Error Code:', err.code);
        console.error('Error Message:', err.message);
        process.exit(1);
    }
}
test();
