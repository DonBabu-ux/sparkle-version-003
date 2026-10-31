const cron = require('node-cron');
const pool = require('../config/database');
const cloudinary = require('cloudinary').v2;
const MediaService = require('../services/media.service');

/**
 * Delete Residue Cleanup Job
 *
 * Hourly sweep for rows and Cloudinary bytes that outlive their owners.
 * Everything here is idempotent and individually error-guarded: one
 * failing sweep never stops the others and never throws out of the cron
 * callback (the process-wide uncaughtException hook would kill the
 * server).
 *
 * Residue covered:
 *  1. saved_posts rows whose post is gone (table has no FK on post_id)
 *  2. notifications whose related post/story row is gone (soft links)
 *  3. media_registry 'post' assets with no live referencing row — legacy
 *     media lost before immediate delete-time cleanup existed
 *  4. media_registry 'story' assets with no live referencing story row —
 *     story expiry used to land on 'reusable' and never reclaimed bytes
 */

// Rows processed per sweep per run — bounded so a large backlog cannot
// hold a DB connection for long.
const SWEEP_BATCH = 500;
const REGISTRY_BATCH = 200;
const DELETE_CHUNK = 100;

// Public ids destroyed during a single helper invocation — sibling
// registry rows for the same asset must not issue a second destroy.
const destroyRegistryRows = async (rows) => {
    let destroyed = 0;
    if (!rows || rows.length === 0) return destroyed;

    const candidateIds = rows.map((r) => r.media_id).filter(Boolean);
    const donePublicIds = new Set();

    for (const row of rows) {
        const publicId = row.cloudinary_public_id;
        if (!publicId) continue;

        try {
            if (donePublicIds.has(publicId)) continue;

            // Referenced by any live content row, or by another registry
            // row we are NOT dropping right now? Then the asset stays.
            const referenced = await MediaService.isMediaUrlReferenced(publicId, candidateIds);
            if (referenced) continue;

            // Synthetic import markers ('url_import_...') never had bytes
            // in Cloudinary — only the registry row needs dropping.
            if (!publicId.startsWith('url_import_')) {
                const ref = MediaService.extractCloudinaryRef(row.secure_url);
                const resourceType = ref ? ref.resourceType : 'image';

                let res = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
                // 'not found' as an image means it was a video asset
                // (registry rows do not store the resource type).
                if (res && res.result === 'not found' && resourceType === 'image') {
                    res = await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
                }
            }

            await pool.query('DELETE FROM media_registry WHERE media_id = ?', [row.media_id]);
            donePublicIds.add(publicId);
            destroyed++;
        } catch (err) {
            console.error(`[Residue Job Error] Failed to reclaim ${publicId}:`, err.message);
        }
    }

    return destroyed;
};

// 1. saved_posts whose post row no longer exists (no FK cascade there)
const sweepOrphanSavedPosts = async () => {
    try {
        const [orphans] = await pool.query(
            `SELECT sp.id FROM saved_posts sp
             WHERE NOT EXISTS (SELECT 1 FROM posts p WHERE p.post_id = sp.post_id)
             LIMIT ?`,
            [SWEEP_BATCH]
        );
        if (orphans.length === 0) return;

        const ids = orphans.map((r) => r.id);
        for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
            const chunk = ids.slice(i, i + DELETE_CHUNK);
            const [del] = await pool.query('DELETE FROM saved_posts WHERE id IN (?)', [chunk]);
            if (del.affectedRows > 0) {
                console.log(`[Residue Job] Removed ${del.affectedRows} orphan saved_posts rows.`);
            }
        }
    } catch (e) {
        console.error('[Residue Job Error] sweepOrphanSavedPosts:', e.message);
    }
};

// 2. notifications whose related post/story row is gone (soft links, no FK).
// Rows with NULL related_id are left alone — without a target id there is
// no way to prove the notification is orphaned.
const sweepOrphanNotifications = async () => {
    try {
        const [orphans] = await pool.query(
            `SELECT notification_id FROM notifications
             WHERE related_id IS NOT NULL
             AND (
                 (related_type = 'post' AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.post_id = notifications.related_id))
                 OR (related_type = 'story' AND NOT EXISTS (SELECT 1 FROM stories s WHERE s.story_id = notifications.related_id))
             )
             LIMIT ?`,
            [SWEEP_BATCH]
        );
        if (orphans.length === 0) return;

        const ids = orphans.map((r) => r.notification_id);
        for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
            const chunk = ids.slice(i, i + DELETE_CHUNK);
            const [del] = await pool.query('DELETE FROM notifications WHERE notification_id IN (?)', [chunk]);
            if (del.affectedRows > 0) {
                console.log(`[Residue Job] Removed ${del.affectedRows} orphan notifications.`);
            }
        }
    } catch (e) {
        console.error('[Residue Job Error] sweepOrphanNotifications:', e.message);
    }
};

// 3. Post media registry rows with no live referencing post/post_media
//    row — catches legacy post media that leaked before delete-time
//    cleanup existed.
const sweepOrphanPostRegistry = async () => {
    try {
        const [rows] = await pool.query(
            `SELECT media_id, cloudinary_public_id, secure_url
             FROM media_registry WHERE category = 'post' LIMIT ?`,
            [REGISTRY_BATCH]
        );
        const destroyed = await destroyRegistryRows(rows);
        if (destroyed > 0) {
            console.log(`[Residue Job] Reclaimed ${destroyed} orphan post media assets.`);
        }
    } catch (e) {
        console.error('[Residue Job Error] sweepOrphanPostRegistry:', e.message);
    }
};

// 4. Story media registry rows with no live referencing story row.
//    Story expiry used to land on lifecycle_state 'reusable' (never
//    'pending_cleanup') and the purge job never destroyed bytes, so
//    purged/expired story media leaked forever. Once the story row is
//    gone, nothing here references the asset and the bytes are safe to
//    reclaim.
const sweepExpiredStoryMedia = async () => {
    try {
        const [rows] = await pool.query(
            `SELECT media_id, cloudinary_public_id, secure_url
             FROM media_registry WHERE category = 'story' LIMIT ?`,
            [REGISTRY_BATCH]
        );
        const destroyed = await destroyRegistryRows(rows);
        if (destroyed > 0) {
            console.log(`[Residue Job] Reclaimed ${destroyed} orphan story media assets.`);
        }
    } catch (e) {
        console.error('[Residue Job Error] sweepExpiredStoryMedia:', e.message);
    }
};

// Initialize Cron Job
const initResidueCleanupJobs = () => {
    // Run every hour at minute 0, alongside the media lifecycle engine
    cron.schedule('0 * * * *', async () => {
        console.log('--- Running Delete Residue Cleanup Engine ---');
        await sweepOrphanSavedPosts();
        await sweepOrphanNotifications();
        await sweepOrphanPostRegistry();
        await sweepExpiredStoryMedia();
    });
    console.log('✅ Delete Residue Cleanup Jobs Initialized.');
};

module.exports = {
    initResidueCleanupJobs,
    sweepOrphanSavedPosts,
    sweepOrphanNotifications,
    sweepOrphanPostRegistry,
    sweepExpiredStoryMedia
};
