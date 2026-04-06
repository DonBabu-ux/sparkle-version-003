require('dotenv').config();
const pool = require('./config/database');
async function check() {
    try {
        const [gc] = await pool.query('DESCRIBE group_chats');
        const [m] = await pool.query('DESCRIBE messages');
        const [pc] = await pool.query('DESCRIBE personal_chats');
        console.log('--- group_chats ---');
        console.log(gc.map(c => c.Field).join(', '));
        console.log('--- messages ---');
        console.log(m.map(c => c.Field).join(', '));
        console.log('--- personal_chats ---');
        console.log(pc.map(c => c.Field).join(', '));
    } catch (e) { console.error(e); }
    process.exit();
}
check();
