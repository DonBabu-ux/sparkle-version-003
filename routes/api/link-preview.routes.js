const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const dns = require('dns').promises;
const { authMiddleware } = require('../../middleware/auth.middleware');

// Helper to extract metadata from HTML using Regex (lightweight, no cheerio)
function extractOgTags(html, targetUrl) {
    const get = (prop) => {
        // Support property="og:title" or property='og:title' or name='description' etc
        const match = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
            || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'));
        return match ? match[1] : null;
    };

    const getTitle = () => {
        const og = get('og:title');
        if (og) return og;
        const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        return match ? match[1].trim() : null;
    };

    let siteName = get('og:site_name');
    if (!siteName) {
        try { siteName = new URL(targetUrl).hostname.replace('www.', ''); } catch (e) {}
    }

    return {
        title:       getTitle(),
        description: get('og:description') || get('description'),
        image:       get('og:image'),
        siteName:    siteName || 'Sparkle',
    };
}

// SSRF Guard: Blocks local/private IP ranges
async function isSafeUrl(urlStr) {
    try {
        const parsed = new URL(urlStr);
        // Only allow http/https
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

        const address = await dns.lookup(parsed.hostname).then(r => r.address).catch(() => null);
        if (!address) return false;

        // Blacklist private IP ranges
        const privateIpRegex = /^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|169\.254\.|::1|fe80:)/i;
        if (privateIpRegex.test(address) || parsed.hostname === 'localhost') {
            return false;
        }

        return true;
    } catch (e) {
        return false;
    }
}

// GET /api/link-preview?url=<encoded-url>
router.get('/', authMiddleware, async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ success: false, message: 'url param required' });
    }

    // SSRF Check (allow external, block internal)
    const isSafe = await isSafeUrl(url);
    if (!isSafe) {
        // Exception: Allow same-origin marketplace links for testing/dev
        const host = req.get('host');
        try {
            const parsed = new URL(url);
            // Allow if it's the current host or localhost
            if (parsed.hostname !== host.split(':')[0] && parsed.hostname !== 'localhost') {
                 return res.status(403).json({ success: false, message: 'URL not allowed' });
            }
        } catch (e) {
             return res.status(403).json({ success: false, message: 'URL not allowed' });
        }
    }

    try {
        const response = await fetch(url, {
            timeout: 5000,
            headers: { 
                'User-Agent': 'SparkleBot/1.1 (+https://sparkle.com/bot)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });

        if (!response.ok) {
            return res.status(500).json({ success: false, message: `Remote server responded with ${response.status}` });
        }

        const html = await response.text();
        const meta = extractOgTags(html, url);

        return res.json({
            success: true,
            url,
            title:       meta.title || 'Link Preview',
            description: meta.description || '',
            image:       meta.image || null,
            siteName:    meta.siteName || 'External Link',
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Preview fetch failed', error: err.message });
    }
});

module.exports = router;
