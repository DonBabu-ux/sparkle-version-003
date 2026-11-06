/**
 * Migration: 20261106_harden_moments.js
 *
 * Closes the moments-shaped holes found in the production-readiness audit.
 * Everything here is idempotent: each step probes information_schema first and
 * is a no-op once the work is done, so re-running (or running on a database
 * that was repaired by hand) is safe.
 *
 * 1. moment_hashtags / moment_likes accumulate orphans. Both tables have no
 *    foreign key, so a deleted moment leaves its hashtags and likes behind.
 *    Measured live: 109 + 54 rows. Foreign keys are added so this stops.
 *
 * 2. moments.media_type is filled by createMoment from the upload mimetype with
 *    a URL sniff as fallback. Rows that slip through with an empty value render
 *    an <img> for an .mp4 and show as a permanently broken media tile, because
 *    MomentStudio branches on === 'video' without an extension fallback.
 *    Backfill any that remain.
 *
 * 3. moments.video_url is declared NOT NULL DEFAULT '' and every row is empty —
 *    a dead column that the media-health job never probes. Making it nullable
 *    lets "no separate video URL" be absent rather than an empty-string lie.
 */
'use strict';

require('dotenv').config();
const pool = require('../config/database');
const logger = require('../utils/logger');

const FK_TARGETS = [
  {
    table: 'moment_hashtags',
    column: 'moment_id',
    fkName: 'fk_moment_hashtags_moment',
    label: 'moment_hashtags.moment_id',
  },
  {
    table: 'moment_likes',
    column: 'moment_id',
    fkName: 'fk_moment_likes_moment',
    label: 'moment_likes.moment_id',
  },
];

const columnExists = async (table, column) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(rows[0].n) > 0;
};

const tableExists = async (table) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return Number(rows[0].n) > 0;
};

const indexExists = async (table, indexName) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND INDEX_NAME = ? AND TABLE_NAME = ?`,
    [indexName, table]
  );
  return Number(rows[0].n) > 0;
};

const constraintExists = async (table, constraintName) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
    [table, constraintName]
  );
  return Number(rows[0].n) > 0;
};

/** Delete orphans, then add the FK that prevents them coming back. */
async function hardenForeignKey(target) {
  if (!(await tableExists(target.table))) {
    console.log(`  skip ${target.label} - table does not exist`);
    return 'absent';
  }
  if (!(await columnExists(target.table, target.column))) {
    console.log(`  skip ${target.label} - column does not exist`);
    return 'absent';
  }
  if (!(await columnExists('moments', 'moment_id'))) {
    // The parent key must exist for the FK to reference.
    console.log(`  skip ${target.label} - moments.moment_id does not exist`);
    return 'absent';
  }

  // Remove existing orphans first, otherwise the ADD CONSTRAINT fails.
  const [res] = await pool.query(
    `DELETE ${target.table} FROM ${target.table}
     LEFT JOIN moments m ON m.moment_id = ${target.table}.${target.column}
     WHERE m.moment_id IS NULL`
  );
  const removed = res && typeof res.affectedRows === 'number' ? res.affectedRows : 0;
  if (removed > 0) console.log(`  removed ${removed} orphaned row(s) from ${target.table}`);

  if (await constraintExists(target.table, target.fkName)) {
    return 'present';
  }

  const hasIdx = await indexExists(target.table, target.fkName);
  if (!hasIdx) {
    // MySQL needs an index on the referencing column before a FK can use it.
    await pool.query(
      `CREATE INDEX ${target.fkName} ON ${target.table} (${target.column})`
    );
    console.log(`  created index ${target.fkName} on ${target.table}(${target.column})`);
  }

  await pool.query(
    `ALTER TABLE ${target.table}
     ADD CONSTRAINT ${target.fkName}
     FOREIGN KEY (${target.column}) REFERENCES moments (moment_id) ON DELETE CASCADE`
  );
  console.log(`  added ${target.fkName} (ON DELETE CASCADE)`);
  return 'added';
}

async function backfillMediaType() {
  if (!(await columnExists('moments', 'media_type'))) return 'absent';
  if (!(await columnExists('moments', 'media_url'))) return 'absent';

  const [before] = await pool.query(
    `SELECT COUNT(*) AS n FROM moments
     WHERE media_type IS NULL OR media_type = ''`
  );
  const empty = Number(before[0].n);
  if (empty === 0) return 'clean';

  // Derive the type the same way createMoment does: video extension wins, else
  // image. Unknown extensions default to image so nothing renders a <video> for
  // a still.
  const [res] = await pool.query(
    `UPDATE moments
     SET media_type = CASE
       WHEN LOWER(SUBSTRING_INDEX(media_url, '.', -1)) IN ('mp4','mov','webm','m4v','avi','mkv','3gp')
         THEN 'video'
       ELSE 'image'
     END
     WHERE (media_type IS NULL OR media_type = '')
       AND media_url IS NOT NULL AND media_url <> ''`
  );
  const fixed = res && typeof res.affectedRows === 'number' ? res.affectedRows : 0;

  const [stillEmpty] = await pool.query(
    `SELECT COUNT(*) AS n FROM moments
     WHERE media_type IS NULL OR media_type = ''`
  );
  console.log(
    `  media_type: ${fixed} row(s) derived from the URL, ` +
    `${Number(stillEmpty[0].n)} still empty (no media_url to sniff)`
  );
  return fixed > 0 ? 'backfilled' : 'partial';
}

async function relaxVideoUrl() {
  if (!(await columnExists('moments', 'video_url'))) return 'absent';

  const [cols] = await pool.query(
    `SELECT IS_NULLABLE, COLUMN_DEFAULT, COLUMN_TYPE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'moments' AND COLUMN_NAME = 'video_url'`
  );
  const col = cols[0];
  if (!col) return 'absent';
  if (col.IS_NULLABLE === 'YES') return 'already nullable';

  // Keep the type and the default; only allow NULL. A default of '' on a NOT
  // NULL column is what filled the table with lies.
  await pool.query(
    `ALTER TABLE moments MODIFY video_url ${col.COLUMN_TYPE} NULL DEFAULT NULL`
  );
  console.log(`  moments.video_url is now NULLable (empty-string default removed)`);
  return 'relaxed';
}

async function up() {
  logger.info('[Migration] 20261106_harden_moments: starting');

  console.log('-- foreign keys for moments children --');
  for (const t of FK_TARGETS) {
    try {
      await hardenForeignKey(t);
    } catch (e) {
      // A pre-existing orphan we could not represent, or a collation mismatch
      // that 20261102_align_collations.js has not fixed yet. Report and move on
      // rather than aborting the whole boot.
      logger.warn(`[Migration] ${t.label} not hardened: ${e.message}`);
    }
  }

  console.log('-- moments.media_type backfill --');
  try {
    await backfillMediaType();
  } catch (e) {
    logger.warn(`[Migration] moments.media_type backfill skipped: ${e.message}`);
  }

  console.log('-- moments.video_url --');
  try {
    await relaxVideoUrl();
  } catch (e) {
    logger.warn(`[Migration] moments.video_url relaxation skipped: ${e.message}`);
  }

  logger.info('[Migration] 20261106_harden_moments: complete');
}

if (require.main === module) {
  up()
    .then(() => process.exit(0))
    .catch((err) => { console.error('MIGRATION FAILED: ' + (err.code || '') + ' ' + err.message); process.exit(1); });
}

module.exports = up;
