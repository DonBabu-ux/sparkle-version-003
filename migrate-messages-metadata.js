// migrate-messages-metadata.js
// Idempotent migration: adds metadata TEXT column to messages table

require('dotenv').config();
const pool = require('./config/database');

async function migrate() {
  console.log('[migrate-messages-metadata] Checking messages table...');

  // Check if column already exists
  const [cols] = await pool.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'messages'
      AND COLUMN_NAME = 'metadata'
  `);

  if (cols.length > 0) {
    console.log('[migrate-messages-metadata] Column already exists. Skipping.');
    process.exit(0);
  }

  console.log('[migrate-messages-metadata] Adding metadata column...');
  await pool.query(`
    ALTER TABLE messages
    ADD COLUMN metadata TEXT DEFAULT NULL
      COMMENT 'JSON: generic attachment payload (story, post, event, profile, etc.)'
  `);

  console.log('[migrate-messages-metadata] Done.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('[migrate-messages-metadata] Error:', err);
  process.exit(1);
});
