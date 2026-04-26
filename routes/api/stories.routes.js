const express = require('express');
const router = express.Router();
const feedController = require('../../controllers/feed.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { upload } = require('../../middleware/upload.middleware');

router.get('/active', authMiddleware, feedController.getStories);
router.get('/archive', authMiddleware, feedController.getStoryArchive);
router.post('/', authMiddleware, upload.fields([{ name: 'media', maxCount: 1 }, { name: 'audio', maxCount: 1 }]), feedController.createStory);
// interactions
router.get('/:id/likes', authMiddleware, feedController.getStoryLikes);
router.get('/:id/viewers', authMiddleware, feedController.getStoryViewers);
router.post('/:id/view', authMiddleware, feedController.viewStory);
router.post('/:id/like', authMiddleware, feedController.likeStory);
router.post('/:id/share', authMiddleware, feedController.shareStory);
router.post('/:id/archive', authMiddleware, feedController.archiveStory);
router.post('/:id/comments/toggle', authMiddleware, feedController.toggleStoryComments);
router.post('/privacy/hide', authMiddleware, feedController.hideStoryFromUser);
router.delete('/:id', authMiddleware, feedController.deleteStory);

module.exports = router;
