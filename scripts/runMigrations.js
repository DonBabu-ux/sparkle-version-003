// scripts/runMigrations.js
const fs = require('fs');
const path = require('path');
const { getPool } = require('../config/database');
const logger = require('../utils/logger');

(async () => {
  try {
    const migrationsDir = path.resolve(__dirname, '../migrations');
    const files = await fs.promises.readdir(migrationsDir);
    // Only .sql files, sorted alphabetically (which includes date prefix)
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();
    if (sqlFiles.length === 0) {
      logger.info('No migration files found');
      process.exit(0);
    }
    const pool = getPool();
    for (const file of sqlFiles) {
      const filePath = path.join(migrationsDir, file);
      const sql = await fs.promises.readFile(filePath, 'utf8');
      logger.info(`Running migration ${file}`);
      // Execute as a single query; allow multiple statements by splitting on ';' if needed
      const statements = sql.split(/;\s*\n/).filter(s => s.trim().length > 0);
      for (const stmt of statements) {
        await pool.query(stmt);
      }
      logger.info(`Migration ${file} completed`);
    }
    logger.info('All migrations applied successfully');
    process.exit(0);
  } catch (err) {
    logger.error('Migration runner error:', err);
    process.exit(1);
  }
})();
