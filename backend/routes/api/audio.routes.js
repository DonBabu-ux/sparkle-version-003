const express = require('express');
const router = express.Router();
const audioController = require('../../controllers/audio.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

router.get('/search', authMiddleware, audioController.searchAudio);

module.exports = router;
