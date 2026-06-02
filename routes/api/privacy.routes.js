const express = require('express');
const router = express.Router();
const permissionController = require('../../controllers/permission.controller');

// Get privacy settings for a chat for the authenticated user
router.get('/:chatId/privacy', permissionController.getPrivacySettings);

// Update privacy settings
router.patch('/:chatId/privacy', permissionController.updatePrivacySettings);

// Record a capture attempt (e.g., screenshot)
router.post('/:chatId/capture-attempt', permissionController.recordCaptureAttempt);

module.exports = router;
