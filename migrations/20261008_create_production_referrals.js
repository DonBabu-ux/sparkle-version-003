// migrations/20261008_create_production_referrals.js
// Production Referral Attribution & Rewards Database Migration
require('dotenv').config();
const pool = require('../config/database');

async function migrateProductionReferrals() {
  console.log('🚀 Starting Sparkle Production Referral System migration...');
  try {
    // 1. referral_codes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS referral_codes (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        code VARCHAR(32) NOT NULL,
        active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_referral_code (code),
        UNIQUE KEY uk_referral_user (user_id),
        INDEX idx_user_active (user_id, active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);
    console.log('✅ referral_codes table verified.');

    // 2. referral_clicks table (server-side sessions & handoff tokens)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS referral_clicks (
        id VARCHAR(36) PRIMARY KEY,
        referral_code_id VARCHAR(36) DEFAULT NULL,
        referrer_user_id VARCHAR(36) NOT NULL,
        code VARCHAR(32) NOT NULL,
        anonymous_session_id VARCHAR(64) DEFAULT NULL,
        handoff_token_hash VARCHAR(64) DEFAULT NULL,
        platform VARCHAR(32) DEFAULT 'web',
        source VARCHAR(64) DEFAULT 'invite_link',
        user_agent VARCHAR(255) DEFAULT NULL,
        ip_hash VARCHAR(64) DEFAULT NULL,
        status VARCHAR(32) DEFAULT 'clicked',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NULL,
        INDEX idx_handoff_token (handoff_token_hash),
        INDEX idx_referrer (referrer_user_id),
        INDEX idx_code (code),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);
    console.log('✅ referral_clicks table verified.');

    // 3. referrals table (immutable attribution & status)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id VARCHAR(36) PRIMARY KEY,
        referrer_user_id VARCHAR(36) NOT NULL,
        referred_user_id VARCHAR(36) NOT NULL,
        referral_code_id VARCHAR(36) DEFAULT NULL,
        click_id VARCHAR(36) DEFAULT NULL,
        status ENUM('pending', 'clicked', 'installed', 'signup_started', 'joined', 'qualified', 'rewarded', 'rejected', 'expired') DEFAULT 'joined',
        attribution_method VARCHAR(32) DEFAULT 'invite_link',
        attributed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        qualified_at TIMESTAMP NULL,
        rewarded_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_referred_user (referred_user_id),
        INDEX idx_referrer_status (referrer_user_id, status),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ referrals table verified.');

    // 4. referral_rewards table (atomic rewards, prevents double-rewards)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS referral_rewards (
        id VARCHAR(36) PRIMARY KEY,
        referral_id VARCHAR(36) NOT NULL,
        referrer_user_id VARCHAR(36) NOT NULL,
        reward_type VARCHAR(32) DEFAULT 'wallet_credit',
        reward_amount DECIMAL(10,2) NOT NULL DEFAULT 60.00,
        currency VARCHAR(10) DEFAULT 'KES',
        status VARCHAR(32) DEFAULT 'credited',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_reward_referral (referral_id),
        INDEX idx_referrer_reward (referrer_user_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ referral_rewards table verified.');

    // Convert existing tables to utf8mb4_general_ci to ensure exact collation match with users
    await pool.query('ALTER TABLE referral_codes CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;');
    await pool.query('ALTER TABLE referral_clicks CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;');
    await pool.query('ALTER TABLE referrals CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;');
    await pool.query('ALTER TABLE referral_rewards CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;');
    console.log('✅ referral tables collation aligned to utf8mb4_general_ci.');

    console.log('🎉 Production referral tables migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

if (require.main === module) {
  migrateProductionReferrals().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = migrateProductionReferrals;
