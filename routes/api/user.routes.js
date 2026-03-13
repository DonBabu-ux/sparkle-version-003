const express = require('express');
const router = express.Router();
const userController = require('../../controllers/user.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

const { validate } = require('../../middleware/validation.middleware');
const { upload } = require('../../middleware/upload.middleware');
const { searchSchema, updateProfileSchema, updatePasswordSchema, userIdSchema } = require('../../validators/user.validator');

const socialController = require('../../controllers/social.controller');

router.get('/me', authMiddleware, userController.getCurrentUser);
router.get('/search', authMiddleware, validate(searchSchema, 'query'), userController.searchUsers);
router.get('/suggestions', authMiddleware, userController.getSuggestions);
router.get('/following', authMiddleware, userController.searchFollowingUsers);

// Social & Blocking Routes
router.get('/blocks', authMiddleware, socialController.getBlockedUsers);
router.post('/block/:id', authMiddleware, validate(userIdSchema, 'params'), socialController.blockUser);
router.delete('/block/:id', authMiddleware, validate(userIdSchema, 'params'), socialController.unblockUser);

// Follow Requests
router.get('/follow-requests', authMiddleware, socialController.getFollowRequests);
router.post('/follow-requests/respond', authMiddleware, socialController.respondToFollowRequest);

router.put('/settings', authMiddleware, userController.updateSettings);
router.get('/export-data', authMiddleware, userController.exportUserData);
router.post('/2fa/toggle', authMiddleware, userController.toggleTwoFactor);

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
