require('dotenv').config();
const pool = require('../config/database');

async function check() {
    try {
        const [res] = await pool.query(`
            SELECT table_name, table_collation 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE() 
            AND table_name LIKE 'marketplace_%'
        `);
        console.log('Table Collations:', res);

        const [cols] = await pool.query(`
            SELECT table_name, column_name, collation_name
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
            AND table_name LIKE 'marketplace_%'
            AND (column_name LIKE '%_id' OR column_name = 'id')
        `);
        console.table(cols);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

check();
