const express = require('express');
const router = express.Router();
const feedController = require('../../controllers/feed.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { upload } = require('../../middleware/upload.middleware');

router.get('/active', authMiddleware, feedController.getStories);
router.post('/', authMiddleware, upload.single('media'), feedController.createStory);

module.exports = router;
