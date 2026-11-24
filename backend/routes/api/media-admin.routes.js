const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth.middleware');
const { adminMiddleware } = require('../../middleware/admin.middleware');
const { requireAdminSession } = require('../../middleware/adminSession.middleware');
const mediaAdminController = require('../../controllers/media-admin.controller');
const mediaMigration = require('../../services/mediaMigration.service');
const logger = require('../../utils/logger');

// Admin-only media maintenance (stats + Cloudinary cleanup). Elevation
// session required — same second-password gate as the main admin router.
router.get('/stats', authMiddleware, adminMiddleware, requireAdminSession, mediaAdminController.getStorageStats);
router.post('/cleanup', authMiddleware, adminMiddleware, requireAdminSession, mediaAdminController.executeSafeCleanup);

// ── Migration endpoints ──────────────────────────────────────────────────────

// GET /api/admin/media/migration/status — count pending assets
router.get('/migration/status', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const pool = require('../../config/database');
        const [[pending]] = await pool.query(
            `SELECT COUNT(*) as pending FROM media_registry WHERE storage_provider = 'cloudinary' AND migration_status != 'migrated'`
        );
        const [[migrated]] = await pool.query(
            `SELECT COUNT(*) as migrated FROM media_registry WHERE migration_status = 'migrated'`
        );
        const [[total]] = await pool.query(`SELECT COUNT(*) as total FROM media_registry`);
        res.json({ total: total.total, migrated: migrated.migrated, pending: pending.pending });
    } catch (err) {
        logger.error('[MediaAdmin] migration status error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/admin/media/migration/run — trigger a migration batch
// Body: { batchSize: 25, dryRun: false, destructive: false }
router.post('/migration/run', authMiddleware, adminMiddleware, requireAdminSession, async (req, res) => {
    try {
        const { batchSize = 25, dryRun = false, destructive = false } = req.body;
        logger.info(`[MediaAdmin] Migration triggered: batch=${batchSize}, dryRun=${dryRun}, destructive=${destructive}`);
        // Run async — respond immediately with 202
        const runPromise = mediaMigration.runBatch({
            batchSize: Math.min(batchSize, 50), // cap at 50 per API call
            dryRun: Boolean(dryRun),
            allowDestructiveDeletion: Boolean(destructive),
        });
        res.status(202).json({ message: 'Migration batch started', batchSize, dryRun, destructive });
        const result = await runPromise;
        logger.info(`[MediaAdmin] Migration batch complete: ${result.succeeded}/${result.total} succeeded, ${result.failed} failed`);
    } catch (err) {
        logger.error('[MediaAdmin] migration run error:', err.message);
    }
});

module.exports = router;
