const path = require('path');
const express = require('express');
const router = express.Router();
const messagingController = require(path.join(__dirname, '..', '..', 'controllers', 'messaging.controller');
const { ejsAuthMiddleware } = require(path.join(__dirname, '..', '..', 'middleware', 'auth.middleware');

router.get('/messages', ejsAuthMiddleware, messagingController.renderMessages);

module.exports = router;

