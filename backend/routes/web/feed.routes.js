const express = require('express');
const router = express.Router();
const feedController = require('../../controllers/feed.controller');
const { ejsAuthMiddleware } = require('../../middleware/auth.middleware');

// router.get('/dashboard', ejsAuthMiddleware, feedController.renderDashboard);
router.get('/post/:id', ejsAuthMiddleware, feedController.renderPost);
router.get('/posts/:id', ejsAuthMiddleware, feedController.renderPost); // plural alias

module.exports = router;
