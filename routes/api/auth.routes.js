const express = require('express');
const router = express.Router();
const authController = require('../../controllers/auth.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/logout', authMiddleware, authController.logout);
router.post('/verify-email', authController.verifyEmail);
router.post('/forgot-password', authController.forgotPassword);

module.exports = router;
