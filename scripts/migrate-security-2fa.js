require('dotenv').config();
const pool = require('../config/database');
const logger = require('../utils/logger');

async function migrateSecurity2FA() {
    try {
        console.log('🔒 Starting Security & 2FA Database Migration...');

        // 1. Check existing columns in users
        const [columns] = await pool.query('SHOW COLUMNS FROM users');
        const colMap = new Set(columns.map(c => c.Field));

        const addColumnIfNotExists = async (colName, colDef) => {
            if (!colMap.has(colName)) {
                console.log(`Adding column ${colName} to users table...`);
                await pool.query(`ALTER TABLE users ADD COLUMN ${colDef}`);
                console.log(`✓ Added column ${colName}`);
            } else {
                console.log(`✓ Column ${colName} already exists`);
            }
        };

        await addColumnIfNotExists('email_2fa_enabled', 'email_2fa_enabled TINYINT(1) DEFAULT 0');
        await addColumnIfNotExists('sms_2fa_enabled', 'sms_2fa_enabled TINYINT(1) DEFAULT 0');
        await addColumnIfNotExists('email_2fa_verified_at', 'email_2fa_verified_at TIMESTAMP NULL DEFAULT NULL');
        await addColumnIfNotExists('sms_2fa_verified_at', 'sms_2fa_verified_at TIMESTAMP NULL DEFAULT NULL');
        await addColumnIfNotExists('two_factor_backup_codes', 'two_factor_backup_codes JSON DEFAULT NULL');
        await addColumnIfNotExists('two_factor_secret', 'two_factor_secret VARCHAR(255) DEFAULT NULL');
        await addColumnIfNotExists('security_recovery_email', 'security_recovery_email VARCHAR(255) DEFAULT NULL');
        await addColumnIfNotExists('password_changed_at', 'password_changed_at TIMESTAMP NULL DEFAULT NULL');

        // 2. Create security_events table for audit logs
        console.log('Creating security_events table if not exists...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS security_events (
                event_id CHAR(36) PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                event_type VARCHAR(50) NOT NULL,
                details JSON DEFAULT NULL,
                ip_address VARCHAR(45) DEFAULT NULL,
                user_agent TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_security_events_user (user_id, created_at),
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✓ security_events table ready');

        // Check columns on security_events
        const [secEventCols] = await pool.query('SHOW COLUMNS FROM security_events');
        const secEventColMap = new Set(secEventCols.map(c => c.Field));
        if (!secEventColMap.has('session_id')) {
            console.log('Adding session_id to security_events...');
            await pool.query('ALTER TABLE security_events ADD COLUMN session_id VARCHAR(255) DEFAULT NULL');
        }
        if (!secEventColMap.has('is_interruptive')) {
            console.log('Adding is_interruptive to security_events...');
            await pool.query('ALTER TABLE security_events ADD COLUMN is_interruptive TINYINT(1) DEFAULT 0');
        }
        if (!secEventColMap.has('acknowledged_at')) {
            console.log('Adding acknowledged_at to security_events...');
            await pool.query('ALTER TABLE security_events ADD COLUMN acknowledged_at TIMESTAMP NULL DEFAULT NULL');
        }

        // 3. Create otp_verifications table for Email and SMS OTPs
        console.log('Creating otp_verifications table if not exists...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS otp_verifications (
                verification_id CHAR(36) PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                channel ENUM('email', 'sms') NOT NULL,
                destination VARCHAR(255) NOT NULL,
                code_hash VARCHAR(255) NOT NULL,
                attempts TINYINT DEFAULT 0,
                expires_at TIMESTAMP NOT NULL,
                verified_at TIMESTAMP NULL DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_otp_user_channel (user_id, channel, expires_at),
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✓ otp_verifications table ready');

        // 4. Create security_transactions table
        console.log('Creating security_transactions table if not exists...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS security_transactions (
                transaction_id CHAR(36) PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                purpose ENUM(
                    '2fa_email_enroll',
                    '2fa_sms_enroll',
                    '2fa_email_alternate',
                    '2fa_disable',
                    'password_change',
                    'password_reset',
                    'pin_reset',
                    'recovery_regen',
                    'security_email_change'
                ) NOT NULL,
                destination VARCHAR(255) DEFAULT NULL,
                otp_hash VARCHAR(255) DEFAULT NULL,
                verification_token VARCHAR(255) DEFAULT NULL,
                token_expires_at TIMESTAMP NULL DEFAULT NULL,
                expires_at TIMESTAMP NOT NULL,
                attempt_count TINYINT DEFAULT 0,
                max_attempts TINYINT DEFAULT 5,
                status ENUM('pending', 'verified', 'consumed', 'expired', 'cancelled') DEFAULT 'pending',
                actor_session_id VARCHAR(255) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                verified_at TIMESTAMP NULL DEFAULT NULL,
                consumed_at TIMESTAMP NULL DEFAULT NULL,
                INDEX idx_sec_tx_user (user_id, purpose, status),
                INDEX idx_sec_tx_token (verification_token),
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✓ security_transactions table ready');

        console.log('🎉 Security & 2FA Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrateSecurity2FA();
