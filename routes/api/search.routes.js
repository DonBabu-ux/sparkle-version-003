const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth.middleware');
const { 
    search, getSuggestions, saveSearch, 
    getRecentSearches, clearSearchHistory, deleteSearchItem,
    getTrending, getDiscovery
} = require('../../controllers/search.controller');

router.use(authMiddleware);

// Main search
router.get('/', search);

// Autocomplete suggestions
router.get('/suggestions', getSuggestions);

// Discovery & Trending (Real data)
router.get('/trending', getTrending);
router.get('/discovery', getDiscovery);

// Search history
router.get('/history', getRecentSearches);
router.post('/history', saveSearch);
router.delete('/history', clearSearchHistory);
router.delete('/history/:id', deleteSearchItem);

module.exports = router;

