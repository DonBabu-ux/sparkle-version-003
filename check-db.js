require('dotenv').config();
const fs = require('fs');
const pool = require('./config/database');

async function checkSchema() {
    try {
        const [cols] = await pool.query('DESCRIBE follows');
        fs.writeFileSync('follows-schema.json', JSON.stringify(cols, null, 2));
        console.log('Follows schema saved');
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkSchema();
