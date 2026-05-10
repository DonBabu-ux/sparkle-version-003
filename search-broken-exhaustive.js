require('dotenv').config();
const pool = require('./config/database');

async function search() {
    try {
        const [tables] = await pool.query('SHOW TABLES');
        for (const tableRow of tables) {
            const table = Object.values(tableRow)[0];
            const [cols] = await pool.query(`SHOW COLUMNS FROM ${table}`);
            for (const col of cols) {
                if (col.Type.includes('char') || col.Type.includes('text')) {
                    const [rows] = await pool.query(`SELECT count(*) as count FROM ${table} WHERE ${col.Field} LIKE "%[object %"`);
                    if (rows[0].count > 0) {
                        console.log(`Found ${rows[0].count} broken entries in ${table}.${col.Field}`);
                        const [samples] = await pool.query(`SELECT ${col.Field} FROM ${table} WHERE ${col.Field} LIKE "%[object %" LIMIT 1`);
                        console.log(`Sample:`, samples[0][col.Field]);
                    }
                }
            }
        }
        console.log('Search complete.');
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
search();
