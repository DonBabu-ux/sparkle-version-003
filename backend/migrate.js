const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

async function runMigrations() {
  const migrationsDir = path.join(__dirname);
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`Running migration: ${file}`);
    try {
      await pool.query(sql);
      console.log(`✅ ${file}`);
    } catch (err) {
      console.error(`❌ Error in ${file}:`, err.message);
      process.exit(1);
    }
  }
  console.log('All migrations applied.');
  process.exit(0);
}

runMigrations();
