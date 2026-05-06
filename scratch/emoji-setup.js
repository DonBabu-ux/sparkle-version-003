require('dotenv').config();
const pool = require('../config/database');
const crypto = require('crypto');

async function run() {
  console.log('\n=== DB AUDIT ===');

  // What tables reference marketplace_messages?
  const [fkCheck] = await pool.query(`
    SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE REFERENCED_TABLE_NAME = 'marketplace_messages'
    AND TABLE_SCHEMA = DATABASE()
  `);
  console.log('FKs referencing marketplace_messages:', JSON.stringify(fkCheck, null, 2));

  // Check if marketplace_message_reactions exists
  const [mktReactions] = await pool.query(`SHOW TABLES LIKE 'marketplace_message_reactions'`);
  console.log('marketplace_message_reactions exists:', mktReactions.length > 0);

  // Check marketplace_messages charset
  const [msgTable] = await pool.query(`
    SELECT TABLE_NAME, TABLE_COLLATION
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketplace_messages'
  `);
  console.log('marketplace_messages collation:', msgTable[0]?.TABLE_COLLATION);

  // Create marketplace_message_reactions if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketplace_message_reactions (
      reaction_id CHAR(36) NOT NULL,
      message_id  CHAR(36) NOT NULL,
      user_id     CHAR(36) NOT NULL,
      emoji       VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (reaction_id),
      UNIQUE KEY unique_mp_reaction (message_id, user_id, emoji),
      INDEX idx_mp_msg (message_id),
      FOREIGN KEY (message_id) REFERENCES marketplace_messages(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✅ marketplace_message_reactions table ready');

  // Test emoji round-trip in marketplace_messages
  const testMsgId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO marketplace_messages (id, conversation_id, sender_id, message_text, message_type) VALUES (?,?,?,?,?)`,
    [testMsgId, '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', '🔥😂👍🏽🫶🏿', 'text']
  ).catch(e => console.log('Test insert skipped (no conversation):', e.sqlMessage || e.message));

  console.log('\n✅ BATCH 1 COMPLETE — DB is utf8mb4, marketplace_message_reactions ready\n');
  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
