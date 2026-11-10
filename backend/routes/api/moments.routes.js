const express = require('express');
const router = express.Router();
const momentsController = require('../../controllers/moments.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { upload, momentsUpload } = require('../../middleware/upload.middleware');
const { mutationRateLimiter } = require('../../middleware/security.middleware');
const { validate } = require('../../middleware/validation.middleware');
const mv = require('../../validators/moment.validator');


// Stream endpoints
router.get('/stream', authMiddleware, momentsController.getMomentsStream);

// Creator dashboard — MUST stay above '/:id': Express matches in registration
// order, so '/:id' would otherwise capture 'my' as an id.
router.get('/my/moments', authMiddleware, momentsController.getMyMoments);

// Personalised search suggestions — MUST stay above '/:id' or ':id' captures 'suggestions'.
router.get('/suggestions', authMiddleware, momentsController.getMomentSuggestions);

// Saved stickers (created from the caller's own reels) — also above '/:id'
router.get('/stickers', authMiddleware, momentsController.listStickers);
router.post('/stickers', authMiddleware, mutationRateLimiter, validate(mv.saveStickerSchema, 'body'), momentsController.saveSticker);
router.delete('/stickers/:id', authMiddleware, validate(mv.idParam, 'params'), momentsController.deleteSticker);

// CRUD operations
router.get('/:id', authMiddleware, validate(mv.idParam, 'params'), momentsController.getMomentById);
router.post('/',
    authMiddleware,
    mutationRateLimiter,
    momentsUpload.single('media'),
    validate(mv.createMomentSchema, 'body'),
    momentsController.createMoment
);

// Interaction endpoints
router.put('/:id', authMiddleware, validate(mv.updatePrivacySchema, 'body'), momentsController.updateMomentPrivacy);
router.post('/:id/pin', authMiddleware, validate(mv.idParam, 'params'), momentsController.toggleMomentPin);
router.post('/:id/spark', authMiddleware, mutationRateLimiter, validate(mv.idParam, 'params'), momentsController.sparkMoment);
router.post('/:id/save', authMiddleware, mutationRateLimiter, validate(mv.idParam, 'params'), momentsController.saveMoment);
router.post('/:id/share', authMiddleware, momentsController.trackShare);
router.post('/:id/view', authMiddleware, validate(mv.idParam, 'params'), momentsController.trackView);
router.get('/:id/viewers', authMiddleware, validate(mv.idParam, 'params'), momentsController.getMomentViewers);
router.post('/:id/engagement', authMiddleware, validate(mv.trackEngagementSchema, 'body'), momentsController.trackEngagement);
router.get('/:id/share-data', authMiddleware, validate(mv.idParam, 'params'), momentsController.getShareData);

// Comment endpoints
router.get('/:id/comments', authMiddleware, validate(mv.idParam, 'params'), momentsController.getComments);
router.post('/:id/comments', authMiddleware, mutationRateLimiter, validate(mv.addCommentSchema, 'body'), momentsController.addComment);
router.post('/comment/:id/like', authMiddleware, mutationRateLimiter, validate(mv.commentIdParam, 'params'), momentsController.likeComment);
// Edit own comment (PUT) — server-enforced 48h window, owner only
router.put('/comment/:id', authMiddleware, mutationRateLimiter, validate(mv.editCommentSchema, 'body'), momentsController.editComment);
// Delete own comment (DELETE) — ownership re-verified in the database
router.delete('/comment/:id', authMiddleware, validate(mv.commentIdParam, 'params'), momentsController.deleteComment);
// Reel-owner / platform-moderator removal of someone else's comment:
// requires a moderation reason, writes an audit record, notifies the author
router.post('/comment/:id/moderate', authMiddleware, mutationRateLimiter, validate(mv.moderateCommentSchema, 'body'), momentsController.moderateComment);
// Report a comment to platform moderation (NEVER deletes the comment)
router.post('/comment/:id/report', authMiddleware, mutationRateLimiter, validate(mv.reportSchema, 'body'), momentsController.reportComment);
// Single comment fetch (for edit pre-population / permission checks)
router.get('/comment/:id', authMiddleware, validate(mv.commentIdParam, 'params'), momentsController.getComment);

// Guarantee the comment schema (is_deleted/updated_at columns, moderation
// audit log, comment reports) exists before the first comment request lands.
// prewarm is idempotent and cheap once complete; failures are logged inside
// and retried on the next call.
momentsController.prewarm().catch(() => { /* logged by prewarm */ });

// User interaction
router.post('/user/:userId/follow', authMiddleware, validate(mv.userIdParam, 'params'), momentsController.followUser);

// Creator dashboard (own moments + takedown)
router.delete('/:id', authMiddleware, validate(mv.idParam, 'params'), momentsController.deleteMoment);
router.post('/:id/restore', authMiddleware, validate(mv.idParam, 'params'), momentsController.restoreMoment);

// DashboardAPI Compatibility — profile REELS grid (audience-enforced)
router.get('/users/:userId/moments', authMiddleware, validate(mv.userIdParam, 'params'), momentsController.getUserMoments);

module.exports = router;
