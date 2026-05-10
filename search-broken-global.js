require('dotenv').config();
const pool = require('./config/database');

async function search() {
    try {
        const tables = ['stories', 'posts', 'moments', 'users', 'marketplace_listings', 'group_posts'];
        for (const table of tables) {
            const [cols] = await pool.query(`SHOW COLUMNS FROM ${table}`);
            for (const col of cols) {
                if (col.Type.includes('char') || col.Type.includes('text')) {
                    const [rows] = await pool.query(`SELECT count(*) as count FROM ${table} WHERE ${col.Field} LIKE "%[object %"`);
                    if (rows[0].count > 0) {
                        console.log(`Found ${rows[0].count} broken entries in ${table}.${col.Field}`);
                    }
                }
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
search();
