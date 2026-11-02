/**
 * Migration: 20261102_align_table_default_collations.js
 *
 * Follow-up to 20261102_align_collations. That migration aligned every
 * non-binary *column* onto utf8mb4_general_ci, but a column-level MODIFY
 * does not change the *table* default, so 21 tables still carry
 * utf8mb4_unicode_ci as their default collation. Any column later added to
 * those tables inherits it, which would reintroduce the original
 * "Illegal mix of collations" failure the first migration fixed.
 *
 * This sets each table's default collation to the majority one.
 *
 * DEFAULT CHARACTER SET is used deliberately, not CONVERT TO CHARACTER SET:
 * CONVERT rewrites every existing column, including the utf8mb4_bin columns
 * that must stay case-sensitive. DEFAULT only records the default for future
 * columns, leaving existing data and column definitions untouched.
 */
require('dotenv').config();
const pool = require('../config/database');
const logger = require('../utils/logger');

const TARGET_COLLATION = 'utf8mb4_general_ci';
const TARGET_CHARSET = 'utf8mb4';

function quoteIdent(name) {
  return '`' + name.replace(/`/g, '``') + '`';
}

async function alignTableDefaults() {
  console.log('🚀 Aligning table-level default collations...');

  const [tables] = await pool.query(`
    SELECT TABLE_NAME, TABLE_COLLATION
      FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_COLLATION <> ?
     ORDER BY TABLE_NAME
  `, [TARGET_COLLATION]);

  if (tables.length === 0) {
    console.log('✅ Nothing to do — every table already defaults to ' + TARGET_COLLATION);
    return;
  }

  console.log('Aligning ' + tables.length + ' table default(s):');
  tables.forEach((t) => console.log('  · ' + t.TABLE_NAME + ' (' + t.TABLE_COLLATION + ')'));

  let changed = 0;
  let failed = 0;

  for (const t of tables) {
    try {
      await pool.query(
        'ALTER TABLE ' + quoteIdent(t.TABLE_NAME) +
        ' DEFAULT CHARACTER SET ' + TARGET_CHARSET +
        ' COLLATE ' + TARGET_COLLATION
      );
      changed++;
      console.log('  ✔ ' + t.TABLE_NAME);
    } catch (err) {
      failed++;
      console.error('  ✖ ' + t.TABLE_NAME + ': ' + err.message);
      logger.error('[Migration:alignTableDefaults] ' + t.TABLE_NAME + ': ' + err.message);
    }
  }

  console.log('🎉 Table-default alignment complete: ' + changed + ' changed, ' + failed + ' failed.');
}

if (require.main === module) {
  alignTableDefaults()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Table-default alignment error:', err);
      process.exit(1);
    });
}

module.exports = alignTableDefaults;
