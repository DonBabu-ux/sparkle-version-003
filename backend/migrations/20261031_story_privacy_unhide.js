// migrations/20261031_story_privacy_unhide.js
// Story privacy + quiz answering schema work:
//   1. sticker_quiz_answers — one row per (sticker, user), mirroring
//      sticker_poll_votes' shape so POST /api/stickers/quiz/answer can record
//      a viewer's chosen option and let them change it (unique key upsert).
//      This is what makes the quiz sticker interactive instead of read-only.
//   2. story_privacy_blocks ALREADY carries (user_id, blocked_user_id), so the
//      new GET /stories/privacy/hidden + DELETE /stories/privacy/hidden/:userId
//      endpoints need NO table change — this migration deliberately adds none.
// Idempotent: CREATE TABLE IF NOT EXISTS + a guarded index probe, so re-running
// is a no-op.
'use strict';

require('dotenv').config();
const pool = require('../config/database');

async function runMigration() {
    console.log('Starting story privacy unhide migration...');
    try {
        // A quiz answer is exactly a poll vote on a quiz sticker — reuse the
        // proven shape (single row per user, FK cascade off both parents).
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sticker_quiz_answers (
                answer_id CHAR(36) PRIMARY KEY,
                sticker_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                option_index TINYINT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sticker_id) REFERENCES story_stickers(sticker_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                UNIQUE KEY unique_sticker_quiz_answer (sticker_id, user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('  sticker_quiz_answers ready');

        // story_privacy_blocks: no change needed for unhide/list. Verify it
        // exists so a fresh environment is surfaced loudly rather than
        // silently 500ing on the privacy endpoints.
        const [blockTables] = await pool.query(
            `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'story_privacy_blocks'`
        );
        if (blockTables.length) {
            console.log('  story_privacy_blocks present — unhide/list need no schema change');
        } else {
            console.warn('  story_privacy_blocks missing — run 20261031_story_audience_privacy first');
        }

        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

runMigration();
