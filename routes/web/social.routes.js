const express = require('express');
const router = express.Router();
const socialController = require('../../controllers/social.controller');
const notificationController = require('../../controllers/notification.controller');
const { ejsAuthMiddleware } = require('../../middleware/auth.middleware');

router.get('/connect', ejsAuthMiddleware, socialController.renderConnect);
router.get('/search', ejsAuthMiddleware, socialController.renderSearch);
router.get('/follow-requests', ejsAuthMiddleware, socialController.renderFollowRequests);
router.get('/notifications', ejsAuthMiddleware, notificationController.renderNotifications);

module.exports = router;
