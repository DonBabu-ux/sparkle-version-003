require('dotenv').config();
const pool = require('../config/database');

async function migrate() {
    try {
        console.log('🚀 Finalizing Sparkle Group Schema (v5)...');

        // Add cover_image to groups if missing
        await pool.query(`
            ALTER TABLE groups 
            ADD COLUMN IF NOT EXISTS cover_image TEXT AFTER icon_url;
        `);

        // Ensure group_members roles match requirement: admin, moderator, member
        // Also ensure status matches: active, pending, banned
        await pool.query(`
            ALTER TABLE group_members 
            MODIFY COLUMN role ENUM('admin', 'moderator', 'member') DEFAULT 'member',
            MODIFY COLUMN status ENUM('active', 'pending', 'banned') DEFAULT 'active';
        `);

        // Change join_requests to group_requests as per spec A/C (mapping existing to new if needed)
        // Check if join_requests exists, rename to group_requests
        const [tables] = await pool.query("SHOW TABLES LIKE 'join_requests'");
        if (tables.length > 0) {
            await pool.query("RENAME TABLE join_requests TO group_requests");
            console.log('✅ Renamed join_requests to group_requests');
        }

        // Ensure group_requests has status: pending, approved, rejected
        await pool.query(`
            CREATE TABLE IF NOT EXISTS group_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                group_id CHAR(36),
                user_id CHAR(36),
                status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (group_id) REFERENCES groups(group_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                UNIQUE KEY group_user_req (group_id, user_id)
            ) ENGINE=InnoDB;
        `);

        // Ensure status column in group_requests matches spec
        await pool.query(`
            ALTER TABLE group_requests 
            MODIFY COLUMN status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending';
        `);

        // Create post_comments table (Fix #E)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS group_post_comments (
                comment_id CHAR(36) PRIMARY KEY,
                post_id CHAR(36),
                user_id CHAR(36),
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (post_id) REFERENCES group_posts(post_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);

        console.log('✅ Sparkle Group Schema (v5) alignment complete!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        process.exit();
    }
}

migrate();
