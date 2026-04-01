const pool = require('./config/database');
require('dotenv').config();

async function inspect() {
    try {
        const [confessions] = await pool.query('DESCRIBE confessions');
        console.log('--- confessions table ---');
        console.table(confessions);

        const [reactions] = await pool.query('DESCRIBE confession_reactions');
        console.log('--- confession_reactions table ---');
        console.table(reactions);

        await pool.end();
    } catch (err) {
        console.error('Inspection failed:', err);
    }
}

inspect();
