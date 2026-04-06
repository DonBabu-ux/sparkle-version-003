const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth.middleware');
const { search, getSuggestions, saveSearch, getRecentSearches, clearSearchHistory } = require('../../controllers/search.controller');

router.use(authMiddleware);

// Main search (supports ?q=&type=users|posts|moments|groups|marketplace|clubs&campus=)
router.get('/', search);

// Autocomplete suggestions
router.get('/suggestions', getSuggestions);

// Search history
router.get('/history', getRecentSearches);         // NEW — recent searches
router.post('/history', saveSearch);               // NEW — save query
router.delete('/history', clearSearchHistory);     // NEW — clear history

module.exports = router;
