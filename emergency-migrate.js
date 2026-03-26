require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
    });

    try {
        console.log('🚀 Starting emergency migration...');

        // 1. Add missing columns to users table
        const altUsers = [
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS `email_verified` TINYINT(1) DEFAULT 0',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS `phone_verified` TINYINT(1) DEFAULT 0',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS `account_status` ENUM("active", "suspended", "deactivated") DEFAULT "active"',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS `role` ENUM("user", "moderator", "admin") DEFAULT "user"',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS `email_notifications` TINYINT(1) DEFAULT 1',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS `push_notifications` TINYINT(1) DEFAULT 1',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS `theme` ENUM("light","dark","system") DEFAULT "system"',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS `font_size` ENUM("small","medium","large") DEFAULT "medium"',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS `language` VARCHAR(10) DEFAULT "en"'
        ];

        for (const sql of altUsers) {
            try {
                await pool.query(sql);
                console.log(`✅ Executed: ${sql.substring(0, 50)}...`);
            } catch (e) {
                console.warn(`⚠️  Failed (likely already exists): ${sql.substring(0, 50)}...`, e.message);
            }
        }

        // 2. Ensure email_verifications table exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS \`email_verifications\` (
                \`verification_id\` CHAR(36) NOT NULL,
                \`user_id\` CHAR(36) NOT NULL,
                \`email\` VARCHAR(255) NOT NULL,
                \`code\` VARCHAR(10) NOT NULL,
                \`expires_at\` TIMESTAMP NOT NULL,
                \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                \`verified_at\` TIMESTAMP NULL DEFAULT NULL,
                PRIMARY KEY (\`verification_id\`),
                UNIQUE KEY \`unique_email_code\` (\`email\`, \`code\`),
                INDEX \`idx_verification_user\` (\`user_id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('✅ email_verifications table ensured');

        console.log('✨ Migration complete!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        await pool.end();
        process.exit();
    }
}

migrate();
