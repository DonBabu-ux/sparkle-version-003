require('dotenv').config();
const pool = require('./config/database');
async function checkSchema() {
    try {
        const [pcRows] = await pool.query('DESCRIBE personal_chats');
        console.log('--- personal_chats columns ---');
        pcRows.forEach(c => console.log(c.Field));
        
        const [mRows] = await pool.query('DESCRIBE messages');
        console.log('\n--- messages columns ---');
        mRows.forEach(c => console.log(c.Field));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}
checkSchema();
