const express = require('express');
const router = express.Router();
const stickerController = require('../../controllers/sticker.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

// Core sticker routes
router.post('/', authMiddleware, stickerController.createSticker);

// Add Yours specific
router.get('/add-yours/:prompt_id', authMiddleware, stickerController.getAddYoursData);
router.post('/add-yours/prompt', authMiddleware, stickerController.createAddYoursPrompt);
router.post('/add-yours/respond', authMiddleware, stickerController.respondToAddYours);

// Interactions
router.post('/poll/vote', authMiddleware, stickerController.votePoll);
router.post('/reaction', authMiddleware, stickerController.reactToStory);

module.exports = router;
