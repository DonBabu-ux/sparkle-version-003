// run_migration.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
  try {
    const sqlFile = path.resolve(__dirname, 'migrations', '20240523_add_message_read_status.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true,
    });
    console.log('Running migration...');
    await connection.query(sql);
    console.log('Migration completed successfully.');
    await connection.end();
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
})();
