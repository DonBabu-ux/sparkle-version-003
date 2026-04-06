const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth.middleware');
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
router.use(authMiddleware, adminMiddleware);

// Dashboard
router.get('/stats', getDashboardStats);

// User management
router.get('/users', getUsers);
router.post('/users/:userId', updateUser);
router.post('/users/:userId/suspend', suspendUser);

// Content moderation
router.get('/reports', getReportedContent);
router.post('/reports/:reportId/resolve', resolveReport);

// Logs
router.get('/logs', getLogs);
router.get('/logs/export', exportLogs);

module.exports = router;
