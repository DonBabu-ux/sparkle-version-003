// routes/api/ai.routes.js
// AI platform API routes – mounted under /api/ai

const express = require('express');
const router = express.Router();
const aiController = require('../../controllers/ai.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { feedRateLimiter } = require('../../middleware/security.middleware');

// All AI endpoints require authentication
router.use(authMiddleware);

// Sparkly AI Assistant Routes
router.post('/sparkly/chat', feedRateLimiter, aiController.sparklyChat);
router.post('/sparkly/chat/stream', feedRateLimiter, aiController.sparklyChatStream);
router.post('/sparkly/stream', feedRateLimiter, aiController.sparklyChatStream);
router.get('/sparkly/conversations', aiController.getConversations);
router.get('/sparkly/conversations/search', aiController.searchConversations);
router.post('/sparkly/conversations', aiController.createConversation);
router.get('/sparkly/conversations/:id/messages', aiController.getMessages);
router.delete('/sparkly/conversations/:id', aiController.deleteConversation);
router.get('/sparkly/memories', aiController.getMemories);
router.delete('/sparkly/memories', aiController.clearMemories);
router.delete('/sparkly/memories/:id', aiController.deleteMemory);
router.post('/sparkly/messages/:id/feedback', aiController.postFeedback);
router.delete('/sparkly/messages/:id/feedback', aiController.removeFeedback);
router.post('/sparkly/conversations/:id/branch', aiController.branchConversation);

module.exports = router;
