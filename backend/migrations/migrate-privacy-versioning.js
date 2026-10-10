// migrations/migrate-privacy-versioning.js
require('dotenv').config();
const pool = require('../config/database');

async function migratePrivacyVersioning() {
  console.log('🚀 Starting privacy versioning database migration...');
  try {
    // 1. Ensure chat_privacy_settings table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_privacy_settings (
        id VARCHAR(36) PRIMARY KEY,
        chat_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        allow_forward TINYINT(1) DEFAULT 1,
        allow_copy TINYINT(1) DEFAULT 1,
        block_screenshot TINYINT(1) DEFAULT 0,
        blur_screen_recording TINYINT(1) DEFAULT 0,
        notify_screenshot_attempts TINYINT(1) DEFAULT 1,
        privacy_version INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_chat (chat_id, user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Check if privacy_version column exists
    const [cols] = await pool.query(`SHOW COLUMNS FROM chat_privacy_settings LIKE 'privacy_version'`);
    if (!cols || cols.length === 0) {
      console.log('➕ Adding privacy_version column to chat_privacy_settings...');
      await pool.query(`ALTER TABLE chat_privacy_settings ADD COLUMN privacy_version INT DEFAULT 1`);
    } else {
      console.log('✔ privacy_version column already exists.');
    }

    // 3. Ensure capture_attempts table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS capture_attempts (
        id VARCHAR(36) PRIMARY KEY,
        chat_id VARCHAR(36) NOT NULL,
        owner_user_id VARCHAR(36) NOT NULL,
        actor_user_id VARCHAR(36) NOT NULL,
        attempt_type VARCHAR(50) DEFAULT 'SCREENSHOT_ATTEMPT',
        detection_method VARCHAR(50) DEFAULT 'UNKNOWN',
        device_info TEXT,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Ensure capture_notifications table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS capture_notifications (
        id VARCHAR(36) PRIMARY KEY,
        recipient_user_id VARCHAR(36) NOT NULL,
        capture_attempt_id VARCHAR(36) NOT NULL,
        is_read TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Ensure capture_audit_log table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS capture_audit_log (
        id VARCHAR(36) PRIMARY KEY,
        capture_attempt_id VARCHAR(36),
        actor_user_id VARCHAR(36) NOT NULL,
        owner_user_id VARCHAR(36),
        chat_id VARCHAR(36) NOT NULL,
        action VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ Privacy versioning database migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migratePrivacyVersioning();
