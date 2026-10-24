const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const pool = require('../../config/database');
const logger = require('../../utils/logger');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { adminMiddleware } = require('../../middleware/admin.middleware');
const adminController = require('../../controllers/admin.controller');
const { requireAdminStepUp } = require('../../middleware/adminStepUp.middleware');

// All admin API routes require authentication + admin/moderator role
router.use(authMiddleware, adminMiddleware);

const adminRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 90,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({ error: 'Too many admin requests. Please slow down.' });
    }
});

router.use(adminRateLimiter);

// Audit every admin API access, including reads.
router.use((req, res, next) => {
    const adminId = req.user.userId || req.user.user_id;
    res.on('finish', () => {
        pool.query(
            `INSERT INTO admin_logs (log_id, admin_id, action, target_type, target_id, details, created_at)
             VALUES (?, ?, 'admin_access', 'route', NULL, ?, NOW())`,
            [crypto.randomUUID(), adminId, JSON.stringify({
                method: req.method,
                path: req.originalUrl,
                status: res.statusCode
            })]
        ).catch((e) => logger.warn('Failed to audit admin access:', e.message));
    });
    next();
});

router.get('/stats', adminController.getDashboardStats);
router.get('/users', adminController.getUsers);
router.get('/reports', adminController.getReportedContent);
router.get('/logs', adminController.getLogs);
router.post('/actions', requireAdminStepUp, adminController.handleAction);
router.post('/announcements', requireAdminStepUp, adminController.broadcastAnnouncement);

module.exports = router;
