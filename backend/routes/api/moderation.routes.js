const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth.middleware');
const { adminMiddleware } = require('../../middleware/admin.middleware');
const moderationController = require('../../controllers/moderation.controller');

// Report a post
router.post('/reports', authMiddleware, moderationController.reportPost);

// Appeal a moderation decision
router.post('/appeals', authMiddleware, moderationController.appealPost);

// Admin review queue + decision (Admins/Moderators only). adminMiddleware
// enforces the role at the DB before any handler runs — the in-handler check
// in reviewAppeal stays as belt-and-braces.
router.get('/appeals/pending', authMiddleware, adminMiddleware, moderationController.getPendingAppeals);
router.post('/appeals/:appeal_id/review', authMiddleware, adminMiddleware, moderationController.reviewAppeal);

module.exports = router;
