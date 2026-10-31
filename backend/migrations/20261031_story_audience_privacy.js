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
