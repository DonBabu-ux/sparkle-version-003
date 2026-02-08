const path = require('path');
const express = require('express');
const router = express.Router();
const socialController = require(path.join(__dirname, '..', '..', 'controllers', 'social.controller');
const { ejsAuthMiddleware } = require(path.join(__dirname, '..', '..', 'middleware', 'auth.middleware');

router.get('/connect', ejsAuthMiddleware, socialController.renderConnect);

module.exports = router;

