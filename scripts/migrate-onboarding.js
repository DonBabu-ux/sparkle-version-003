// scripts/migrate-onboarding.js
/**
 * Migration script to add onboarding related columns/tables.
 * Run with: node scripts/migrate-onboarding.js
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    // Check if onboarding_step column exists in users table
    const [columns] = await connection.query(`
      SHOW COLUMNS FROM users LIKE 'onboarding_step'
    `);

    if (columns.length === 0) {
      console.log('Adding onboarding_step column to users table...');
      await connection.query(`
        ALTER TABLE users
        ADD COLUMN onboarding_step INT NOT NULL DEFAULT 0,
        ADD INDEX idx_onboarding_step (onboarding_step);
      `);
      console.log('Added onboarding_step column and index.');
    } else {
      console.log('onboarding_step column already exists on users table.');
    }

    // Drop tables if they already exist to clear wrong collations
    console.log('Cleaning up existing user_interests/onboarding_events tables...');
    await connection.query('DROP TABLE IF EXISTS onboarding_events, user_interests;');

    // Create user_interests table (no separate interests table)
    console.log('Creating user_interests table if not exists...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_interests (
        user_id CHAR(36) NOT NULL,
        interest_slug VARCHAR(64) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, interest_slug),
        INDEX idx_interest_slug (interest_slug),
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    // Create onboarding_events table for analytics
    console.log('Creating onboarding_events table if not exists...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS onboarding_events (
        event_id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        event_type VARCHAR(32) NOT NULL,
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    console.log('Onboarding migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
})();
