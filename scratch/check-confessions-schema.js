require('dotenv').config();
const pool = require('../config/database');

async function check() {
    try {
        console.log("\nChecking 'confessions' schema...");
        const [cols] = await pool.query("DESCRIBE confessions");
        console.log("Columns in 'confessions':", JSON.stringify(cols.map(c => ({field: c.Field, type: c.Type})), null, 2));
        
        console.log("\nChecking 'confession_reactions' schema...");
        const [rcols] = await pool.query("DESCRIBE confession_reactions");
        console.log("Columns in 'confession_reactions':", JSON.stringify(rcols.map(c => ({field: c.Field, type: c.Type})), null, 2));

        console.log("\nChecking 'confession_comments' schema...");
        const [ccols] = await pool.query("DESCRIBE confession_comments");
        console.log("Columns in 'confession_comments':", JSON.stringify(ccols.map(c => ({field: c.Field, type: c.Type})), null, 2));

    } catch (err) {
        console.error("Check failed:", err);
    } finally {
        process.exit();
    }
}

check();
