const express = require('express');
const router = express.Router();
const messagingController = require('../../controllers/messaging.controller');
const { ejsAuthMiddleware } = require('../../middleware/auth.middleware');

router.get('/messages', ejsAuthMiddleware, messagingController.renderMessages);

module.exports = router;
