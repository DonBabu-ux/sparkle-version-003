const path = require('path');
const express = require('express');
const router = express.Router();
const profileController = require(path.join(__dirname, '..', '..', 'controllers', 'profile.controller');
const { ejsAuthMiddleware } = require(path.join(__dirname, '..', '..', 'middleware', 'auth.middleware');

router.get('/profile', ejsAuthMiddleware, profileController.renderProfile);
router.get('/profile/:username', ejsAuthMiddleware, profileController.renderProfile);
router.get('/settings', ejsAuthMiddleware, profileController.renderSettings);
router.get('/api/profile/saved', ejsAuthMiddleware, profileController.getSavedPosts);

module.exports = router;

