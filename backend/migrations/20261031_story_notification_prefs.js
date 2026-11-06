// migrations/20261031_story_notification_prefs.js
// Story notification plumbing close-out:
//   1. users gains three story notification toggles (ON by default), so the
//      createNotification preference gates cover story_like / story_share /
//      story_reply the way notifications_likes covers likes.
//   2. notifications.type ENUM gains 'story_reply' — the story-comment
//      notification addStoryComment now emits (likeStory emits story_like,
//      shareStory emits story_share).
// Idempotent: re-running is a no-op (ER_DUP_FIELDNAME + COLUMN_TYPE probe).
'use strict';

require('dotenv').config();
const pool = require('../config/database');

async function runMigration() {
    console.log('Starting story notification preferences migration...');
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

        // Per-type story toggles, mirroring notifications_likes/comments/
        // follows/messages. TINYINT(1) DEFAULT 1 = ON for everyone.
        await addColumn('users', "notifications_story_likes TINYINT(1) NOT NULL DEFAULT 1");
        await addColumn('users', "notifications_story_shares TINYINT(1) NOT NULL DEFAULT 1");
        await addColumn('users', "notifications_story_replies TINYINT(1) NOT NULL DEFAULT 1");

        // Backfill NULLs in case the columns shipped without a default.
        await pool.query(
            `UPDATE users SET notifications_story_likes = 1
              WHERE notifications_story_likes IS NULL`
        );
        await pool.query(
            `UPDATE users SET notifications_story_shares = 1
              WHERE notifications_story_shares IS NULL`
        );
        await pool.query(
            `UPDATE users SET notifications_story_replies = 1
              WHERE notifications_story_replies IS NULL`
        );

        // Extend notifications.type only when 'story_reply' is missing.
        // CRITICAL: merge into the LIVE enum list — never hardcode a list,
        // or a rewrite silently drops members (this destroyed live
        // event_update/club_update/poll_invite rows once).
        const [typeRows] = await pool.query(
            `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications'
               AND COLUMN_NAME = 'type'`
        );
        const liveType = typeRows.length ? String(typeRows[0].COLUMN_TYPE) : '';
        if (liveType.includes('story_reply')) {
            console.log('  notifications.type already carries story_reply');
        } else {
            const values = (liveType.match(/'([^']*)'/g) || [])
                .map(v => v.slice(1, -1))
                .filter(v => v !== '');
            values.push('story_reply'); // append the new member
            const enumList = values.map(v => `'${v}'`).join(',');
            await pool.query(
                `ALTER TABLE notifications MODIFY COLUMN type
                 ENUM(${enumList})
                 NOT NULL`
            );
            console.log('  notifications.type ENUM extended with story_reply (live members preserved)');
        }

        console.log('Migration completed successfully!');
        return;
    } catch (err) {
        console.error('Migration failed:', err);
        throw err;
    }
}

// Runner-compatible entry point. Exit only when invoked directly
// (`node migrations/20261031_story_notification_prefs.js`). require()-ing this
// file from utils/database/schemaLedger.js must not terminate the booting
// process, which is what the previous bare `runMigration()` + process.exit did.
if (require.main === module) {
    runMigration()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = runMigration;
