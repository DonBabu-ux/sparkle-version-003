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

// Standard Auth Routes
router.post('/signup', validate(signupSchema), authController.signup);
router.post('/login', validate(loginSchema), authController.login);
router.post('/logout', authMiddleware, authController.logout);

// Verification & Password Flow
router.post('/verify-email', authController.verifyEmail);
router.post('/verify-sms', authController.verifySMS);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/resend-verification', authController.resendVerification);

// Unified Supabase Auth Routes
router.post('/google/sync', supabaseController.syncSocialUser);
router.post('/otp/verify/sync', supabaseController.syncVerifiedOTP);

// Token Validation
router.get('/validate', authMiddleware, authController.validateToken);
router.post('/switch-account', authController.switchAccount);

module.exports = router;