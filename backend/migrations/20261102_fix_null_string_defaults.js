/**
 * Migration: 20261102_fix_null_string_defaults.js
 *
 * Corrective migration for a bug in the first run of 20261102_align_collations.
 *
 * INFORMATION_SCHEMA reports an explicit `DEFAULT NULL` through COLUMN_DEFAULT
 * as the four-character string 'NULL'. The earlier migration checked for JS
 * null and then quoted the value, so nullable columns it touched had their SQL
 * NULL default replaced by the literal string 'NULL' — meaning new rows written
 * without that column get the text 'NULL' instead of an actual NULL.
 *
 * This rewrites the affected columns back to a real SQL NULL default, preserving
 * type, nullability, collation and character set.
 *
 * Damage is detected from SHOW CREATE TABLE rather than INFORMATION_SCHEMA,
 * because INFORMATION_SCHEMA renders a genuine DEFAULT NULL as 'NULL' too and
 * cannot distinguish the two. Only columns whose DDL actually contains
 * DEFAULT 'NULL' are touched.
 */
require('dotenv').config();
const pool = require('../config/database');
const logger = require('../utils/logger');

const TARGET_CHARSET = 'utf8mb4';

function quoteIdent(name) {
  return '`' + name.replace(/`/g, '``') + '`';
}

/** Pull the full column definition line out of a SHOW CREATE TABLE dump. */
function extractColumnDef(ddl, column) {
  const lines = ddl.split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*`([^`]+)`\s+(.+?),?\s*$/);
    if (m && m[1] === column) return m[2].trim();
  }
  return null;
}

/** Turn a DDL column definition into a MODIFY ... statement body. */
function toModifyBody(def) {
  // Drop the DEFAULT clause entirely; we will append a clean DEFAULT NULL.
  const cleaned = def.replace(/\s*DEFAULT\s+'NULL'/i, '').replace(/\s+DEFAULT\s+NULL/i, '').trim();
  return cleaned;
}

async function fixNullStringDefaults() {
  console.log('🔧 Running NULL-string-default corrective migration...');

  const [tables] = await pool.query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
     ORDER BY TABLE_NAME
  `);
  console.log('  scanning ' + tables.length + ' tables');

  const offenders = [];

  // Scan one table at a time; SHOW CREATE TABLE is a single round trip.
  const BATCH = 8;
  for (let i = 0; i < tables.length; i += BATCH) {
    const batch = tables.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(async (t) => {
      try {
        const [rows] = await pool.query('SHOW CREATE TABLE ' + quoteIdent(t.TABLE_NAME));
        const ddl = rows[0]['Create Table'];
        const found = [];
        ddl.split('\n').forEach((line) => {
          const m = line.match(/^\s*`([^`]+)`\s+(.+?),?\s*$/);
          if (m && /DEFAULT\s+'NULL'/i.test(m[2])) found.push(m[1]);
        });
        return { table: t.TABLE_NAME, found, ddl };
      } catch (e) {
        return { table: t.TABLE_NAME, found: [], ddl: null, err: e.message };
      }
    }));
    results.forEach((r) => { if (r.found.length) offenders.push(r); });
    if (i + BATCH < tables.length) {
      console.log('  ... ' + Math.min(i + BATCH, tables.length) + '/' + tables.length);
    }
  }

  if (offenders.length === 0) {
    console.log('✅ Nothing to do — no literal NULL-string defaults found');
    return;
  }

  console.log('Found literal NULL-string defaults in ' + offenders.length + ' table(s)');

  let fixed = 0;
  let failed = 0;

  for (const o of offenders) {
    for (const col of o.found) {
      const def = extractColumnDef(o.ddl, col);
      if (!def) {
        console.error('  ✖ ' + o.table + '.' + col + ': could not read definition');
        failed++;
        continue;
      }
      // Rebuild without any default, then add a genuine DEFAULT NULL.
      const body = toModifyBody(def);
      const sql = 'ALTER TABLE ' + quoteIdent(o.table) +
        ' MODIFY COLUMN ' + quoteIdent(col) + ' ' + body + ' DEFAULT NULL';
      try {
        await pool.query(sql);
        fixed++;
        console.log('  ✔ ' + o.table + '.' + col);
      } catch (err) {
        failed++;
        console.error('  ✖ ' + o.table + '.' + col + ': ' + err.message);
        logger.error('[Migration:fixNullDefaults] ' + o.table + '.' + col + ': ' + err.message);
      }
    }
  }

  console.log('🎉 Corrective migration complete: ' + fixed + ' fixed, ' + failed + ' failed.');
}

if (require.main === module) {
  fixNullStringDefaults()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Corrective migration error:', err);
      process.exit(1);
    });
}

module.exports = fixNullStringDefaults;
