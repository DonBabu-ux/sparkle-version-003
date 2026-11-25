// migrations/20261116_support_ticket_messages.js
require('dotenv').config();
const pool = require('../config/database');

async function migrateSupportTicketMessages() {
  console.log('[migrate] support ticket replies: ensuring support_ticket_messages...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS support_ticket_messages (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      ticket_id VARCHAR(64) NOT NULL,
      sender_id VARCHAR(36) NOT NULL,
      sender_name VARCHAR(100) DEFAULT NULL,
      is_admin TINYINT(1) NOT NULL DEFAULT 0,
      message TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_stm_ticket (ticket_id),
      KEY idx_stm_sender (sender_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);
  console.log('[migrate] support_ticket_messages ready.');
}

migrateSupportTicketMessages()
  .then(() => { console.log('[migrate] done.'); process.exit(0); })
  .catch((err) => { console.error('[migrate] FAILED:', err.message); process.exit(1); });