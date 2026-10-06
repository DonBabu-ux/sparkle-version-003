require('dotenv').config();
const pool = require('../config/database');

async function migrateEnhanceMessageDeletions() {
  console.log('🚀 Starting message deletions enhancement database migration...');
  try {
    // 1. Create message_deletions table with unique constraint if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS message_deletions (
        deletion_id VARCHAR(36) PRIMARY KEY,
        message_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        operation_id VARCHAR(36) DEFAULT NULL,
        deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_message (message_id, user_id),
        INDEX idx_user_id (user_id),
        INDEX idx_message_id (message_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Add operation_id column to message_deletions if missing
    try {
      await pool.query(`
        ALTER TABLE message_deletions ADD COLUMN operation_id VARCHAR(36) DEFAULT NULL;
      `);
    } catch (err) {
      // Column might already exist
      console.warn('20260823: column add skipped:', err.message);
    }

    // 3. Add delete_operation_id to messages table if missing
    try {
      await pool.query(`
        ALTER TABLE messages ADD COLUMN delete_operation_id VARCHAR(36) DEFAULT NULL;
      `);
    } catch (err) {
      // Column might already exist
      console.warn('20260823: column add skipped:', err.message);
    }

    console.log('✅ Message deletions table & schema verified successfully.');
  } catch (error) {
    console.error('❌ Message deletions migration error:', error.message);
  }
}

if (require.main === module) {
  migrateEnhanceMessageDeletions().then(() => process.exit(0));
}

module.exports = migrateEnhanceMessageDeletions;
