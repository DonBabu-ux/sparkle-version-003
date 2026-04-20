const express = require('express');
const router = express.Router();
const postController = require('../../controllers/post.controller');
const feedController = require('../../controllers/feed.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { feedRateLimiter, mutationRateLimiter } = require('../../middleware/security.middleware');

const { validate } = require('../../middleware/validation.middleware');
const { upload } = require('../../middleware/upload.middleware');
const { createPostSchema, addCommentSchema, postIdSchema } = require('../../validators/post.validator');

router.get('/feed', authMiddleware, feedRateLimiter, feedController.getFeedPosts);
router.get('/liked', authMiddleware, feedRateLimiter, postController.getLikedPosts);
router.get('/saved', authMiddleware, feedRateLimiter, postController.getSavedPosts);
router.get('/:id', authMiddleware, validate(postIdSchema, 'params'), postController.getPost);
router.post('/', authMiddleware, mutationRateLimiter, upload.array('media', 10), validate(createPostSchema), postController.createPost);
router.post('/:id/spark', authMiddleware, mutationRateLimiter, validate(postIdSchema, 'params'), postController.sparkPost);
router.post('/:id/save', authMiddleware, mutationRateLimiter, validate(postIdSchema, 'params'), postController.savePost);
router.get('/:id/comments', authMiddleware, validate(postIdSchema, 'params'), postController.getComments);
router.post('/:id/comments', authMiddleware, mutationRateLimiter, validate(postIdSchema, 'params'), validate(addCommentSchema), postController.addComment);
router.post('/:id/share', authMiddleware, mutationRateLimiter, validate(postIdSchema, 'params'), postController.sharePost);
router.post('/:id/reshare', authMiddleware, mutationRateLimiter, validate(postIdSchema, 'params'), postController.resharePost);
router.patch('/:id/reshare/comment', authMiddleware, mutationRateLimiter, validate(postIdSchema, 'params'), postController.updateReshareComment);
router.get('/:id/translate', authMiddleware, postController.translatePost);
router.delete('/:id', authMiddleware, mutationRateLimiter, validate(postIdSchema, 'params'), postController.deletePost);

module.exports = router;
