const path = require('path');
const express = require('express');
const router = express.Router();
const feedController = require(path.join(__dirname, '..', '..', 'controllers', 'feed.controller');
const { authMiddleware } = require(path.join(__dirname, '..', '..', 'middleware', 'auth.middleware');
const { upload } = require(path.join(__dirname, '..', '..', 'middleware', 'upload.middleware');

router.get('/active', authMiddleware, feedController.getStories);
router.post('/', authMiddleware, upload.single('media'), feedController.createStory);

module.exports = router;

