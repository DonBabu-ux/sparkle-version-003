const path = require('path');
const express = require('express');
const router = express.Router();
const userController = require(path.join(__dirname, '..', '..', 'controllers', 'user.controller');
const { authMiddleware } = require(path.join(__dirname, '..', '..', 'middleware', 'auth.middleware');

const { validate } = require(path.join(__dirname, '..', '..', 'middleware', 'validation.middleware');
const { upload } = require(path.join(__dirname, '..', '..', 'middleware', 'upload.middleware');
const { searchSchema, updateProfileSchema, updatePasswordSchema, userIdSchema } = require('../../validators/user.validator');

router.get('/me', authMiddleware, userController.getCurrentUser);
router.get('/search', authMiddleware, validate(searchSchema, 'query'), userController.searchUsers);
router.get('/friends/search', authMiddleware, userController.searchFollowingUsers); // For messaging restricted to following
router.put('/profile', authMiddleware, validate(updateProfileSchema), userController.updateProfile);
router.post('/avatar', authMiddleware, upload.single('avatar'), userController.uploadAvatar);
router.put('/password', authMiddleware, validate(updatePasswordSchema), userController.updatePassword);
router.delete('/me', authMiddleware, userController.deleteAccount);

// Social & Profile Routes
router.get('/:id', authMiddleware, validate(userIdSchema, 'params'), userController.getUserProfile);
router.get('/:id/posts', authMiddleware, validate(userIdSchema, 'params'), userController.getUserPosts);
router.get('/:id/followers', authMiddleware, validate(userIdSchema, 'params'), userController.getFollowers);
router.get('/:id/following', authMiddleware, validate(userIdSchema, 'params'), userController.getFollowing);
router.post('/follow/:id', authMiddleware, validate(userIdSchema, 'params'), userController.followUser);
router.delete('/follow/:id', authMiddleware, validate(userIdSchema, 'params'), userController.unfollowUser);

module.exports = router;

