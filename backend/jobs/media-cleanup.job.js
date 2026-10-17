const cron = require('node-cron');
const pool = require('../config/database');
const cloudinary = require('cloudinary').v2;

/**
 * Media Storage Lifecycle Job
 * This job runs hourly to intelligently manage media states in the MediaRegistry.
 */

// 1. Expire stories
const expireStories = async () => {
    try {
        console.log('[Media Job] Checking for expired stories...');
        // Find stories past their public expiration but keep them if they are reusable
        const [result] = await pool.query(
            `UPDATE media_registry 
             SET lifecycle_state = CASE 
                WHEN is_reusable = TRUE THEN 'reusable'
                ELSE 'pending_cleanup'
             END
             WHERE category = 'story' 
             AND lifecycle_state IN ('active', 'expiring_soon')
             AND expires_at < NOW()`
        );
        if (result.affectedRows > 0) {
            console.log(`[Media Job] Transitioned ${result.affectedRows} stories to expired/reusable state.`);
        }
    } catch (e) {
        console.error('[Media Job Error] expireStories:', e.message);
    }
};

// 1b. Purge expired story ROWS from the database.
// Stories are publicly invisible after 24h (read-time filter), but nothing
// ever deleted the rows, so the table and its children grew without bound.
// A 7-day grace keeps the Archive modal useful right after expiry; after
// that the rows are removed unless they are kept alive by:
//   - a highlight (user-curated, must outlive the 24h window)
//   - a story-reply DM (message thread context)
//   - save_to_archive = 1 (explicit user opt-in)
// Children (likes/views/shares/reactions/stickers) cascade via FK.
// story_comments has no FK and must be deleted manually.
const purgeExpiredStories = async () => {
    try {
        const [expired] = await pool.query(
            `SELECT s.story_id FROM stories s
             WHERE s.created_at < NOW() - INTERVAL 7 DAY
             AND COALESCE(s.save_to_archive, 0) = 0
             AND NOT EXISTS (SELECT 1 FROM highlight_stories hs WHERE hs.story_id = s.story_id)
             AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.story_id = s.story_id)
             LIMIT 500`
        );
        if (expired.length === 0) return;

        const ids = expired.map(r => r.story_id);
        // Chunk to keep the IN() list and packet size sane on large sweeps
        for (let i = 0; i < ids.length; i += 100) {
            const chunk = ids.slice(i, i + 100);
            await pool.query(`DELETE FROM story_comments WHERE story_id IN (?)`, [chunk]);
            const [del] = await pool.query(`DELETE FROM stories WHERE story_id IN (?)`, [chunk]);
            if (del.affectedRows > 0) {
                console.log(`[Media Job] Purged ${del.affectedRows} expired stories (chunk).`);
            }
        }
    } catch (e) {
        console.error('[Media Job Error] purgeExpiredStories:', e.message);
    }
};

// 2. Physical Cleanup
const executeCleanup = async () => {
    try {
        console.log('[Media Job] Executing physical cleanup for pending_cleanup assets...');
        const [rows] = await pool.query(
            `SELECT media_id, cloudinary_public_id FROM media_registry 
             WHERE lifecycle_state = 'pending_cleanup' AND cleanup_priority = 'SAFE_TO_DELETE' LIMIT 50`
        );
        
        for (const row of rows) {
            try {
                // Delete from Cloudinary
                if (!row.cloudinary_public_id.startsWith('url_import_')) {
                    await cloudinary.uploader.destroy(row.cloudinary_public_id);
                }
                
                // Delete from registry
                await pool.query(`DELETE FROM media_registry WHERE media_id = ?`, [row.media_id]);
                console.log(`[Media Job] Cleaned up media: ${row.media_id}`);
            } catch (err) {
                console.error(`[Media Job Error] Failed to delete ${row.media_id}:`, err.message);
            }
        }
    } catch (e) {
        console.error('[Media Job Error] executeCleanup:', e.message);
    }
};

// Initialize Cron Job
const initMediaJobs = () => {
    // Run every hour at minute 0
    cron.schedule('0 * * * *', async () => {
        console.log('--- Running Media Lifecycle Engine ---');
        await expireStories();
        await executeCleanup();
        await purgeExpiredStories();
    });
    console.log('✅ Media Lifecycle Jobs Initialized.');
};

module.exports = { initMediaJobs, purgeExpiredStories };
