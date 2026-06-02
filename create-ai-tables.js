// create-ai-tables.js
// Run with: node create-ai-tables.js
// This script creates tables for AI chat, message caching, usage tracking, and prompt cache.

const db = require('./config/database');

async function createTables() {
  try {
    // AI conversations table
    await db.query(`
      CREATE TABLE IF NOT EXISTS ai_conversations (
        conversation_id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        title VARCHAR(255) NULL,
        INDEX idx_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // AI messages table
    await db.query(`
      CREATE TABLE IF NOT EXISTS ai_messages (
        message_id CHAR(36) PRIMARY KEY,
        conversation_id CHAR(36) NOT NULL,
        role ENUM('system','assistant','user') NOT NULL,
        content TEXT NOT NULL,
        token_count INT UNSIGNED NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_conversation (conversation_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // AI usage tracking (daily per user/IP)
    await db.query(`
      CREATE TABLE IF NOT EXISTS ai_usage (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id CHAR(36) NULL,
        ip_address VARCHAR(45) NULL,
        date DATE NOT NULL,
        tokens_used BIGINT UNSIGNED DEFAULT 0,
        requests INT UNSIGNED DEFAULT 0,
        UNIQUE KEY uniq_user_date (user_id, date),
        INDEX idx_ip_date (ip_address, date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Prompt cache (hash of prompt + model)
    await db.query(`
      CREATE TABLE IF NOT EXISTS ai_prompt_cache (
        cache_id CHAR(36) PRIMARY KEY,
        prompt_hash CHAR(64) NOT NULL,
        model VARCHAR(64) NOT NULL,
        response TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        INDEX idx_hash_model (prompt_hash, model)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('AI tables created successfully');
  } catch (err) {
    console.error('Error creating AI tables:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

createTables();
