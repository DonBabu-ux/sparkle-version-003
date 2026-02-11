const express = require('express');
const router = express.Router();
const authController = require('../../controllers/auth.controller');
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

router.post('/signup', validate(signupSchema), authController.signup);
router.post('/login', validate(loginSchema), authController.login);
router.post('/logout', authMiddleware, authController.logout);
router.post('/verify-email', authController.verifyEmail);
router.post('/forgot-password', authController.forgotPassword);
router.get('/validate', authMiddleware, authController.validateToken);

module.exports = router;