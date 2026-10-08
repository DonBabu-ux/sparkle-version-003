/**
 * Migration: 20261006_add_performance_indexes.js
 *
 * Adds targeted indexes to eliminate the slow queries surfaced in logs:
 *
 *  1. users – login lookup (email OR username_normalized OR username)
 *     → separate index on email and username_normalized
 *
 *  2. delivery_queue – worker JOIN to messages table
 *     → index on message_id for the JOIN loop
 *
 *  3. security_events – unacknowledged alerts poll (every ~60s per session)
 *     → composite index on (user_id, is_interruptive, acknowledged_at, created_at)
 *
 *  4. otp_verifications – rate-limit check on every auth/resend call
 *     → composite index on (user_id, channel, created_at)
 *
 * Run: node migrations/20261006_add_performance_indexes.js
 */

require('dotenv').config();
const pool = require('../config/database');
const logger = require('../utils/logger');

async function addIndexIfMissing(table, indexName, definition) {
    const [rows] = await pool.query(
        `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = ?
           AND INDEX_NAME   = ?
         LIMIT 1`,
        [table, indexName]
    );
    if (rows.length > 0) {
        logger.info(`[perf-idx] ✓ ${table}.${indexName} already exists – skipping`);
        return;
    }
    logger.info(`[perf-idx] + Adding ${table}.${indexName} ...`);
    await pool.query(`ALTER TABLE \`${table}\` ADD INDEX \`${indexName}\` ${definition}`);
    logger.info(`[perf-idx] ✓ ${table}.${indexName} created`);
}

async function run() {
    logger.info('[perf-idx] === Performance index migration starting ===');

    // ── 1. users table ───────────────────────────────────────────────────────
    // email has a UNIQUE constraint (auto-indexed by MySQL) but an explicit
    // named index helps the query planner pick it over a full-table scan.
    // username_normalized has NO index at all — login does a full scan for it.
    await addIndexIfMissing('users', 'idx_users_email',
        '(`email`)');
    await addIndexIfMissing('users', 'idx_users_username_normalized',
        '(`username_normalized`)');

    // ── 2. delivery_queue ────────────────────────────────────────────────────
    // Worker poll: WHERE next_retry_at <= NOW() (index already exists).
    // The JOIN to messages uses message_id on the queue side — add it.
    await addIndexIfMissing('delivery_queue', 'idx_dq_message_id',
        '(`message_id`)');

    // ── 3. security_events ───────────────────────────────────────────────────
    // Query: WHERE user_id=? AND is_interruptive=1 AND acknowledged_at IS NULL
    //        ORDER BY created_at DESC LIMIT 5
    await addIndexIfMissing('security_events', 'idx_se_user_interruptive_ack',
        '(`user_id`, `is_interruptive`, `acknowledged_at`, `created_at`)');

    // ── 4. otp_verifications ─────────────────────────────────────────────────
    // Query: WHERE user_id=? AND channel=? ORDER BY created_at DESC LIMIT 1
    await addIndexIfMissing('otp_verifications', 'idx_otp_user_channel_created',
        '(`user_id`, `channel`, `created_at`)');

    logger.info('[perf-idx] === Migration complete ===');
    await pool.end();
}

run().catch((err) => {
    logger.error('[perf-idx] Migration failed:', err.message || err);
    process.exit(1);
});
