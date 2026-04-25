const pool = require('../config/database');
const logger = require('../utils/logger');

const migrate = async () => {
    try {
        logger.info('Starting production migrations...');

        // 1. Refresh Tokens Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS \`refresh_tokens\` (
                \`token_id\` CHAR(36) PRIMARY KEY,
                \`user_id\` CHAR(36) NOT NULL,
                \`token\` VARCHAR(512) NOT NULL UNIQUE,
                \`device_id\` VARCHAR(255),
                \`expires_at\` TIMESTAMP NOT NULL,
                \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`user_id\`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        logger.info('Table created: refresh_tokens');

        // 2. Login Activity Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS \`login_activity\` (
                \`activity_id\` CHAR(36) PRIMARY KEY,
                \`user_id\` CHAR(36) NOT NULL,
                \`device_id\` VARCHAR(255),
                \`ip_address\` VARCHAR(45),
                \`user_agent\` TEXT,
                \`location\` VARCHAR(255),
                \`is_verified\` TINYINT(1) DEFAULT 0,
                \`last_active\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY \`unique_user_device\` (\`user_id\`, \`device_id\`),
                FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`user_id\`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        logger.info('Table created: login_activity');

        // 3. Ensure user_sessions has device_id if needed
        // (Existing table might already exist from previous steps)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS \`user_sessions\` (
                \`session_id\` CHAR(36) PRIMARY KEY,
                \`user_id\` CHAR(36) NOT NULL,
                \`device_id\` VARCHAR(255),
                \`device_name\` VARCHAR(255),
                \`ip_address\` VARCHAR(45),
                \`last_active\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`user_id\`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        logger.info('Table verified: user_sessions');

        logger.info('Migrations completed successfully.');
        process.exit(0);
    } catch (error) {
        logger.error('Migration failed:', error);
        process.exit(1);
    }
};

migrate();
