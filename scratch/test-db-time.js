require('dotenv').config();
const { query } = require('../utils/database/query');

async function testTime() {
    try {
        const rows = await query('SELECT NOW() as db_now, UTC_TIMESTAMP() as db_utc');
        console.log('Database time:', rows[0]);
        console.log('Node JS time:', new Date().toISOString());
        console.log('Node JS Local time:', new Date().toString());
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
testTime();
