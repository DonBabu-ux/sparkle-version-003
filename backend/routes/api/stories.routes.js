const express = require('express');
const router = express.Router();
const feedController = require('../../controllers/feed.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { upload } = require('../../middleware/upload.middleware');

router.get('/active', authMiddleware, feedController.getStories);
router.get('/single/:id', authMiddleware, feedController.getSingleStory);
router.post('/', authMiddleware, upload.single('media'), feedController.createStory);
// interactions
router.get('/:id/likes', authMiddleware, feedController.getStoryLikes);
router.post('/:id/like', authMiddleware, feedController.likeStory);
router.post('/:id/share', authMiddleware, feedController.shareStory);
router.delete('/:id', authMiddleware, feedController.deleteStory);

module.exports = router;
