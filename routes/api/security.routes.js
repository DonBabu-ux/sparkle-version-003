const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const securityController = require('../../controllers/security.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

// OTP endpoint rate limiter — 5 requests per 5-minute window per IP
const otpRateLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            status: 'error',
            message: 'Too many requests. Please wait a few minutes before trying again.'
        });
    }
});

// General security endpoint rate limiter — 30 requests per minute
const securityRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    handler: (req, res) => {
        res.status(429).json({ status: 'error', message: 'Too many requests. Please slow down.' });
    }
});

// Status & Factors
router.get('/status', authMiddleware, securityRateLimiter, securityController.getSecurityStatus);
router.get('/available-factors', authMiddleware, securityRateLimiter, securityController.getAvailableFactors);

// Security Transactions
router.post('/transaction/initiate', authMiddleware, otpRateLimiter, securityController.initiateSecurityTransaction);
router.post('/transaction/verify', authMiddleware, otpRateLimiter, securityController.verifySecurityTransaction);

// High-Risk Actions (Protected by Verified Transaction Token)
router.post('/2fa/disable', authMiddleware, securityRateLimiter, securityController.disable2FAWithToken);
router.post('/password/change', authMiddleware, securityRateLimiter, securityController.changePasswordWithToken);
router.post('/pin/reset-token', authMiddleware, securityRateLimiter, securityController.generatePinResetToken);

// Alternate Email 2FA
router.post('/2fa/alternate-email/request', authMiddleware, otpRateLimiter, securityController.requestAlternateEmail2FA);
router.post('/2fa/alternate-email/verify', authMiddleware, otpRateLimiter, securityController.verifyAlternateEmail2FA);

// Alerts (Interruptive Cross-Device Security Alerts)
router.get('/alerts/unacknowledged', authMiddleware, securityRateLimiter, securityController.getUnacknowledgedSecurityAlerts);
router.post('/alerts/:eventId/acknowledge', authMiddleware, securityRateLimiter, securityController.acknowledgeSecurityAlert);

// Email 2FA
router.post('/2fa/email/request', authMiddleware, otpRateLimiter, securityController.requestEmail2FA);
router.post('/2fa/email/verify', authMiddleware, otpRateLimiter, securityController.verifyEmail2FA);
router.post('/2fa/email/disable', authMiddleware, securityRateLimiter, securityController.disableEmail2FA);

// SMS 2FA
router.post('/2fa/sms/request', authMiddleware, otpRateLimiter, securityController.requestSMS2FA);
router.post('/2fa/sms/verify', authMiddleware, otpRateLimiter, securityController.verifySMS2FA);
router.post('/2fa/sms/disable', authMiddleware, securityRateLimiter, securityController.disableSMS2FA);

// Disable All 2FA
router.post('/2fa/disable-all', authMiddleware, securityRateLimiter, securityController.disableAll2FA);

// Recovery Codes
router.post('/recovery-codes/generate', authMiddleware, securityRateLimiter, securityController.generateRecoveryCodes);

module.exports = router;
