const express = require('express');
const router = express.Router();
const musicController = require('../../controllers/music.controller');

// Music search is public — it only proxies Deezer's public API, no user data
router.get('/search', musicController.search);

module.exports = router;
