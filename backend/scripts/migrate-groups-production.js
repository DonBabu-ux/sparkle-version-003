require('dotenv').config();
const pool = require('../config/database');

async function migrate() {
    try {
        console.log('🚀 Finalizing Sparkle Group Schema (v4)...');

        // Ensure groups table has all columns
        await pool.query(`
            CREATE TABLE IF NOT EXISTS groups (
                group_id CHAR(36) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                category VARCHAR(100) DEFAULT 'general',
                icon_url TEXT,
                cover_image TEXT,
                is_public BOOLEAN DEFAULT TRUE,
                requires_approval BOOLEAN DEFAULT FALSE,
                creator_id CHAR(36),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_creator (creator_id)
            ) ENGINE=InnoDB;
        `);

        // Ensure group_members table has role and status
        await pool.query(`
            CREATE TABLE IF NOT EXISTS group_members (
                id INT AUTO_INCREMENT PRIMARY KEY,
                group_id CHAR(36),
                user_id CHAR(36),
                role ENUM('member', 'admin', 'moderator') DEFAULT 'member',
                status ENUM('active', 'pending', 'blocked') DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (group_id) REFERENCES groups(group_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                UNIQUE KEY group_user (group_id, user_id),
                INDEX idx_membership (group_id, user_id, status)
            ) ENGINE=InnoDB;
        `);

        // Ensure group_posts table has required hierarchy
        await pool.query(`
            CREATE TABLE IF NOT EXISTS group_posts (
                post_id CHAR(36) PRIMARY KEY,
                group_id CHAR(36),
                user_id CHAR(36),
                content TEXT NOT NULL,
                image_url TEXT,
                video_url TEXT,
                is_pinned BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (group_id) REFERENCES groups(group_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                INDEX idx_group_feed (group_id, created_at DESC)
            ) ENGINE=InnoDB;
        `);

        // Create join_requests table as specified in Section 3
        await pool.query(`
            CREATE TABLE IF NOT EXISTS join_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                group_id CHAR(36),
                user_id CHAR(36),
                status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (group_id) REFERENCES groups(group_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                UNIQUE KEY req_user (group_id, user_id)
            ) ENGINE=InnoDB;
        `);

        console.log('✅ Sparkle Group Schema finalization complete!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        process.exit();
    }
}

migrate();
