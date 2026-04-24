const express = require('express');
const router = express.Router();
const userController = require('../../controllers/user.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

const { validate } = require('../../middleware/validation.middleware');
const { upload } = require('../../middleware/upload.middleware');
const { searchSchema, updateProfileSchema, updatePasswordSchema, userIdSchema } = require('../../validators/user.validator');

const socialController = require('../../controllers/social.controller');
const { getUserHighlights } = require('../../controllers/highlight.controller');

router.get('/me', authMiddleware, userController.getCurrentUser);
router.get('/active-friends', authMiddleware, userController.getActiveFriends);
router.get('/search', authMiddleware, validate(searchSchema, 'query'), userController.searchUsers);
router.get('/suggestions', authMiddleware, userController.getSuggestions);
router.get('/following', authMiddleware, userController.searchFollowingUsers);

// Social & Blocking Routes
router.get('/blocks', authMiddleware, socialController.getBlockedUsers);
router.post('/block/:id', authMiddleware, validate(userIdSchema, 'params'), socialController.blockUser);
router.delete('/block/:id', authMiddleware, validate(userIdSchema, 'params'), socialController.unblockUser);

// DashboardAPI Compatibility Aliases
router.post('/:id/block', authMiddleware, validate(userIdSchema, 'params'), socialController.blockUser);
router.delete('/:id/block', authMiddleware, validate(userIdSchema, 'params'), socialController.unblockUser);
router.post('/:id/mute', authMiddleware, validate(userIdSchema, 'params'), socialController.muteUser);
router.delete('/:id/mute', authMiddleware, validate(userIdSchema, 'params'), socialController.unmuteUser);
router.post('/:id/report', authMiddleware, validate(userIdSchema, 'params'), socialController.reportUser);

// Follow Requests (Step 6)
router.get('/follow-requests', authMiddleware, socialController.getFollowRequests);
router.post('/follow-requests/respond', authMiddleware, socialController.respondToFollowRequest);
router.post('/follow-requests/:requestId/accept', authMiddleware, socialController.acceptRequest);
router.post('/follow-requests/:requestId/reject', authMiddleware, socialController.rejectRequest);

router.put('/settings', authMiddleware, userController.updateSettings);
router.get('/export-data', authMiddleware, userController.exportUserData);
router.get('/2fa/setup', authMiddleware, userController.generate2FASecret);
router.post('/2fa/enable', authMiddleware, userController.enableTwoFactor);
router.post('/2fa/disable', authMiddleware, userController.disableTwoFactor);

// Session Management
router.get('/sessions', authMiddleware, userController.getActiveSessions);
router.delete('/sessions/:sessionId', authMiddleware, userController.revokeSession);
router.post('/security/token', authMiddleware, userController.generateSecurityToken);
router.post('/sessions/logout-all', authMiddleware, userController.logoutAllDevices);

router.put('/profile', authMiddleware, validate(updateProfileSchema), userController.updateProfile);
router.patch('/profile/note', authMiddleware, userController.updateNote);
router.post('/avatar', authMiddleware, upload.single('avatar'), userController.uploadAvatar);
router.put('/password', authMiddleware, validate(updatePasswordSchema), userController.updatePassword);
router.delete('/me', authMiddleware, userController.deleteAccount);

// Social & Profile Routes — specific subroutes MUST come before /:id catch-all
router.get('/:id/posts', authMiddleware, userController.getUserPosts);
router.get('/:id/followers', authMiddleware, userController.getFollowers);
router.get('/:id/following', authMiddleware, userController.getFollowing);
router.get('/:id/highlights', authMiddleware, getUserHighlights);
router.get('/:id', authMiddleware, userController.getUserProfile);
router.post('/follow/:id', authMiddleware, validate(userIdSchema, 'params'), userController.followUser);
router.delete('/follow/:id', authMiddleware, validate(userIdSchema, 'params'), userController.unfollowUser);

// DashboardAPI Compatibility Aliases
router.post('/:id/follow', authMiddleware, validate(userIdSchema, 'params'), userController.followUser);
router.delete('/:id/follow', authMiddleware, validate(userIdSchema, 'params'), userController.unfollowUser);
router.post('/:id/poke', authMiddleware, validate(userIdSchema, 'params'), socialController.pokeUser);

module.exports = router;
