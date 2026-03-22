require('dotenv').config();
const pool = require('./config/database');
async function check() {
    try {
        const [tables] = await pool.query('SHOW TABLES');
        const tableNames = tables.map(t => Object.values(t)[0]);
        console.log('Tables:', tableNames);
        
        const schema = {};
        for (const table of ['marketplace_reviews', 'marketplace_listings']) {
            if (tableNames.includes(table)) {
                const [rows] = await pool.query(`DESCRIBE ${table}`);
                schema[table] = rows.map(r => r.Field);
            }
        }
        console.log('Schema:', JSON.stringify(schema, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
check();
