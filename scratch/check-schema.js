require('dotenv').config();
const pool = require('../config/database');

async function checkSchema() {
    try {
        const [messages] = await pool.query('DESCRIBE marketplace_messages');
        console.log('--- marketplace_messages ---');
        console.table(messages);

        const [conversations] = await pool.query('DESCRIBE marketplace_conversations');
        console.log('--- marketplace_conversations ---');
        console.table(conversations);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkSchema();
