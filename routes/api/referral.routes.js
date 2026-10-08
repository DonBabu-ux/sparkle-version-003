// routes/api/referral.routes.js
// Sparkle Production Referral API Routes
'use strict';

const express = require('express');
const router = express.Router();
const referralController = require('../../controllers/referral.controller');
const { authMiddleware, optionalAuthMiddleware } = require('../../middleware/auth.middleware');
const { referralClickLimiter, referralActionLimiter } = require('../../middleware/referralRateLimit.middleware');

// ── Public Endpoints (Click, Validate, Resolve) ──────────────────────────────
router.get('/validate/:code', referralClickLimiter, referralController.validateCode);
router.post('/click', referralClickLimiter, referralController.recordClick);
router.post('/resolve', referralClickLimiter, referralController.resolveHandoff);

// Public lookup by code (e.g. GET /api/referrals/DON7F3)
router.get('/:code', referralClickLimiter, (req, res, next) => {
  // If the param matches a reserved route name, skip
  if (['stats', 'me', 'invite-link', 'leaderboard', 'rewards', 'history'].includes(req.params.code)) {
    return next();
  }
  referralController.validateCode(req, res, next);
});

// ── Authenticated User Endpoints ─────────────────────────────────────────────
router.get('/stats', authMiddleware, referralController.getStats);
router.get('/me', authMiddleware, referralController.getStats);
router.get('/invite-link', authMiddleware, referralController.getInviteLink);
router.get('/leaderboard', optionalAuthMiddleware, referralController.getLeaderboard);
router.get('/rewards', optionalAuthMiddleware, referralController.getRewards);
router.get('/history', authMiddleware, referralController.getHistory);

router.post('/claim', authMiddleware, referralActionLimiter, referralController.claimReferral);
router.post('/manual', authMiddleware, referralActionLimiter, referralController.manualCode);

module.exports = router;
