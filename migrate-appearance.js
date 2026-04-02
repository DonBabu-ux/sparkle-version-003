require('dotenv').config();
const pool = require('./config/database');

async function migrate() {
  try {
    console.log('Starting Appearance & Language migration with .env correctly loaded...');
    
    // Check connection
    const [rows] = await pool.query('SELECT 1');
    console.log('Database connection OK.');

    const alterStatements = [
      "ALTER TABLE users ADD COLUMN theme VARCHAR(10) DEFAULT 'light'",
      "ALTER TABLE users ADD COLUMN font_size VARCHAR(10) DEFAULT 'medium'",
      "ALTER TABLE users ADD COLUMN language VARCHAR(10) DEFAULT 'en'"
    ];

    for (const sql of alterStatements) {
      try {
        console.log(`Executing: ${sql}`);
        await pool.query(sql);
      } catch (err) {
        if (err.errno === 1060) {
          console.log(`Column already exists, skipping...`);
        } else {
          console.error(`Error executing ${sql}:`, err.message);
          throw err;
        }
      }
    }
    
    console.log('Migration successful: theme, font_size, and language columns added/verified.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed FATAL:', err);
    process.exit(1);
  }
}

migrate();
