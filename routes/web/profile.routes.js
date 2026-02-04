const express = require('express');
const router = express.Router();
const profileController = require('../../controllers/profile.controller');
const { ejsAuthMiddleware } = require('../../middleware/auth.middleware');

router.get('/profile', ejsAuthMiddleware, profileController.renderProfile);
router.get('/profile/:username', ejsAuthMiddleware, profileController.renderProfile);
router.get('/settings', ejsAuthMiddleware, profileController.renderSettings);
router.get('/api/profile/saved', ejsAuthMiddleware, profileController.getSavedPosts);

module.exports = router;
