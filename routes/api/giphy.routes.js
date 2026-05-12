const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const logger = require('../../utils/logger');

const GIPHY_API_KEY = process.env.GIPHY_API_KEY || 'V4AnAfCCCGEVjlUjiNMWWXCoW1JrAn4p';

router.get('/trending', async (req, res) => {
    try {
        const url = `https://api.giphy.com/v1/stickers/trending?api_key=${GIPHY_API_KEY}&limit=30&rating=g`;
        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        logger.error('Giphy Trending Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch trending stickers' });
    }
});

router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        const url = `https://api.giphy.com/v1/stickers/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(q)}&limit=30&rating=g`;
        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        logger.error('Giphy Search Error:', error.message);
        res.status(500).json({ error: 'Failed to search stickers' });
    }
});

module.exports = router;
