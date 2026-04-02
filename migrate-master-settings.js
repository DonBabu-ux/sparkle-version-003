require('dotenv').config();
const pool = require('./config/database');

async function migrate() {
  try {
    console.log('Starting Master Settings Migration...');
    
    const alterStatements = [
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_visibility VARCHAR(20) DEFAULT 'Everyone'",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_visibility VARCHAR(20) DEFAULT 'Everyone'",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS activity_status_enabled TINYINT(1) DEFAULT 1",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS anonymous_mode_enabled TINYINT(1) DEFAULT 0",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS show_birthday TINYINT(1) DEFAULT 1",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS show_contact_info TINYINT(1) DEFAULT 1",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS message_privacy VARCHAR(20) DEFAULT 'Everyone'",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS push_notifications_enabled TINYINT(1) DEFAULT 1",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications_enabled TINYINT(1) DEFAULT 1",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_likes TINYINT(1) DEFAULT 1",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_comments TINYINT(1) DEFAULT 1",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_follows TINYINT(1) DEFAULT 1",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_messages TINYINT(1) DEFAULT 1",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS dnd_enabled TINYINT(1) DEFAULT 0",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS dnd_start_time TIME DEFAULT '22:00:00'",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS dnd_end_time TIME DEFAULT '07:00:00'"
    ];

    // Note: MariaDB doesn't support IF NOT EXISTS for columns in all versions. 
    // We'll wrap each in try/catch to handle duplicates.
    for (const sql of alterStatements) {
      try {
        const cleanedSql = sql.replace('IF NOT EXISTS ', '');
        console.log(`Executing: ${cleanedSql}`);
        await pool.query(cleanedSql);
      } catch (err) {
        if (err.errno === 1060) {
          console.log(`Column already exists, skipping...`);
        } else {
          console.error(`Error executing migration for column: ${err.message}`);
        }
      }
    }
    
    console.log('Master Settings Migration successful!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed FATAL:', err);
    process.exit(1);
  }
}

migrate();
