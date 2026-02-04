const express = require('express');
const router = express.Router();
const postController = require('../../controllers/post.controller');
const feedController = require('../../controllers/feed.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

const { validate } = require('../../middleware/validation.middleware');
const { upload } = require('../../middleware/upload.middleware');
const { createPostSchema, addCommentSchema, postIdSchema } = require('../../validators/post.validator');

router.get('/feed', authMiddleware, feedController.getFeedPosts);
router.post('/', authMiddleware, upload.single('media'), validate(createPostSchema), postController.createPost);
router.post('/:id/spark', authMiddleware, validate(postIdSchema, 'params'), postController.sparkPost);
router.post('/:id/save', authMiddleware, validate(postIdSchema, 'params'), postController.savePost);
router.get('/:id/comments', authMiddleware, validate(postIdSchema, 'params'), postController.getComments);
router.post('/:id/comments', authMiddleware, validate(postIdSchema, 'params'), validate(addCommentSchema), postController.addComment);
router.delete('/:id', authMiddleware, validate(postIdSchema, 'params'), postController.deletePost);

module.exports = router;
