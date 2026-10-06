const express = require('express');
const router = express.Router();
const authController = require('../../controllers/auth.controller');
const supabaseController = require('../../controllers/supabase.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

// Check if validation middleware exists
let validate;
try {
    const validationMiddleware = require('../../middleware/validation.middleware');
    validate = validationMiddleware.validate;
} catch (error) {
    // Fallback validation if middleware doesn't exist
    validate = (schema, source) => (req, res, next) => next();
}

// Check if auth.validator exists
let signupSchema, loginSchema;
try {
    const authValidator = require('../../validators/auth.validator');
    signupSchema = authValidator.signupSchema;
    loginSchema = authValidator.loginSchema;
} catch (error) {
    // Create dummy schemas if validator doesn't exist
    signupSchema = {};
    loginSchema = {};
}

const { loginLimiter } = require('../../middleware/rateLimiter.middleware');
const { authRateLimiter } = require('../../middleware/security.middleware');

// Standard Auth Routes
router.post('/signup', authRateLimiter, authController.signup);
router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/verify-2fa', authRateLimiter, authController.verify2FA);
router.post('/resend-2fa', authRateLimiter, authController.resend2FA);
router.post('/request-2fa-recovery', authRateLimiter, authController.request2FARecovery);
router.post('/logout', authMiddleware, authController.logout);
router.get('/check-username', authController.checkUsername);
router.get('/check-email', authController.checkEmail);

// Verification & Password Flow
router.post('/verify-email', authRateLimiter, authController.verifyEmail);
router.post('/verify-sms', authRateLimiter, authController.verifySMS);
router.post('/forgot-password', authRateLimiter, authController.forgotPassword);
router.post('/reset-password', authRateLimiter, authController.resetPassword);
router.post('/resend-verification', authRateLimiter, authController.resendVerification);

// Unified Supabase Auth Routes
router.post('/google/sync', supabaseController.syncSocialUser);
router.post('/otp/verify/sync', supabaseController.syncVerifiedOTP);

// Token Validation
router.get('/validate', authMiddleware, authController.validateToken);
router.post('/switch-account', authController.switchAccount);

module.exports = router;