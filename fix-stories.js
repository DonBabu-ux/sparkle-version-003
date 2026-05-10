require('dotenv').config();
const pool = require('./config/database');

async function fix() {
    try {
        const [res] = await pool.query("DELETE FROM stories WHERE media_url LIKE '%[object %'");
        console.log('Deleted broken stories:', res.affectedRows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
fix();
