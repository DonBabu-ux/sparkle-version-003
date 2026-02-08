const path = require('path');
const express = require('express');
const router = express.Router();
const feedController = require(path.join(__dirname, '..', '..', 'controllers', 'feed.controller');
const { ejsAuthMiddleware } = require(path.join(__dirname, '..', '..', 'middleware', 'auth.middleware');

router.get('/dashboard', ejsAuthMiddleware, feedController.renderDashboard);
router.get('/post/:id', ejsAuthMiddleware, feedController.renderPost);

module.exports = router;

