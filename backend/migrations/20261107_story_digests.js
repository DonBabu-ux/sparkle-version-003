/**
 * Migration: 20261107_story_digests.js
 *
 * Ledger for Engagement Engine Phase 1b — the consolidated "your friends are
 * sharing new stories" digest.
 *
 * One row per (user, story) that has been included in a digest. It is what
 * makes "avoid repeatedly notifying about the same stories" true: a story is
 * eligible until it has been digested, then never again, so a digest can fire
 * again later for *new* stories without repeating the ones already delivered.
 *
 * Rows are not pruned by this migration. They die with the story itself:
 * stories expire 24 hours after creation (stories.expires_at), a story stops
 * being eligible at that point, and the row is never consulted again. The
 * table's growth is bounded by stories x recipients over 24h, and it is
 * indexed for the lookup that matters.
 *
 * Idempotent throughout so a second run is a no-op.
 */
'use strict';

require('dotenv').config();
const pool = require('../config/database');
const logger = require('../utils/logger');

const indexExists = async (table, indexName) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND INDEX_NAME = ? AND TABLE_NAME = ?`,
    [indexName, table]
  );
  return Number(rows[0].n) > 0;
};

async function up() {
  logger.info('[Migration] 20261107_story_digests: ensuring story_digest_notified');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS story_digest_notified (
      notified_id   CHAR(36) NOT NULL PRIMARY KEY,
      user_id       CHAR(36) NOT NULL,
      story_id      CHAR(36) NOT NULL,
      notified_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_story_digest_pair (user_id, story_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('  story_digest_notified table present');

  // Exactly one digest per (recipient, story): the uniqueness that makes
  // "never repeat a story" true, and the shape the eligibility query looks up.
  if (!(await indexExists('story_digest_notified', 'uniq_story_digest_pair'))) {
    await pool.query(
      'CREATE UNIQUE INDEX uniq_story_digest_pair ON story_digest_notified (user_id, story_id)'
    );
    console.log('  created uniq_story_digest_pair');
  } else {
    console.log('  uniq_story_digest_pair already present');
  }

  // Retention: a periodic cleanup can drop rows whose story has expired.
  if (!(await indexExists('story_digest_notified', 'idx_story_digest_notified_at'))) {
    await pool.query(
      'CREATE INDEX idx_story_digest_notified_at ON story_digest_notified (notified_at)'
    );
    console.log('  created idx_story_digest_notified_at');
  } else {
    console.log('  idx_story_digest_notified_at already present');
  }

  // A general "someone posted a story" toggle. The three per-type toggles
  // (notifications_story_likes/shares/replies) cover reactions to existing
  // stories, not new ones, and the digest has to respect the same opt-out
  // shape. Default 1 so existing users keep the behaviour they had.
  await pool.query(
    "ALTER TABLE users ADD COLUMN notifications_stories TINYINT(1) NOT NULL DEFAULT 1"
  ).catch((e) => {
    if (String(e.code) === 'ER_DUP_FIELDNAME' || e.errno === 1060) return;
    throw e;
  });
  console.log('  users.notifications_stories present');

  logger.info('[Migration] 20261107_story_digests: complete');
}

if (require.main === module) {
  up()
    .then(() => process.exit(0))
    .catch((err) => { console.error('MIGRATION FAILED: ' + (err.code || '') + ' ' + err.message); process.exit(1); });
}

module.exports = up;
