require('dotenv').config();
const pool = require('../config/database');
const logger = require('../utils/logger');

async function setupAuthDatabase() {
    try {
        logger.info('Starting Authentication Database Setup...');

        // 1. Add email_verified and phone_verified to users table if they don't exist
        logger.info('Checking users table for verification columns...');
        const [columns] = await pool.query('SHOW COLUMNS FROM users');
        const columnNames = columns.map(c => c.Field);

        if (!columnNames.includes('email_verified')) {
            logger.info('Adding email_verified column to users table...');
            await pool.query('ALTER TABLE users ADD COLUMN email_verified TINYINT(1) DEFAULT 0');
        }

        if (!columnNames.includes('phone_verified')) {
            logger.info('Adding phone_verified column to users table...');
            await pool.query('ALTER TABLE users ADD COLUMN phone_verified TINYINT(1) DEFAULT 0');
        }

        if (!columnNames.includes('phone_number')) {
            logger.info('Adding phone_number column to users table...');
            await pool.query('ALTER TABLE users ADD COLUMN phone_number VARCHAR(20) DEFAULT NULL');
        }

        // 2. Create email_verifications table
        logger.info('Checking email_verifications table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS email_verifications (
                verification_id CHAR(36) PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                email VARCHAR(255) NOT NULL,
                code VARCHAR(10) NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                verified_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                UNIQUE KEY unique_user_email (user_id, email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 3. Create password_resets table (replacing/supplementing password_reset_tokens)
        logger.info('Checking password_resets table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS password_resets (
                reset_id CHAR(36) PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                email VARCHAR(255) NOT NULL,
                token VARCHAR(255) NOT NULL UNIQUE,
                expires_at TIMESTAMP NOT NULL,
                used_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                UNIQUE KEY unique_user_reset (user_id, email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        logger.info('✅ Authentication Database Setup completed successfully.');
    } catch (error) {
        logger.error('❌ Authentication Database Setup failed:', error);
        console.error(error);
    } finally {
        process.exit();
    }
}

setupAuthDatabase();
