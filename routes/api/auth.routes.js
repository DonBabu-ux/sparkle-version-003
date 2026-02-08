const path = require('path');
const express = require('express');
const router = express.Router();
const authController = require(path.join(__dirname, '..', '..', 'controllers', 'auth.controller'));
const { authMiddleware } = require(path.join(__dirname, '..', '..', 'middleware', 'auth.middleware');
const { validate } = require(path.join(__dirname, '..', '..', 'middleware', 'validation.middleware');
const { signupSchema, loginSchema } = require('../../validators/auth.validator');

router.post('/signup', validate(signupSchema), authController.signup);
router.post('/login', validate(loginSchema), authController.login);
router.post('/logout', authMiddleware, authController.logout);
router.post('/verify-email', authController.verifyEmail);
router.post('/forgot-password', authController.forgotPassword);

module.exports = router;


