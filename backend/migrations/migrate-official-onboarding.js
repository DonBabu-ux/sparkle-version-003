require('dotenv').config();
const pool = require('../config/database');

async function migrateOfficialOnboarding() {
  console.log('🚀 Starting Official Onboarding Schema Migration...');
  const connection = await pool.getConnection();
  try {
    // 1. Add official_onboarding_status and official_onboarding_completed_at to users
    const [userCols] = await connection.query("SHOW COLUMNS FROM users LIKE 'official_onboarding_status'");
    if (userCols.length === 0) {
      console.log('Adding official_onboarding_status & completed_at to users table...');
      await connection.query(`
        ALTER TABLE users
        ADD COLUMN official_onboarding_status ENUM('NOT_STARTED', 'VIEWED', 'COMPLETED') DEFAULT 'NOT_STARTED',
        ADD COLUMN official_onboarding_completed_at TIMESTAMP NULL
      `);
    } else {
      console.log('Column official_onboarding_status already exists on users table.');
    }

    // 2. Add message_type, is_hidden, hidden_reason, archive_after_completion to messages
    const [msgCols] = await connection.query("SHOW COLUMNS FROM messages LIKE 'hidden_reason'");
    if (msgCols.length === 0) {
      console.log('Adding onboarding metadata columns to messages table...');
      await connection.query(`
        ALTER TABLE messages
        ADD COLUMN is_hidden TINYINT(1) DEFAULT 0,
        ADD COLUMN hidden_reason VARCHAR(64) NULL,
        ADD COLUMN message_type VARCHAR(32) DEFAULT 'standard',
        ADD COLUMN archive_after_completion TINYINT(1) DEFAULT 0
      `);
    } else {
      console.log('Onboarding metadata columns already exist on messages table.');
    }

    console.log('✅ Official Onboarding Schema Migration Completed Successfully!');
  } catch (error) {
    console.error('❌ Migration Error:', error);
  } finally {
    connection.release();
    process.exit(0);
  }
}

migrateOfficialOnboarding();
