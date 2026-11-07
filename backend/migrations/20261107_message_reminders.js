/**
 * Migration: 20261107_message_reminders.js
 *
 * Ledger for the unread-message reminder engine (Engagement Engine Phase 1a).
 *
 * Why a table rather than a column on personal_chats: a reminder is per
 * (user, chat), not per chat. Both participants of a conversation can be
 * unread at once, and the reminder has to track how many nudges that
 * specific person has already had so it can escalate on an hourly cadence
 * instead of spamming or reminding twice in one pass.
 *
 * The row is deleted rather than flagged when a conversation stops being
 * eligible, so "no row" means "never reminded or already addressed" —
 * which is what makes repeated reminders impossible without needing a
 * separate reset signal from every read path. See
 * services/messageReminderService.js for how eligibility is derived.
 *
 * Idempotent throughout: CREATE TABLE IF NOT EXISTS plus an
 * information_schema probe before the index, so re-running is a no-op.
 */
'use strict';

require('dotenv').config();
const pool = require('../config/database');
const logger = require('../utils/logger');

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

async function up() {
  logger.info('[Migration] 20261107_message_reminders: ensuring message_reminders');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS message_reminders (
      reminder_id       CHAR(36) NOT NULL PRIMARY KEY,
      user_id           CHAR(36) NOT NULL,
      chat_id           CHAR(36) NOT NULL,
      unread_count      INT NOT NULL DEFAULT 0,
      reminders_sent    INT NOT NULL DEFAULT 0,
      first_reminded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_reminded_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_reminder_pair (user_id, chat_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('  message_reminders table present');

  // One row per pair, so the eligibility query can find "chats I have
  // already nudged, whose nudge is now older than the escalation window"
  // without scanning the whole table.
  if (!(await indexExists('message_reminders', 'uniq_reminder_pair'))) {
    await pool.query(
      'CREATE UNIQUE INDEX uniq_reminder_pair ON message_reminders (user_id, chat_id)'
    );
    console.log('  created uniq_reminder_pair');
  } else {
    console.log('  uniq_reminder_pair already present');
  }

  // Escalation lookup by time rather than by pair.
  if (!(await indexExists('message_reminders', 'idx_reminder_last_sent'))) {
    await pool.query(
      'CREATE INDEX idx_reminder_last_sent ON message_reminders (last_reminded_at)'
    );
    console.log('  created idx_reminder_last_sent');
  } else {
    console.log('  idx_reminder_last_sent already present');
  }

  logger.info('[Migration] 20261107_message_reminders: complete');
}

if (require.main === module) {
  up()
    .then(() => process.exit(0))
    .catch((err) => { console.error('MIGRATION FAILED: ' + (err.code || '') + ' ' + err.message); process.exit(1); });
}

module.exports = up;
