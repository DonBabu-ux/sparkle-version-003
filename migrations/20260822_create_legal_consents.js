// migrations/20260822_create_legal_consents.js
require('dotenv').config();
const pool = require('../config/database');

async function migrateLegalConsents() {
  console.log('🚀 Starting legal consents database migration...');
  try {
    // 1. Create user_legal_consents table if it does not exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_legal_consents (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        document_id VARCHAR(50) NOT NULL,
        version VARCHAR(20) NOT NULL,
        accepted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45) DEFAULT NULL,
        INDEX idx_user_doc (user_id, document_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ Legal consents table created/verified successfully.');
  } catch (error) {
    console.error('❌ Legal consents migration error:', error.message);
  }
}

if (require.main === module) {
  migrateLegalConsents().then(() => process.exit(0));
}

module.exports = migrateLegalConsents;
