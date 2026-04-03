const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { authMiddleware } = require('../../middleware/auth.middleware');

// Simple OG tag extractor — no extra deps needed
function extractOgTags(html) {
    const get = (prop) => {
        const match = html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
            || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i'));
        return match ? match[1] : null;
    };

    const getTitle = () => {
        const og = get('og:title');
        if (og) return og;
        const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        return match ? match[1].trim() : null;
    };

    return {
        title:       getTitle(),
        description: get('og:description') || get('description'),
        image:       get('og:image'),
        siteName:    get('og:site_name') || 'Sparkle',
    };
}

// GET /api/link-preview?url=<encoded-url>
router.get('/', authMiddleware, async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ success: false, message: 'url param required' });
    }

    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return res.status(400).json({ success: false, message: 'Invalid URL' });
    }

    // Only fetch from the same server or marketplace listing paths (SSRF guard)
    const host = req.get('host');
    const isSameOrigin = parsed.hostname === host || parsed.hostname === 'localhost';
    const isMarketplacePath = parsed.pathname.startsWith('/marketplace/');

    if (!isSameOrigin || !isMarketplacePath) {
        return res.status(403).json({ success: false, message: 'URL not allowed' });
    }

    try {
        const response = await fetch(url, {
            timeout: 4000,
            headers: { 'User-Agent': 'SparkleBot/1.0 (link-preview)' }
        });

        if (!response.ok) {
            return res.status(422).json({ success: false, message: 'Could not fetch URL' });
        }

        const html = await response.text();
        const meta = extractOgTags(html);

        return res.json({
            success: true,
            url,
            title:       meta.title || 'Sparkle Marketplace',
            description: meta.description || '',
            image:       meta.image || null,
            siteName:    meta.siteName || 'Sparkle',
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Preview fetch failed', error: err.message });
    }
});

module.exports = router;
