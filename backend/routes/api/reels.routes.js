const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth.middleware');
const { mutationRateLimiter } = require('../../middleware/security.middleware');
const reelsController = require('../../controllers/reels.controller');
const { momentsUpload } = require('../../middleware/upload.middleware');

// All reel-creator endpoints require authentication
router.use(authMiddleware);

// ── Drafts (private to creator; never surfaced to feeds/search) ──
router.get('/drafts', reelsController.listDrafts);
router.get('/drafts/:id', reelsController.getDraft);
router.post('/drafts', mutationRateLimiter, reelsController.upsertDraft);
router.delete('/drafts/:id', mutationRateLimiter, reelsController.deleteDraft);

// ── Close Friends ──
router.get('/close-friends', reelsController.getCloseFriends);
router.put('/close-friends', mutationRateLimiter, reelsController.setCloseFriends);
router.get('/close-friends/suggestions', reelsController.getCloseFriendSuggestions);

// ── Audience exclude/include lists ──
router.get('/audience-list', reelsController.getAudienceList);
router.put('/audience-list', mutationRateLimiter, reelsController.setAudienceList);

// ── Hashtags ──
router.get('/hashtags/recent', reelsController.getRecentHashtags);
router.get('/hashtags/suggest', reelsController.suggestHashtags);

// ── People / mentions ──
router.get('/people/recent', reelsController.getRecentMentions);
router.get('/people/search', reelsController.searchPeople);
router.get('/people/friends', reelsController.getFriendsList);
router.get('/people/followers', reelsController.getFollowers);

// ── Captions (real STT; single small file) ──
router.post(
    '/captions/transcribe',
    mutationRateLimiter,
    momentsUpload.single('media'),
    reelsController.transcribeCaptions
);

module.exports = router;
