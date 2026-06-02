// routes/api/ai.routes.js
// AI platform API routes – will be mounted under /api/ai

const express = require('express');
const router = express.Router();
const aiController = require('../../controllers/ai.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

// All AI endpoints require authentication
router.use(authMiddleware);

// Chat endpoint – core interaction with DeepSeek
router.post('/chat', aiController.chat);

// Future endpoints (study, caption, bio, search, friend, moderate) can be added here
// Example placeholder:
// router.post('/study', aiController.studyAssistant);
// router.post('/caption', aiController.captionGenerator);
// router.post('/bio', aiController.bioGenerator);
// router.post('/search', aiController.searchAssistant);
// router.post('/friend', aiController.friendDiscovery);
// router.post('/moderate', aiController.moderateContent);

module.exports = router;
