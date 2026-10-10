// routes/api/sparkly.routes.js
// Sparkly AI Assistant Gateway API routes

const express = require('express');
const router = express.Router();
const SparklyController = require('../../controllers/sparkly.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { sparklyChatLimiter } = require('../../middleware/sparklyRateLimit.middleware');

// Public Health Check
router.get('/health', SparklyController.getHealth);

// Authenticated Endpoints
router.use(authMiddleware);

// Core Chat Endpoints
router.post('/chat', sparklyChatLimiter, SparklyController.chat);
router.post('/chat/stream', sparklyChatLimiter, SparklyController.chatStream);
router.post('/stream', sparklyChatLimiter, SparklyController.chatStream);

// Conversation History & Session Management
router.get('/conversations', SparklyController.getConversations);
router.post('/conversations', SparklyController.createConversation);
router.get('/conversations/:id/messages', SparklyController.getMessages);
router.delete('/conversations/:id', SparklyController.deleteConversation);
router.post('/conversations/:id/branch', SparklyController.branchConversation);

// Memory & Preferences Management
router.get('/memories', SparklyController.getMemories);
router.delete('/memories', SparklyController.clearMemories);
router.delete('/memories/:id', SparklyController.deleteMemory);

// Feedback Loop (Likes & Dislikes)
router.post('/messages/:id/feedback', SparklyController.postFeedback);
router.delete('/messages/:id/feedback', SparklyController.removeFeedback);

// Knowledge Base Sub-routes
router.use('/', require('./sparklyKnowledge.routes'));

module.exports = router;
