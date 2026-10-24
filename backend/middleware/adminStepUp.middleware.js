const crypto = require('crypto');
const pool = require('../config/database');
const logger = require('../utils/logger');

/**
 * Require a verified, single-use security transaction for sensitive admin
 * mutations. The token is issued by the existing server-verified security
 * transaction flow with purpose `admin_step_up`.
 */
const requireAdminStepUp = async (req, res, next) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const token = req.body?.verification_token || req.headers['x-verification-token'];

        if (!token || typeof token !== 'string') {
            return res.status(401).json({
                error: 'This action needs a fresh identity check.',
                code: 'STEP_UP_REQUIRED'
            });
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const [rows] = await pool.query(
            `SELECT transaction_id
             FROM security_transactions
             WHERE verification_token = ? AND user_id = ? AND status = 'verified'
               AND purpose = 'admin_step_up' AND token_expires_at > NOW()
             LIMIT 1`,
            [tokenHash, userId]
        );

        if (!rows.length) {
            return res.status(401).json({
                error: 'Your identity check expired or was already used.',
                code: 'STEP_UP_REQUIRED'
            });
        }

        const [result] = await pool.query(
            "UPDATE security_transactions SET status = 'consumed', consumed_at = NOW() WHERE transaction_id = ? AND status = 'verified'",
            [rows[0].transaction_id]
        );
        if (result.affectedRows !== 1) {
            return res.status(401).json({
                error: 'Your identity check expired or was already used.',
                code: 'STEP_UP_REQUIRED'
            });
        }

        req.adminStepUp = { transactionId: rows[0].transaction_id };
        next();
    } catch (error) {
        logger.error('Admin step-up verification failed:', error);
        res.status(500).json({ error: 'Could not verify this action. Please try again.' });
    }
};

module.exports = { requireAdminStepUp };
