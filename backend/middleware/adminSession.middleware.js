const logger = require('../utils/logger');
const AdminCredentialService = require('../services/admin-credential.service');

/**
 * Gate the admin surface behind an elevation session — a short-lived token
 * minted by POST /api/admin/session after verifying the ADMIN password
 * (never the login password). Reads and mutations both require it; the
 * per-mutation step-up stays as an additional confirmation on top.
 */
const requireAdminSession = async (req, res, next) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const token = req.headers[AdminCredentialService.ADMIN_SESSION_HEADER];

        if (!token) {
            return res.status(401).json({
                error: 'Admin access requires your admin password.',
                code: 'ADMIN_SESSION_REQUIRED'
            });
        }

        const sessionUserId = await AdminCredentialService.verifyAdminSession(token);
        if (sessionUserId !== userId) {
            return res.status(401).json({
                error: 'Admin access expired. Enter your admin password again.',
                code: 'ADMIN_SESSION_REQUIRED'
            });
        }

        req.adminSession = { userId: sessionUserId };
        next();
    } catch (error) {
        logger.error('Admin session verification failed:', error);
        res.status(500).json({ error: 'Could not verify admin access. Please try again.' });
    }
};

module.exports = { requireAdminSession };
