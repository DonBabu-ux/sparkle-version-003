/**
 * Migration: 20261024_fix_moments_media_url_extension.js
 *
 * Some moment rows hold a media_url whose extension is a transport-stream
 * (.ts) rather than a video container. The moments upload pipeline asks
 * Cloudinary for `fetch_format: 'auto'`, which for some uploads returned a
 * transport-stream URL that was persisted verbatim. Players requesting it
 * get a 0-byte response — "media unavailable".
 *
 * `createMoment` now normalises the extension at write time, so new rows are
 * correct. This migration repairs the existing rows.
 *
 * SAFETY:
 *  - Dry-run by default: prints the affected row count and a sample of the
 *    rewritten URLs, then exits WITHOUT writing. Pass --apply to execute.
 *  - Idempotent: only touches rows whose extension is not already a real
 *    container, so re-running is a no-op.
 *
 * Run (inspect first):
 *   node migrations/20261024_fix_moments_media_url_extension.js
 *
 * Run (apply):
 *   node migrations/20261024_fix_moments_media_url_extension.js --apply
 */

require('dotenv').config();
const pool = require('../config/database');
const logger = require('../utils/logger');

const APPLY = process.argv.includes('--apply');
const CONTAINERS = "\\.(mp4|mov|avi|webm|mkv)$";

async function countAffected() {
    const [rows] = await pool.query(
        `SELECT COUNT(*) AS n
           FROM moments
          WHERE media_type = 'video'
            AND media_url IS NOT NULL
            AND media_url <> ''
            AND media_url NOT REGEXP ?`,
        [CONTAINERS]
    );
    return rows[0]?.n || 0;
}

async function run() {
    logger.info('[moments-ext] === media_url extension repair ' + (APPLY ? '(APPLY)' : '(DRY RUN)') + ' ===');

    const affected = await countAffected();
    logger.info(`[moments-ext] moments needing repair: ${affected}`);

    if (affected === 0) {
        logger.info('[moments-ext] nothing to do �?" every video media_url already ends in a real container.');
        return;
    }

    // Sample BEFORE rewriting so the change can be eyeballed.
    const [sample] = await pool.query(
        `SELECT moment_id, media_url
           FROM moments
          WHERE media_type = 'video'
            AND media_url IS NOT NULL
            AND media_url <> ''
            AND media_url NOT REGEXP ?
          LIMIT 5`,
        [CONTAINERS]
    );

    logger.info('[moments-ext] sample of rows that would change:');
    for (const row of sample) {
        const fixed = String(row.media_url).replace(/\.[^/.]+$/, '.mp4');
        logger.info(`[moments-ext]   ${row.moment_id}`);
        logger.info(`[moments-ext]     FROM: ${row.media_url}`);
        logger.info(`[moments-ext]     TO:   ${fixed}`);
    }

    if (!APPLY) {
        logger.info('[moments-ext] dry run only — no rows written.');
        logger.info('[moments-ext] re-run with --apply once the sample above looks right.');
        return;
    }

    const [result] = await pool.query(
        `UPDATE moments
            SET media_url = CONCAT(SUBSTRING_INDEX(media_url, '.', 1), '.mp4')
          WHERE media_type = 'video'
            AND media_url IS NOT NULL
            AND media_url <> ''
            AND media_url NOT REGEXP ?
            AND SUBSTRING_INDEX(media_url, '.', 1) <> ''`,
        [CONTAINERS]
    );

    logger.info(`[moments-ext] rows updated: ${result.affectedRows}`);

    const remaining = await countAffected();
    logger.info(`[moments-ext] rows still needing repair: ${remaining}`);

    if (remaining > 0) {
        logger.warn('[moments-ext] some rows could not be rewritten automatically — inspect them by hand.');
    }

    logger.info('[moments-ext] done.');
}

run()
    .then(() => pool.end())
    .catch((err) => {
        logger.error('[moments-ext] migration failed:', err.message);
        process.exitCode = 1;
        pool.end();
    });
