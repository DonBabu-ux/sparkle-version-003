/**
 * Migration: 20261025_add_polls_deleted_at.js
 *
 * Adds `deleted_at` to `polls` so a poll can be taken down without destroying
 * vote records for the people who already voted. The same soft-delete pattern
 * used for moments.
 *
 * Idempotent: only adds the column when absent. Re-running is a no-op.
 *
 * Run:
 *   node migrations/20261025_add_polls_deleted_at.js
 *   node migrations/20261025_add_polls_deleted_at.js --dry-run
 */

require('dotenv').config();
const pool = require('../config/database');
const logger = require('../utils/logger');

const DRY = process.argv.includes('--dry-run');

async function run() {
    const [rows] = await pool.query(
        `SELECT COLUMN_NAME
           FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'polls'
            AND COLUMN_NAME = 'deleted_at'`
    );

    if (rows.length > 0) {
        logger.info('[polls-soft-delete] polls.deleted_at already exists — nothing to do.');
        return;
    }

    logger.info('[polls-soft-delete] polls.deleted_at is missing (mode: ' + (DRY ? 'DRY RUN' : 'APPLY') + ')');

    if (DRY) {
        logger.info('[polls-soft-delete] dry run only — no DDL executed.');
        return;
    }

    await pool.query(
        `ALTER TABLE polls ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER quality_score`
    );
    logger.info('[polls-soft-delete] added polls.deleted_at');

    // Partial index would be ideal but MySQL does not support filtered indexes;
    // a plain index on deleted_at keeps "not deleted" lookups cheap.
    await pool.query(
        `ALTER TABLE polls ADD INDEX idx_polls_deleted_at (deleted_at)`
    );
    logger.info('[polls-soft-delete] added idx_polls_deleted_at');
}

run()
    .then(() => pool.end())
    .catch((err) => {
        logger.error('[polls-soft-delete] migration failed:', err.message);
        process.exitCode = 1;
        pool.end();
    });
