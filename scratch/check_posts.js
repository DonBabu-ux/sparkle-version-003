require('dotenv').config();
const pool = require('../config/database');

async function check() {
    try {
        const [cols] = await pool.query("DESCRIBE posts");
        console.log("Columns in posts:", cols.map(c => `${c.Field} (${c.Type})`));
    } catch (e) {
        console.error("Error:", e);
    } finally {
        process.exit(0);
    }
}

check();
