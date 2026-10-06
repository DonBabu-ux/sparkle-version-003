require('dotenv').config();
const pool = require('./config/database');

async function checkCols() {
    try {
        const [nCols] = await pool.query('DESCRIBE notifications');
        console.log('notifications columns:', nCols.map(c => c.Field).join(', '));
        const [pCols] = await pool.query('DESCRIBE push_notifications');
        console.log('push_notifications columns:', pCols.map(c => c.Field).join(', '));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
checkCols();
