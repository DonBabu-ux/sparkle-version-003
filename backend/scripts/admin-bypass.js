/**
 * admin-bypass.js  — MySQL version (correct column names)
 * Ensures lewismwangi990@gmail.com bypasses ALL account gates:
 *   - account_status = 'active'
 *   - email_verified = 1
 *   - is_verified    = 1
 *   - suspended_at   = NULL  (clears suspension)
 *   - suspension_reason/by = NULL
 *   - terminated_at  = NULL
 *   - deleted_at     = NULL
 *   - followers_count >= 1000  (unlocks live page)
 */
require('dotenv').config({ path: __dirname + '/../.env' });
const mysql = require('mysql2/promise');

const TARGET_EMAIL = 'lewismwangi990@gmail.com';

async function run() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_password || process.env.DB_PASS || process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port:     parseInt(process.env.DB_PORT || '3306', 10),
    ssl:      false,
    connectTimeout: 15000,
  });

  try {
    // 1. Show current state
    const [before] = await conn.execute(
      `SELECT user_id, username, email, account_status, email_verified, is_verified,
              suspended_at, terminated_at, deleted_at, token_version, role
       FROM users WHERE email = ?`,
      [TARGET_EMAIL]
    );

    if (!before.length) {
      console.log(`❌ User not found: ${TARGET_EMAIL}`);
      return;
    }

    console.log('\n📋 BEFORE:');
    console.log(JSON.stringify(before[0], null, 2));

    // 2. Check if followers_count column exists
    const [cols] = await conn.execute("SHOW COLUMNS FROM users LIKE 'followers_count'");
    const hasFollowers = cols.length > 0;

    // 3. Apply all bypasses
    const followersPart = hasFollowers
      ? ', followers_count = GREATEST(COALESCE(followers_count, 0), 1000)'
      : '';

    await conn.execute(
      `UPDATE users SET
         account_status     = 'active',
         email_verified     = 1,
         is_verified        = 1,
         suspended_at       = NULL,
         suspension_reason  = NULL,
         suspended_by       = NULL,
         suspension_expires_at = NULL,
         terminated_at      = NULL,
         termination_reason = NULL,
         terminated_by      = NULL,
         deleted_at         = NULL,
         deletion_requested_at = NULL,
         deletion_scheduled_at = NULL,
         deletion_marked_at = NULL
         ${followersPart}
       WHERE email = ?`,
      [TARGET_EMAIL]
    );

    const [after] = await conn.execute(
      `SELECT user_id, username, email, account_status, email_verified, is_verified,
              suspended_at, terminated_at, deleted_at, token_version, role
       FROM users WHERE email = ?`,
      [TARGET_EMAIL]
    );

    console.log('\n✅ AFTER:');
    console.log(JSON.stringify(after[0], null, 2));
    console.log('\n🎉 Account fully unblocked for', TARGET_EMAIL);
    console.log('   ✔ account_status  = active');
    console.log('   ✔ email_verified  = 1   (passes email verification page)');
    console.log('   ✔ is_verified     = 1   (shows verified badge)');
    console.log('   ✔ suspended_at    = NULL (not suspended)');
    console.log('   ✔ terminated_at   = NULL (not terminated)');
    console.log('   ✔ deleted_at      = NULL (not deleted)');
    if (hasFollowers) console.log('   ✔ followers_count >= 1000 (passes live-streams gate)');

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
  } finally {
    await conn.end();
  }
}

run();
