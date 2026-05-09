require('dotenv').config();
const pool = require('../config/database');

async function migrate() {
    try {
        console.log("Starting Anonymous Comments Migration...");

        // Add author_alias to confession_comments
        await pool.query(`
            ALTER TABLE confession_comments 
            ADD COLUMN IF NOT EXISTS author_alias VARCHAR(50) DEFAULT NULL
        `);

        console.log("Migration completed successfully!");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        process.exit();
    }
}

migrate();
