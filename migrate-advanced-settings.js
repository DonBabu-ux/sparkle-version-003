require('dotenv').config();
const pool = require('./config/database');

async function migrate() {
    try {
        console.log('🚀 Starting Advanced Settings DB Migration...');

        // 1. Add missing settings columns to users table if they don't exist
        const columnsToAdd = [
            { name: 'sensitive_content_level', type: "ENUM('standard', 'strict') DEFAULT 'standard'" },
            { name: 'ai_content_opt_out', type: "TINYINT(1) DEFAULT 0" },
            { name: 'recommendation_personalization', type: "TINYINT(1) DEFAULT 1" },
            { name: 'search_indexing_enabled', type: "TINYINT(1) DEFAULT 1" },
            { name: 'profile_discoverability', type: "ENUM('everyone', 'friends', 'private') DEFAULT 'everyone'" },
            { name: 'reduced_motion', type: "TINYINT(1) DEFAULT 0" },
            { name: 'font_scale', type: "VARCHAR(20) DEFAULT 'medium'" },
            { name: 'auto_download_media', type: "VARCHAR(20) DEFAULT 'wifi'" },
            { name: 'link_previews_enabled', type: "TINYINT(1) DEFAULT 1" },
            { name: 'haptic_intensity', type: "VARCHAR(20) DEFAULT 'medium'" },
            { name: 'media_quality', type: "VARCHAR(20) DEFAULT 'standard'" },
        ];

        for (const col of columnsToAdd) {
            try {
                await pool.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
                console.log(`  + Added column users.${col.name}`);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060) {
                    console.log(`  . Column users.${col.name} already exists`);
                } else {
                    console.warn(`  ! Note on column ${col.name}:`, err.message);
                }
            }
        }

        // 2. Security Logs table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_security_logs (
                log_id CHAR(36) PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                event_type VARCHAR(64) NOT NULL,
                ip_address VARCHAR(45) DEFAULT NULL,
                user_agent VARCHAR(512) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('  + Table user_security_logs ensured');

        // 3. Automation Rules table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_automation_rules (
                rule_id CHAR(36) PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                trigger_name VARCHAR(64) NOT NULL,
                action_name VARCHAR(64) NOT NULL,
                is_enabled TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('  + Table user_automation_rules ensured');

        console.log('✅ Advanced Settings Migration Completed Successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration Failed:', error);
        process.exit(1);
    }
}

migrate();
