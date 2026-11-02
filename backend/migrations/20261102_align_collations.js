/**
 * Migration: 20261102_align_collations.js
 *
 * Part of this schema was created during a window where the server default
 * collation was utf8mb4_unicode_ci instead of utf8mb4_general_ci. The result
 * is 190 tables on general_ci and 21 on unicode_ci, and any query comparing a
 * column across the two groups fails with:
 *
 *   Illegal mix of collations (utf8mb4_unicode_ci,IMPLICIT) and
 *   (utf8mb4_general_ci,IMPLICIT) for operation '='
 *
 * That is what took down GET /api/stories/active: getStories joins
 * close_friends (unicode_ci) against stories/users (general_ci).
 *
 * This aligns the outliers onto the majority collation, one column at a time,
 * so utf8mb4_bin columns (tokens, codes, ids that must stay case-sensitive)
 * are never touched. Idempotent: re-running finds nothing to change.
 */
require('dotenv').config();
const pool = require('../config/database');
const logger = require('../utils/logger');

const TARGET_CHARSET = 'utf8mb4';
const TARGET_COLLATION = 'utf8mb4_general_ci';

function quoteIdent(name) {
  return '`' + name.replace(/`/g, '``') + '`';
}

async function migrateCollations() {
  console.log('🚀 Running collation alignment migration...');

  const [cols] = await pool.query(`
    SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT,
           EXTRA, COLLATION_NAME, CHARACTER_SET_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND COLLATION_NAME IS NOT NULL
       AND COLLATION_NAME <> ?
       AND COLLATION_NAME NOT LIKE 'utf8mb4_bin'
     ORDER BY TABLE_NAME, ORDINAL_POSITION
  `, [TARGET_COLLATION]);

  if (cols.length === 0) {
    console.log('✅ Nothing to do — every non-binary column already matches ' + TARGET_COLLATION);
    return;
  }

  const from = [...new Set(cols.map((c) => c.COLLATION_NAME))].join(', ');
  const tables = [...new Set(cols.map((c) => c.TABLE_NAME))];
  console.log(`Aligning ${cols.length} column(s) across ${tables.length} table(s) from: ${from}`);

  let changed = 0;
  let skipped = 0;

  for (const c of cols) {
    // Rebuild the column definition from its metadata. TEXT/BLOB cannot carry
    // a DEFAULT in this server generation, so only add one where the column
    // actually has one.
    let def = c.COLUMN_TYPE +
      ' CHARACTER SET ' + TARGET_CHARSET +
      ' COLLATE ' + TARGET_COLLATION;

    if (c.IS_NULLABLE === 'NO') {
      def += ' NOT NULL';
    } else {
      def += ' NULL';
    }

    if (c.COLUMN_DEFAULT !== null && !/^(text|tinytext|mediumtext|longtext|blob|tinyblob|mediumblob|longblob|json)/i.test(c.COLUMN_TYPE)) {
      const isNumeric = /^(bit|tinyint|smallint|mediumint|int|integer|bigint|float|double|decimal|numeric)/i.test(c.COLUMN_TYPE);
      const isTimestampExtra = /CURRENT_TIMESTAMP/i.test(String(c.COLUMN_DEFAULT));
      if (isTimestampExtra) {
        def += ' DEFAULT ' + c.COLUMN_DEFAULT;
      } else if (isNumeric) {
        def += ' DEFAULT ' + c.COLUMN_DEFAULT;
      } else {
        const lit = String(c.COLUMN_DEFAULT).replace(/'/g, "''");
        def += " DEFAULT '" + lit + "'";
      }
    }

    const extra = String(c.EXTRA || '');
    if (/auto_increment/i.test(extra)) {
      def += ' AUTO_INCREMENT';
    }

    try {
      await pool.query(
        'ALTER TABLE ' + quoteIdent(c.TABLE_NAME) +
        ' MODIFY COLUMN ' + quoteIdent(c.COLUMN_NAME) + ' ' + def
      );
      changed++;
      if (changed % 10 === 0) console.log('  ... ' + changed + ' columns aligned');
    } catch (err) {
      skipped++;
      console.error(`  ✖ ${c.TABLE_NAME}.${c.COLUMN_NAME}: ${err.message}`);
      logger.error(`[Migration:alignCollations] ${c.TABLE_NAME}.${c.COLUMN_NAME}: ${err.message}`);
    }
  }

  console.log(`🎉 Collation alignment complete: ${changed} changed, ${skipped} skipped.`);
}

if (require.main === module) {
  migrateCollations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Collation migration error:', err);
      process.exit(1);
    });
}

module.exports = migrateCollations;
