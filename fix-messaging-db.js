require('dotenv').config();
const db = require('./config/database');

async function migrate() {
    try {
        console.log("Starting Messaging stability/UX migration...");

        // Update personal_chats
        const pcCols = [
            "ADD COLUMN IF NOT EXISTS is_muted_p1 TINYINT(1) DEFAULT 0",
            "ADD COLUMN IF NOT EXISTS is_muted_p2 TINYINT(1) DEFAULT 0",
            "ADD COLUMN IF NOT EXISTS is_pinned_p1 TINYINT(1) DEFAULT 0",
            "ADD COLUMN IF NOT EXISTS is_pinned_p2 TINYINT(1) DEFAULT 0",
            "ADD COLUMN IF NOT EXISTS is_archived_p1 TINYINT(1) DEFAULT 0",
            "ADD COLUMN IF NOT EXISTS is_archived_p2 TINYINT(1) DEFAULT 0",
            "ADD COLUMN IF NOT EXISTS p1_locked TINYINT(1) DEFAULT 0",
            "ADD COLUMN IF NOT EXISTS p2_locked TINYINT(1) DEFAULT 0",
            "ADD COLUMN IF NOT EXISTS p1_pin VARCHAR(20) DEFAULT NULL",
            "ADD COLUMN IF NOT EXISTS p2_pin VARCHAR(20) DEFAULT NULL",
            "ADD COLUMN IF NOT EXISTS disappearing_duration INT DEFAULT 0"
        ];

        for (const col of pcCols) {
            try {
                await db.query(`ALTER TABLE personal_chats ${col}`);
            } catch (e) {
                console.log(`Column might exist: ${col.split(' ')[4]}`);
            }
        }
        console.log("Updated personal_chats");

        // Update group_chats
        const gcCols = [
            "ADD COLUMN IF NOT EXISTS disappearing_duration INT DEFAULT 0",
            "ADD COLUMN IF NOT EXISTS pin_locked TINYINT(1) DEFAULT 0",
            "ADD COLUMN IF NOT EXISTS group_pin VARCHAR(20) DEFAULT NULL"
        ];

        for (const col of gcCols) {
            try {
                await db.query(`ALTER TABLE group_chats ${col}`);
            } catch (e) {
                console.log(`Column might exist: ${col.split(' ')[4]}`);
            }
        }
        console.log("Updated group_chats");

        // Update users
        const uCols = [
            "ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT NULL",
            "ADD COLUMN IF NOT EXISTS is_online TINYINT(1) DEFAULT 0",
            "ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        ];

        for (const col of uCols) {
            try {
                await db.query(`ALTER TABLE users ${col}`);
            } catch (e) {
                console.log(`Column might exist: ${col.split(' ')[4]}`);
            }
        }
        console.log("Updated users");

        console.log("Migration complete!");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

migrate();
function ADD_COLUMN_IF_NOT_EXISTS(table, col, def) {
    // Helper to avoid duplicate columns if the DB doesn't support 'IF NOT EXISTS' for columns 
    // (MariaDB 10.2+ supports it, MySQL doesn't natively for columns in ALTER)
}
