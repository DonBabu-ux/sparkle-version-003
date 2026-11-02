/**
 * Migration: 20261102_align_collations.js
 *
 * Part of this schema was created during a window where the server default
 * collation was utf8mb4_unicode_ci instead of utf8mb4_general_ci. The result
 * is 190 tables on general_ci and 21 tables on unicode_ci, and any query
 * comparing a column across the two groups fails with:
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
 *
 * Two things this must get right, because getting them wrong silently damages
 * the schema:
 *
 *   1. MySQL 8 reports an explicit DEFAULT NULL through INFORMATION_SCHEMA as
 *      the four-character string 'NULL'. Quoting that as a string literal
 *      replaces the SQL NULL default with a literal 'NULL' value, so the
 *      string form has to be written back as real SQL NULL.
 *
 *   2. Columns inside a foreign key cannot be altered directly. Those are
 *      handled by dropping the constraint, altering both sides, then restoring
 *      it, so referential integrity survives the change.
 */
require('dotenv').config();
const pool = require('../config/database');
const logger = require('../utils/logger');

const TARGET_CHARSET = 'utf8mb4';
const TARGET_COLLATION = 'utf8mb4_general_ci';

function quoteIdent(name) {
  return '`' + name.replace(/`/g, '``') + '`';
}

/**
 * Finds the FK constraints that block a column from being altered.
 *
 * Returns a Map keyed by `${TABLE}.${COLUMN}`. Each value is the constraint
 * metadata needed to re-create it afterwards.
 */
async function collectForeignKeyBlockers(cols) {
  const blockers = new Map();
  const tables = [...new Set(cols.map((c) => c.TABLE_NAME))];
  for (const t of tables) {
    try {
      const [fks] = await pool.query(`
        SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME,
               REFERENCED_COLUMN_NAME
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
           AND REFERENCED_TABLE_NAME IS NOT NULL
      `, [t]);
      fks.forEach((fk) => {
        const key = t + '.' + fk.COLUMN_NAME;
        if (!blockers.has(key)) blockers.set(key, []);
        blockers.get(key).push(fk);
      });
    } catch (e) {
      // Non-fatal: the column just gets skipped, same as before.
    }
  }
  return blockers;
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

  // Columns that participate in a foreign key cannot be altered directly:
  // MySQL refuses with "used in a foreign key constraint". Those get their
  // FKs dropped first and re-added after, so the constraint survives.
  const FK_BLOCKERS = await collectForeignKeyBlockers(cols);

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
      // MySQL 8 reports an explicit DEFAULT NULL as the literal string 'NULL',
      // not as SQL NULL. Quoting it would silently turn those columns into
      // NOT-defaulted-at-all columns carrying the four-character string
      // 'NULL', so the string has to be written back as SQL NULL.
      const raw = String(c.COLUMN_DEFAULT);
      if (/^NULL$/i.test(raw)) {
        def += ' DEFAULT NULL';
      } else {
        const isNumeric = /^(bit|tinyint|smallint|mediumint|int|integer|bigint|float|double|decimal|numeric)/i.test(c.COLUMN_TYPE);
        const isTimestampExtra = /CURRENT_TIMESTAMP/i.test(raw);
        if (isTimestampExtra || isNumeric) {
          def += ' DEFAULT ' + raw;
        } else {
          const lit = raw.replace(/'/g, "''");
          def += " DEFAULT '" + lit + "'";
        }
      }
    }

    const extra = String(c.EXTRA || '');
    if (/auto_increment/i.test(extra)) {
      def += ' AUTO_INCREMENT';
    }

    const alterSql = 'ALTER TABLE ' + quoteIdent(c.TABLE_NAME) +
      ' MODIFY COLUMN ' + quoteIdent(c.COLUMN_NAME) + ' ' + def;

    // Columns referenced by a foreign key are locked by MySQL until the
    // constraint goes. Drop, alter, restore — so the FK survives.
    const blockers = FK_BLOCKERS.get(c.TABLE_NAME + '.' + c.COLUMN_NAME) || [];

    try {
      if (blockers.length > 0) {
        for (const bk of blockers) {
          await pool.query(
            'ALTER TABLE ' + quoteIdent(c.TABLE_NAME) +
            ' DROP FOREIGN KEY ' + quoteIdent(bk.CONSTRAINT_NAME)
          );
        }
      }

      await pool.query(alterSql);
      changed++;
      if (changed % 10 === 0) console.log('  ... ' + changed + ' columns aligned');

      if (blockers.length > 0) {
        for (const bk of blockers) {
          await pool.query(
            'ALTER TABLE ' + quoteIdent(c.TABLE_NAME) +
            ' ADD CONSTRAINT ' + quoteIdent(bk.CONSTRAINT_NAME) +
            ' FOREIGN KEY (' + quoteIdent(bk.COLUMN_NAME) + ')' +
            ' REFERENCES ' + quoteIdent(bk.REFERENCED_TABLE_NAME) +
            ' (' + quoteIdent(bk.REFERENCED_COLUMN_NAME) + ')'
          );
        }
      }
    } catch (err) {
      skipped++;
      console.error(`  ✖ ${c.TABLE_NAME}.${c.COLUMN_NAME}: ${err.message}`);
      logger.error(`[Migration:alignCollations] ${c.TABLE_NAME}.${c.COLUMN_NAME}: ${err.message}`);

      // If the alter failed after we already dropped its FK, put the constraint
      // back so the column is never left dangling without referential integrity.
      if (blockers.length > 0) {
        for (const bk of blockers) {
          try {
            const [still] = await pool.query(`
              SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
                 AND CONSTRAINT_NAME = ?
            `, [c.TABLE_NAME, bk.CONSTRAINT_NAME]);
            if (still.length === 0) {
              await pool.query(
                'ALTER TABLE ' + quoteIdent(c.TABLE_NAME) +
                ' ADD CONSTRAINT ' + quoteIdent(bk.CONSTRAINT_NAME) +
                ' FOREIGN KEY (' + quoteIdent(bk.COLUMN_NAME) + ')' +
                ' REFERENCES ' + quoteIdent(bk.REFERENCED_TABLE_NAME) +
                ' (' + quoteIdent(bk.REFERENCED_COLUMN_NAME) + ')'
              );
              console.log(`    ↺ restored FK ${bk.CONSTRAINT_NAME} on ${c.TABLE_NAME}`);
            }
          } catch (restoreErr) {
            logger.error(`[Migration:alignCollations] could not restore FK ${bk.CONSTRAINT_NAME}: ${restoreErr.message}`);
          }
        }
      }
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
