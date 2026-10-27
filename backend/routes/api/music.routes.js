const express = require('express');
const router = express.Router();
const musicController = require('../../controllers/music.controller');

// Music endpoints are public — they only proxy Deezer's public API, no user data
router.get('/search', musicController.search);
router.get('/trending', musicController.trending);
router.get('/categories', musicController.categories);

module.exports = router;
