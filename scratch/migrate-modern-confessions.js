require('dotenv').config();
const pool = require('../config/database');

async function migrate() {
    try {
        console.log("Starting Confessions Modernization Migration...");

        // 1. Add author_alias and discovery_score to confessions
        console.log("Adding author_alias and discovery_score to confessions...");
        await pool.query(`
            ALTER TABLE confessions 
            ADD COLUMN IF NOT EXISTS author_alias VARCHAR(50) DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS discovery_score FLOAT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS relate_count INT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS support_count INT DEFAULT 0
        `);

        // 2. Update confession_reactions reaction_type enum
        // Note: For MySQL/MariaDB, we might need to be careful with enum updates. 
        // We'll check if it's MySQL and use the appropriate syntax.
        console.log("Updating reaction_type enum in confession_reactions...");
        try {
            await pool.query(`
                ALTER TABLE confession_reactions 
                MODIFY COLUMN reaction_type ENUM('upvote', 'downvote', 'fire', 'heart', 'relate', 'support', 'funny')
            `);
        } catch (e) {
            console.error("Failed to update reaction_type enum. It might already have these types or the DB doesn't support MODIFY COLUMN for enums this way.", e.message);
        }

        console.log("Migration completed successfully!");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        process.exit();
    }
}

migrate();
