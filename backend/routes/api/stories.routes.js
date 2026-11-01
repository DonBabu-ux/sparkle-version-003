const express = require('express');
const router = express.Router();
const feedController = require('../../controllers/feed.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { upload, storiesUpload } = require('../../middleware/upload.middleware');
const { mutationRateLimiter } = require('../../middleware/security.middleware');

// Canonical archive route: the { success, stories } envelope the archive modal
// parses (feed.controller.getStoryArchive). /highlights/archive stays mounted
// for compat but returns its own shape — new clients should use this one.
router.get('/archive', authMiddleware, feedController.getStoryArchive);
router.get('/active', authMiddleware, feedController.getStories);
router.get('/single/:id', authMiddleware, feedController.getSingleStory);
router.post('/', authMiddleware, storiesUpload.fields([{ name: 'media', maxCount: 1 }, { name: 'audio', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), feedController.createStory);
// interactions
router.get('/:id/likes', authMiddleware, feedController.getStoryLikes);
router.get('/:id/viewers', authMiddleware, feedController.getStoryViewers);
router.post('/:id/view', authMiddleware, mutationRateLimiter, feedController.viewStory);
router.post('/:id/like', authMiddleware, mutationRateLimiter, feedController.likeStory);
router.post('/:id/share', authMiddleware, mutationRateLimiter, feedController.shareStory);
router.post('/:id/archive', authMiddleware, mutationRateLimiter, feedController.archiveStory);
router.post('/:id/comments/toggle', authMiddleware, mutationRateLimiter, feedController.toggleStoryComments);
router.post('/:id/comments', authMiddleware, mutationRateLimiter, feedController.addStoryComment);
router.get('/:id/comments', authMiddleware, feedController.getStoryComments);
router.patch('/:id/settings', authMiddleware, mutationRateLimiter, feedController.updateStorySettings);
// Story privacy: hide-from-user + the unhide/list pair. Declared above '/:id'
// so the literal 'privacy' path is never captured as a story id.
router.get('/privacy/hidden', authMiddleware, feedController.getHiddenStoryUsers);
router.post('/privacy/hide', authMiddleware, mutationRateLimiter, feedController.hideStoryFromUser);
router.delete('/privacy/hidden/:userId', authMiddleware, feedController.unhideStoryFromUser);
router.delete('/:id', authMiddleware, mutationRateLimiter, feedController.deleteStory);

module.exports = router;
