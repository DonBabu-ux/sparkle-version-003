// migrations/20261116_payout_methods.js
require('dotenv').config();
const pool = require('../config/database');

async function migratePayoutMethods() {
  console.log('[migrate] payout methods: ensuring payout_methods...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payout_methods (
      payout_id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      provider ENUM('bank', 'mpesa') NOT NULL,
      account_name VARCHAR(120) NOT NULL,
      account_number VARCHAR(40) NOT NULL,
      bank_code VARCHAR(20) NULL,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_payout_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[migrate] payout_methods ready.');
}

migratePayoutMethods()
  .then(() => { console.log('[migrate] done.'); process.exit(0); })
  .catch((err) => { console.error('[migrate] FAILED:', err.message); process.exit(1); });