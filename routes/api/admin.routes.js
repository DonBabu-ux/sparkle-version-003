const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth.middleware');
const { adminMiddleware } = require('../../middleware/admin.middleware');
const adminController = require('../../controllers/admin.controller');

// All admin API routes require authentication + admin/moderator role
router.use(authMiddleware, adminMiddleware);

router.get('/stats', adminController.getDashboardStats);
router.get('/users', adminController.getUsers);
router.get('/reports', adminController.getReportedContent);
router.get('/logs', adminController.getLogs);
router.post('/actions', adminController.handleAction);
router.post('/announcements', adminController.broadcastAnnouncement);

module.exports = router;
