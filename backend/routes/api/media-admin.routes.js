const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth.middleware');
const { adminMiddleware } = require('../../middleware/admin.middleware');
const { requireAdminSession } = require('../../middleware/adminSession.middleware');
const mediaAdminController = require('../../controllers/media-admin.controller');

// Admin-only media maintenance (stats + Cloudinary cleanup). Elevation
// session required — same second-password gate as the main admin router.
router.get('/stats', authMiddleware, adminMiddleware, requireAdminSession, mediaAdminController.getStorageStats);
router.post('/cleanup', authMiddleware, adminMiddleware, requireAdminSession, mediaAdminController.executeSafeCleanup);

module.exports = router;
