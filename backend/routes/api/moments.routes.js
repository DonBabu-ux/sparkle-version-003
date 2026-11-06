const express = require('express');
const router = express.Router();
const momentsController = require('../../controllers/moments.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { upload, momentsUpload } = require('../../middleware/upload.middleware');
const { mutationRateLimiter } = require('../../middleware/security.middleware');


// Stream endpoints
router.get('/stream', authMiddleware, momentsController.getMomentsStream);

// Creator dashboard — MUST stay above '/:id': Express matches in registration
// order, so '/:id' would otherwise capture 'my' as an id.
router.get('/my/moments', authMiddleware, momentsController.getMyMoments);

// Personalised search suggestions — MUST stay above '/:id' or ':id' captures 'suggestions'.
router.get('/suggestions', authMiddleware, momentsController.getMomentSuggestions);

// Saved stickers (created from the caller's own reels) — also above '/:id'
router.get('/stickers', authMiddleware, momentsController.listStickers);
router.post('/stickers', authMiddleware, mutationRateLimiter, momentsController.saveSticker);
router.delete('/stickers/:id', authMiddleware, momentsController.deleteSticker);

// CRUD operations
router.get('/:id', authMiddleware, momentsController.getMomentById);
router.post('/',
    authMiddleware,
    mutationRateLimiter,
    momentsUpload.single('media'),
    momentsController.createMoment
);

// Interaction endpoints
router.put('/:id', authMiddleware, momentsController.updateMomentPrivacy);
router.post('/:id/pin', authMiddleware, momentsController.toggleMomentPin);
router.post('/:id/spark', authMiddleware, mutationRateLimiter, momentsController.sparkMoment);
router.post('/:id/save', authMiddleware, mutationRateLimiter, momentsController.saveMoment);
router.post('/:id/share', authMiddleware, momentsController.trackShare);
router.post('/:id/view', authMiddleware, momentsController.trackView);
router.get('/:id/viewers', authMiddleware, momentsController.getMomentViewers);
router.post('/:id/engagement', authMiddleware, momentsController.trackEngagement);
router.get('/:id/share-data', authMiddleware, momentsController.getShareData);

// Comment endpoints
router.get('/:id/comments', authMiddleware, momentsController.getComments);
router.post('/:id/comments', authMiddleware, mutationRateLimiter, momentsController.addComment);
router.post('/comment/:id/like', authMiddleware, mutationRateLimiter, momentsController.likeComment);
// Edit own comment (PUT) — server-enforced 48h window, owner only
router.put('/comment/:id', authMiddleware, mutationRateLimiter, momentsController.editComment);
// Delete own comment (DELETE) — ownership re-verified in the database
router.delete('/comment/:id', authMiddleware, mutationRateLimiter, momentsController.deleteComment);
// Reel-owner / platform-moderator removal of someone else's comment:
// requires a moderation reason, writes an audit record, notifies the author
router.post('/comment/:id/moderate', authMiddleware, mutationRateLimiter, momentsController.moderateComment);
// Report a comment to platform moderation (NEVER deletes the comment)
router.post('/comment/:id/report', authMiddleware, mutationRateLimiter, momentsController.reportComment);
// Single comment fetch (for edit pre-population / permission checks)
router.get('/comment/:id', authMiddleware, momentsController.getComment);

// Guarantee the comment schema (is_deleted/updated_at columns, moderation
// audit log, comment reports) exists before the first comment request lands.
// prewarm is idempotent and cheap once complete; failures are logged inside
// and retried on the next call.
momentsController.prewarm().catch(() => { /* logged by prewarm */ });

// User interaction
router.post('/user/:userId/follow', authMiddleware, momentsController.followUser);

// Creator dashboard (own moments + takedown)
router.delete('/:id', authMiddleware, momentsController.deleteMoment);
router.post('/:id/restore', authMiddleware, momentsController.restoreMoment);

// DashboardAPI Compatibility — profile REELS grid (audience-enforced)
router.get('/users/:userId/moments', authMiddleware, momentsController.getUserMoments);

module.exports = router;
