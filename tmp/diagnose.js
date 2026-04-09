// tmp/diagnose.js
require('dotenv').config();
const pool = require('../config/database');

async function check() {
  try {
    const [listings] = await pool.query('SELECT status, is_sold, campus, COUNT(*) as count FROM marketplace_listings GROUP BY status, is_sold, campus');
    console.log('--- Marketplace ---');
    console.table(listings);

    const [confessions] = await pool.query('SELECT campus, COUNT(*) as count FROM confessions GROUP BY campus');
    console.log('\n--- Confessions ---');
    console.table(confessions);

    const [users] = await pool.query('SELECT role, COUNT(*) as count FROM users GROUP BY role');
    console.log('\n--- Users ---');
    console.table(users);

    const [routes] = await pool.query('SELECT 1');
    console.log('\n✅ Database connection: OK');

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    process.exit();
  }
}

check();
