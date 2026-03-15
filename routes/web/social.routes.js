const express = require('express');
const router = express.Router();
const socialController = require('../../controllers/social.controller');
const { ejsAuthMiddleware } = require('../../middleware/auth.middleware');

router.get('/connect', ejsAuthMiddleware, socialController.renderConnect);
router.get('/follow-requests', ejsAuthMiddleware, socialController.renderFollowRequests);

module.exports = router;
