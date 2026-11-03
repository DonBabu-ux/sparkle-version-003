/**
 * Migration: 20261103_backfill_moment_media_type.js
 *
 * Some moment rows carry an empty media_type. `createMoment` derives the
 * value from the uploaded mimetype and falls back to sniffing the URL, so
 * this should not be reachable from the composer — these came from a write
 * path that left the column unset.
 *
 * The consequence is visible: any consumer that branches on
 * `media_type === 'video'` without an extension fallback renders an <img>
 * for an .mp4, which can never load and shows up as a broken media tile.
 * MomentStudio does exactly that, so those rows appear as "media
 * unavailable" in the creator's own list while the same moments play
 * normally in the feed (the feed player has an extension fallback).
 *
 * This derives media_type from the row's own media_url and streaming_url.
 * Idempotent: after it runs there is nothing left to match.
 */
require('dotenv').config();
const pool = require('../config/database');
const logger = require('../utils/logger');

// Anything that marks a row as video: a container extension, Cloudinary's
// /video/upload/ path segment, or the presence of an HLS rendition.
const VIDEO_URL_RE = '\\.(mp4|mov|avi|webm|mkv|m3u8)$';

async function backfill() {
  const [before] = await pool.query(
    "SELECT COUNT(*) AS n FROM moments WHERE media_type IS NULL OR media_type = ''"
  );
  console.log('moments with empty media_type: ' + before[0].n);

  if (before[0].n === 0) {
    console.log('nothing to do');
    return;
  }

  const [result] = await pool.query(
    `UPDATE moments
        SET media_type = CASE
          WHEN media_url REGEXP ?
            OR media_url LIKE '%/video/upload/%'
            OR media_url LIKE '%/video/%'
            OR (streaming_url IS NOT NULL AND streaming_url <> '')
            THEN 'video'
          ELSE 'image'
        END
      WHERE (media_type IS NULL OR media_type = '')
        AND media_url IS NOT NULL
        AND media_url <> ''`,
    [VIDEO_URL_RE]
  );
  console.log('rows updated: ' + (result.affectedRows || 0));

  // Rows with no media_url at all could not be classified — report rather
  // than guess, since inventing a type would be worse than leaving it null.
  const [leftover] = await pool.query(
    `SELECT moment_id, media_url FROM moments
      WHERE (media_type IS NULL OR media_type = '')
        AND (media_url IS NULL OR media_url = '')
      LIMIT 10`
  );
  if (leftover.length) {
    console.log('still unclassified (no media_url — leaving null):');
    leftover.forEach((r) => console.log('  ' + r.moment_id + '  media_url=' + r.media_url));
    logger.warn('[Migration:backfillMediaType] ' + leftover.length + ' row(s) have no media_url and were left null');
  }

  const [after] = await pool.query(
    "SELECT COUNT(*) AS n FROM moments WHERE media_type IS NULL OR media_type = ''"
  );
  console.log('moments with empty media_type now: ' + after[0].n);
}

if (require.main === module) {
  backfill()
    .then(() => process.exit(0))
    .catch((err) => { console.error('FAILED: ' + (err.code || '') + ' ' + err.message); process.exit(1); });
}

module.exports = backfill;
