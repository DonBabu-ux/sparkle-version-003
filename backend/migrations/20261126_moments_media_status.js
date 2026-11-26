/**
 * Migration Runner: 20261126_moments_media_status.js
 *
 * Adds moments.media_status so a moment whose media is *confirmed* unavailable
 * can be skipped by every feed/discover/search query instead of served as a
 * dead tile (or hard-deleted two hours later by the media health job).
 *
 * The health job owns the value: 'failing' once a rendition fails its
 * two-strike probe, 'ok' again the moment every probed URL is alive. Rows
 * written before this column existed take the DEFAULT 'ok', so nothing is
 * hidden until it has actually been proven dead.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../config/database');
const logger = require('../utils/logger');

async function runMigration() {
    const [rows] = await pool.query(
        `SELECT COLUMN_NAME
           FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'moments'
            AND COLUMN_NAME = 'media_status'`
    );

    if (rows.length === 0) {
        await pool.query(
            `ALTER TABLE moments
             ADD COLUMN media_status ENUM('ok','failing') NOT NULL DEFAULT 'ok' AFTER media_type`
        );
        logger.info('[moments-media-status] added moments.media_status');
    } else {
        logger.info('[moments-media-status] moments.media_status already present');
    }
}

if (require.main === module) {
    runMigration()
        .then(() => process.exit(0))
        .catch((e) => {
            logger.error('[moments-media-status] migration failed:', e);
            process.exit(1);
        });
}

module.exports = runMigration;