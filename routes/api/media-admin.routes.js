const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth.middleware');
const { adminMiddleware } = require('../../middleware/admin.middleware');
const mediaAdminController = require('../../controllers/media-admin.controller');

// Admin-only media maintenance (stats + Cloudinary cleanup)
router.get('/stats', authMiddleware, adminMiddleware, mediaAdminController.getStorageStats);
router.post('/cleanup', authMiddleware, adminMiddleware, mediaAdminController.executeSafeCleanup);

module.exports = router;
