// migrations/20261031_story_audience_privacy.js
// AfterGlow story privacy: adds an audience column to stories (mirrors the
// moments audience model) plus a close-friends list table that the
// `close_friends` audience resolves against.
'use strict';

require('dotenv').config();
const pool = require('../config/database');

async function runMigration() {
    console.log('Starting story audience privacy migration...');
    try {
        const addColumn = async (table, columnDef) => {
            try {
                await pool.query(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
                console.log(`  Added column ${columnDef.split(' ')[0]} to ${table}`);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME' || err.message?.includes('Duplicate column')) {
                    // Already applied — safe to ignore.
                } else {
                    console.warn(`  Column check on ${table} (${columnDef.split(' ')[0]}):`, err.message);
                }
            }
        };

        // 'public' | 'followers' | 'close_friends' | 'only_me' — same vocabulary
        // as moments. VARCHAR (not ENUM) so new levels never need another DDL.
        await addColumn('stories', "audience VARCHAR(32) DEFAULT 'public'");

        await pool.query(`
            CREATE TABLE IF NOT EXISTS close_friends (
              id CHAR(36) NOT NULL,
              user_id CHAR(36) NOT NULL,
              friend_id CHAR(36) NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (id),
              UNIQUE KEY unique_close_friend (user_id, friend_id),
              KEY idx_close_friends_owner (user_id),
              CONSTRAINT close_friends_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
              CONSTRAINT close_friends_ibfk_2 FOREIGN KEY (friend_id) REFERENCES users (user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('  close_friends table ready');

        // ── Reconcile a pre-existing reels-shaped close_friends ──────────────
        // Reels used to CREATE close_friends as (user_id, friend_user_id) with
        // no id column, so on installations where reels won the race the table
        // lacks `id`/`friend_id` and every stories close-friends query failed
        // with ER_BAD_FIELD_ERROR. Bring that table onto the canonical stories
        // shape above — non-destructively (rows are backfilled, never dropped)
        // and idempotently (re-running is a no-op).
        await addColumn('close_friends', 'id CHAR(36) DEFAULT NULL');
        await addColumn('close_friends', 'friend_id CHAR(36) DEFAULT NULL');

        // Carry the legacy list contents across before the column is constrained.
        const [legacyCols] = await pool.query(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'close_friends'
                AND COLUMN_NAME = 'friend_user_id'`
        );
        if (legacyCols.length > 0) {
            await pool.query(
                `UPDATE close_friends
                    SET friend_id = friend_user_id
                  WHERE (friend_id IS NULL OR friend_id = '') AND friend_user_id IS NOT NULL`
            );
            console.log('  backfilled close_friends.friend_id from friend_user_id');
        }
        await pool.query(
            `UPDATE close_friends SET id = UUID() WHERE id IS NULL OR id = ''`
        );

        // Align the key layout: PRIMARY KEY (id) + UNIQUE (user_id, friend_id)
        // instead of the reels-era PRIMARY KEY (user_id, friend_user_id).
        const [pkCols] = await pool.query(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.STATISTICS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'close_friends'
                AND INDEX_NAME = 'PRIMARY' ORDER BY SEQ_IN_INDEX`
        );
        const pkIsLegacy = pkCols.length > 0 &&
            pkCols.map(c => c.COLUMN_NAME).join(',') === 'user_id,friend_user_id';
        const [pkIndexes] = await pool.query(
            `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'close_friends'
                AND INDEX_NAME IN ('PRIMARY', 'unique_close_friend', 'idx_close_friends_owner')`
        );
        const haveIndex = new Set((pkIndexes || []).map(r => r.INDEX_NAME));
        try {
            if (pkIsLegacy) {
                await pool.query('ALTER TABLE close_friends DROP PRIMARY KEY');
                console.log('  dropped legacy close_friends primary key');
            }
            if (!haveIndex.has('unique_close_friend')) {
                await pool.query(
                    'ALTER TABLE close_friends ADD UNIQUE KEY unique_close_friend (user_id, friend_id)'
                );
                console.log('  added unique_close_friend (user_id, friend_id)');
            }
            if (!haveIndex.has('idx_close_friends_owner')) {
                await pool.query(
                    'ALTER TABLE close_friends ADD KEY idx_close_friends_owner (user_id)'
                );
                console.log('  added idx_close_friends_owner (user_id)');
            }
            if (!haveIndex.has('PRIMARY') || pkIsLegacy) {
                await pool.query(
                    "ALTER TABLE close_friends MODIFY COLUMN id CHAR(36) NOT NULL, ADD PRIMARY KEY (id)"
                );
                console.log('  close_friends primary key is id');
            }
        } catch (err) {
            if (err.code === 'ER_DUP_KEYNAME' || err.message?.includes('Duplicate key name')) {
                // Index already present — safe to ignore (re-run).
            } else {
                console.warn('  close_friends key alignment:', err.message);
            }
        }

        // Backfill any NULL audience rows (older stories predating the column).
        await pool.query(`UPDATE stories SET audience = 'public' WHERE audience IS NULL`);

        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

runMigration();
