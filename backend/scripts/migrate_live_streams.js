require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../config/database');

const tables = [
  `CREATE TABLE IF NOT EXISTS live_stream_comments (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      stream_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      content TEXT NOT NULL,
      is_pinned TINYINT(1) NOT NULL DEFAULT 0,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_lsc_stream (stream_id, created_at),
      INDEX idx_lsc_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS live_stream_gifts (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      stream_id VARCHAR(36) NOT NULL,
      sender_id VARCHAR(36) NOT NULL,
      recipient_id VARCHAR(36) NOT NULL,
      gift_name VARCHAR(100) NOT NULL,
      coins INT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_lsg_stream (stream_id),
      INDEX idx_lsg_sender (sender_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS live_stream_moderators (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      stream_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      assigned_by VARCHAR(36) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_lsm_stream_user (stream_id, user_id),
      INDEX idx_lsm_stream (stream_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS live_stream_mutes (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      stream_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      muted_until DATETIME NOT NULL,
      muted_by VARCHAR(36) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_ls_mute (stream_id, user_id),
      INDEX idx_lsmute_stream (stream_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS live_stream_guests (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      stream_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      status ENUM('pending','accepted','declined','left','removed') NOT NULL DEFAULT 'pending',
      role ENUM('guest','cohost') NOT NULL DEFAULT 'guest',
      joined_at DATETIME NULL,
      left_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_lsg_session_user (stream_id, user_id),
      INDEX idx_lsg_stream (stream_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];

async function run() {
  for (const sql of tables) {
    await pool.query(sql);
  }
  console.log('✅ Live stream support tables verified / created successfully!');
  process.exit(0);
}

run().catch(e => {
  console.error('Migration failed:', e.message);
  process.exit(1);
});

