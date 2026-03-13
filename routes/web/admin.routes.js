const express = require('express');
const router = express.Router();
const { ejsAuthMiddleware } = require('../../middleware/auth.middleware');
const { adminMiddleware } = require('../../middleware/admin.middleware');
const {
    getDashboardStats,
    getUsers,
    updateUser,
    getReportedContent,
    resolveReport,
    getLogs,
    exportLogs,
    suspendUser
} = require('../../controllers/admin.controller');

// All admin routes require authentication and admin privileges
router.use(ejsAuthMiddleware);
router.use(adminMiddleware);

// Dashboard
router.get('/admin', getDashboardStats);

// User management
router.get('/admin/users', getUsers);
router.post('/admin/users/:userId', updateUser);

// Content moderation
router.get('/admin/reports', getReportedContent);
router.post('/admin/reports/:reportId/resolve', resolveReport);

// Logs
router.get('/admin/logs', getLogs);
router.get('/admin/logs/export', exportLogs);

// Additional admin actions
router.post('/admin/users/:userId/suspend', suspendUser);

module.exports = router;
