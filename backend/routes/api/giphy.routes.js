const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const logger = require('../../utils/logger');

const ALLOWED_TYPES = new Set(['gifs', 'stickers']);
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;

async function handleGiphy(req, res, endpoint) {
    const apiKey = process.env.GIPHY_API_KEY;
    if (!apiKey) {
        return res.status(503).json({ error: 'Giphy is not configured' });
    }

    const requestedType = String(req.query.type || 'stickers');
    const type = ALLOWED_TYPES.has(requestedType) ? requestedType : 'stickers';

    const limitRaw = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT) : DEFAULT_LIMIT;

    const params = [`api_key=${encodeURIComponent(apiKey)}`, `limit=${limit}`, 'rating=g'];
    if (endpoint === 'search') {
        const q = String(req.query.q || '').trim();
        if (!q) return res.status(400).json({ error: 'q is required for search' });
        params.push(`q=${encodeURIComponent(q)}`);
    }

    try {
        const url = `https://api.giphy.com/v1/${type}/${endpoint}?${params.join('&')}`;
        const response = await fetch(url);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return res.status(response.status).json({ error: 'Giphy request failed', detail: data });
        }
        return res.json(data);
    } catch (error) {
        logger.error(`Giphy ${endpoint} Error:`, error.message);
        return res.status(500).json({ error: `Failed to fetch ${endpoint}` });
    }
}

router.get('/trending', (req, res) => handleGiphy(req, res, 'trending'));
router.get('/search', (req, res) => handleGiphy(req, res, 'search'));

module.exports = router;
