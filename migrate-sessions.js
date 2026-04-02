require('dotenv').config();
const pool = require('./config/database');

async function migrate() {
  try {
    console.log('Adding support for Active Sessions and Token Invalidation...');
    
    // Add token_version to users table for global logout
    try {
      await pool.query("ALTER TABLE users ADD COLUMN token_version INT DEFAULT 0");
      console.log('Added token_version to users.');
    } catch(err) { if(err.errno !== 1060) throw err; }

    // Create sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        session_id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        device_name VARCHAR(255),
        ip_address VARCHAR(45),
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sessions_user (user_id)
      )
    `);
    console.log('Created user_sessions table.');
    
    process.exit(0);
  } catch (err) {
    console.error('Migration failed FATAL:', err);
    process.exit(1);
  }
}

migrate();
