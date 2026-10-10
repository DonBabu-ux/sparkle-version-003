const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth.middleware');
const moderationController = require('../../controllers/moderation.controller');

// Report a post
router.post('/reports', authMiddleware, moderationController.reportPost);

// Appeal a moderation decision
router.post('/appeals', authMiddleware, moderationController.appealPost);

// Review an appeal (Admins/Moderators only)
router.post('/appeals/:appeal_id/review', authMiddleware, moderationController.reviewAppeal);

module.exports = router;
