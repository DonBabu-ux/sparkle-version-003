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

// User interaction
router.post('/user/:userId/follow', authMiddleware, momentsController.followUser);

// Creator dashboard (own moments + takedown)
router.delete('/:id', authMiddleware, momentsController.deleteMoment);
router.post('/:id/restore', authMiddleware, momentsController.restoreMoment);

// DashboardAPI Compatibility — profile REELS grid (audience-enforced)
router.get('/users/:userId/moments', authMiddleware, momentsController.getUserMoments);

module.exports = router;
