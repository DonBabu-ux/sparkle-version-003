const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth.middleware');
const { search, getSuggestions } = require('../../controllers/search.controller');

router.use(authMiddleware);

router.get('/', search);
router.get('/suggestions', getSuggestions);

module.exports = router;
