require('dotenv').config();
const db = require('./config/database');

async function migrate() {
    try {
        console.log("Starting messages migration...");
        
        // Ensure ENUM includes 'audio', 'document', 'voice_note', 'text', 'image', 'video', 'system', 'marketplace_listing'
        // ENUM('text', 'image', 'video', 'voice_note', 'post_share', 'system', 'call', 'marketplace_listing', 'story_reply')
        await db.query(`
            ALTER TABLE messages 
            MODIFY COLUMN type ENUM('text', 'image', 'video', 'voice_note', 'post_share', 'system', 'call', 'marketplace_listing', 'story_reply', 'audio', 'document') DEFAULT 'text'
        `);
        console.log("Updated type ENUM");

        // Add view_policy columns
        try {
            await db.query(`ALTER TABLE messages ADD COLUMN view_policy ENUM('once', 'twice', 'unlimited') DEFAULT 'unlimited'`);
            console.log("Added view_policy");
        } catch (e) {
            console.log("view_policy likely exists", e.message);
        }

        try {
            await db.query(`ALTER TABLE messages ADD COLUMN views_used INT DEFAULT 0`);
            console.log("Added views_used");
        } catch (e) {
            console.log("views_used likely exists", e.message);
        }

        try {
            await db.query(`ALTER TABLE messages ADD COLUMN views_allowed INT DEFAULT 1`);
            console.log("Added views_allowed");
        } catch (e) {
            console.log("views_allowed likely exists", e.message);
        }

        // --- DELIVERY & READ ---
        try {
            await db.query(`ALTER TABLE messages ADD COLUMN delivered TINYINT(1) DEFAULT 0`);
            console.log("Added delivered");
        } catch (e) {
            console.log("delivered likely exists", e.message);
        }

        try {
            await db.query(`ALTER TABLE messages ADD COLUMN delivered_at TIMESTAMP NULL`);
            console.log("Added delivered_at");
        } catch (e) {
            console.log("delivered_at likely exists", e.message);
        }
        
        console.log("Migration complete!");
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}

migrate();
