// migrations/add_privacy_and_disappearing_columns.js
'use strict';

require('dotenv').config();
const pool = require('../config/database');

async function runMigration() {
  console.log('🚀 Starting Privacy & Disappearing Messages Database Migration...');

  try {
    // 1. Create chat_privacy_settings table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_privacy_settings (
        id CHAR(36) PRIMARY KEY,
        chat_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        allow_forward TINYINT(1) DEFAULT 1,
        allow_copy TINYINT(1) DEFAULT 1,
        block_screenshot TINYINT(1) DEFAULT 0,
        blur_screen_recording TINYINT(1) DEFAULT 1,
        notify_screenshot_attempts TINYINT(1) DEFAULT 1,
        read_receipts_enabled TINYINT(1) DEFAULT 1,
        typing_indicator_enabled TINYINT(1) DEFAULT 1,
        privacy_version INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_chat_user (chat_id, user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Helper to safely add column if not exists
    const addColumn = async (table, columnDef) => {
      try {
        await pool.query(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
        console.log(`  └─ Added column ${columnDef.split(' ')[0]} to ${table}`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME' || err.message?.includes('Duplicate column')) {
          // Column already exists, safe to ignore
        } else {
          console.warn(`  └─ Column check on ${table} (${columnDef.split(' ')[0]}):`, err.message);
        }
      }
    };

    // Add read_receipts_enabled & typing_indicator_enabled to chat_privacy_settings
    await addColumn('chat_privacy_settings', 'read_receipts_enabled TINYINT(1) DEFAULT 1');
    await addColumn('chat_privacy_settings', 'typing_indicator_enabled TINYINT(1) DEFAULT 1');
    await addColumn('chat_privacy_settings', 'privacy_version INT DEFAULT 1');

    // Add disappearing_duration to personal_chats and group_chats
    await addColumn('personal_chats', 'disappearing_duration INT DEFAULT 0');
    await addColumn('group_chats', 'disappearing_duration INT DEFAULT 0');

    // Add expires_at & client_message_id to messages
    await addColumn('messages', 'expires_at DATETIME DEFAULT NULL');
    await addColumn('messages', 'client_message_id VARCHAR(100) DEFAULT NULL');

    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
