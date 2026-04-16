require('dotenv').config();
const pool = require('./config/database');

async function check() {
    try {
        console.log("Checking tables...");
        const [tables] = await pool.query("SHOW TABLES");
        console.log("Tables:", tables.map(t => Object.values(t)[0]));

        console.log("\nChecking 'moments' schema...");
        const [cols] = await pool.query("DESCRIBE moments");
        console.log("Columns in 'moments':", cols.map(c => c.Field));
        
        console.log("\nChecking 'moment_likes' schema...");
        try {
            const [lcols] = await pool.query("DESCRIBE moment_likes");
            console.log("Columns in 'moment_likes':", lcols.map(c => c.Field));
        } catch(e) { console.log("moment_likes table missing or error:", e.message); }

    } catch (err) {
        console.error("Check failed:", err);
    } finally {
        process.exit();
    }
}

check();
