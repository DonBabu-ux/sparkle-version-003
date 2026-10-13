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
router.get('/hub-relevance-badges', authMiddleware, userController.getHubRelevanceBadges);
router.get('/active-friends', authMiddleware, userController.getActiveFriends);
router.get('/search', authMiddleware, validate(searchSchema, 'query'), userController.searchUsers);
router.get('/suggestions', authMiddleware, userController.getSuggestions);
router.get('/username-suggestions', authMiddleware, userController.getUsernameSuggestions);
router.get('/following', authMiddleware, userController.searchFollowingUsers);
router.get('/followers', authMiddleware, userController.getMyFollowers);
router.get('/mutual-followers', authMiddleware, userController.getMutualFollowers);
router.post('/contacts/match', authMiddleware, userController.matchContacts);

// Social & Blocking Routes
router.get('/blocks', authMiddleware, socialController.getBlockedUsers);
router.get('/block/status/:id', authMiddleware, validate(userIdSchema, 'params'), socialController.getBlockStatus);
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

router.get('/advanced-settings', authMiddleware, userController.getAdvancedSettings);
router.put('/settings', authMiddleware, userController.updateSettings);
router.get('/export-data', authMiddleware, userController.exportUserData);

// Data Centre (Secure Export Manifest, Job Management & Token Download)
router.get('/data-centre/history', authMiddleware, async (req, res) => {
    try {
        const dataExportService = require('../../services/dataExport.service');
        const history = await dataExportService.getUserExports(req.user.user_id || req.user.id);
        res.json({ success: true, history });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/data-centre/export', authMiddleware, async (req, res) => {
    try {
        const dataExportService = require('../../services/dataExport.service');
        const { categories, format, deliveryEmail, isAlternate } = req.body;
        const result = await dataExportService.requestExport({
            userId: req.user.user_id || req.user.id,
            requestedCategories: categories,
            format,
            deliveryEmail,
            isAlternate
        });
        res.json({ success: true, ...result });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});
router.get('/data-centre/download/:token', async (req, res) => {
    try {
        const dataExportService = require('../../services/dataExport.service');
        const { filePath, fileName } = await dataExportService.getFileByToken(req.params.token);
        res.download(filePath, fileName);
    } catch (e) {
        res.status(403).json({ error: e.message });
    }
});

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

// Account Control — suspend, terminate, delete, cancel-deletion, hide
router.post('/account/suspend', authMiddleware, userController.suspendAccount);
router.post('/account/terminate', authMiddleware, userController.terminateAccount);
router.post('/account/delete', authMiddleware, userController.deleteAccount);
router.post('/account/cancel-deletion', authMiddleware, userController.cancelDeletion);
router.put('/account/visibility', authMiddleware, userController.setHideFromUsers);

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
