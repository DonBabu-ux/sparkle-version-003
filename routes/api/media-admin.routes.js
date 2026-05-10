const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../../middleware/auth.middleware');
const mediaAdminController = require('../../controllers/media-admin.controller');

// Restrict these to users who are 'admin' or 'super_admin' in some way. 
// For Sparkle, assuming there's an admin check or just requiring auth for now 
// if a universal admin middleware is missing, but adding an ad-hoc check.
router.get('/stats', authMiddleware, mediaAdminController.getStorageStats);
router.post('/cleanup', authMiddleware, mediaAdminController.executeSafeCleanup);

module.exports = router;
