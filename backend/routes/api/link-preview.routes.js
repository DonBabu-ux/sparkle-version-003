const express = require('express');
const logger = require('../../utils/logger');
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
        try { siteName = new URL(targetUrl).hostname.replace('www.', ''); } catch (e) { logger.debug('og hostname parse failed for ' + targetUrl, e?.message || e); }
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

// Known safe domains — immediately classified as SAFE
const KNOWN_SAFE_DOMAINS = new Set([
    'google.com', 'youtube.com', 'twitter.com', 'x.com', 'instagram.com',
    'github.com', 'wikipedia.org', 'facebook.com', 'linkedin.com',
    'reddit.com', 'amazon.com', 'apple.com', 'microsoft.com',
    'stackoverflow.com', 'medium.com', 'tiktok.com', 'whatsapp.com',
    'telegram.org', 't.me', 'discord.com', 'twitch.tv', 'netflix.com',
    'spotify.com', 'dropbox.com', 'drive.google.com', 'docs.google.com',
]);

function isKnownSafe(hostname) {
    const stripped = hostname.replace(/^www\./, '');
    if (KNOWN_SAFE_DOMAINS.has(stripped)) return true;
    // Check if ends with any known safe domain (subdomains)
    for (const safe of KNOWN_SAFE_DOMAINS) {
        if (stripped === safe || stripped.endsWith('.' + safe)) return true;
    }
    return false;
}

// Suspicious / bad TLDs combined with short domain
const BAD_TLDS = ['.tk', '.ml', '.cf', '.ga', '.gq'];

// GET /api/link-preview/safety?url=<encoded url>
async function checkLinkSafety(req, res) {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ safe: false, risk: 'DANGEROUS', reason: 'No URL provided' });
    }

    let parsed;
    try {
        const normalised = url.startsWith('http') ? url : 'https://' + url;
        parsed = new URL(normalised);
    } catch {
        return res.status(200).json({ safe: false, risk: 'DANGEROUS', reason: 'Malformed URL' });
    }

    const hostname = parsed.hostname.toLowerCase();

    // 1. Reject dangerous schemes
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        return res.status(200).json({ safe: false, risk: 'DANGEROUS', reason: 'Dangerous URL scheme' });
    }

    // 2. Reject private/local IPs
    const privateIpRegex = /^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|169\.254\.|::1|fe80:|0\.0\.0\.0)/i;
    if (privateIpRegex.test(hostname) || hostname === 'localhost') {
        return res.status(200).json({ safe: false, risk: 'DANGEROUS', reason: 'Private or local network address blocked' });
    }

    // 3. Known safe domains → immediately SAFE
    if (isKnownSafe(hostname)) {
        return res.status(200).json({ safe: true, risk: 'SAFE', reason: 'Known trusted domain' });
    }

    // 4. Homograph / Punycode detection
    if (hostname.includes('xn--')) {
        return res.status(200).json({ safe: false, risk: 'SUSPICIOUS', reason: 'Internationalized domain name (possible homograph attack)' });
    }

    // 5. Bad TLDs
    for (const tld of BAD_TLDS) {
        if (hostname.endsWith(tld)) {
            return res.status(200).json({ safe: false, risk: 'SUSPICIOUS', reason: `Suspicious TLD: ${tld}` });
        }
    }

    // 6. HTTP (not HTTPS) → SUSPICIOUS
    if (parsed.protocol === 'http:') {
        return res.status(200).json({ safe: false, risk: 'SUSPICIOUS', reason: 'Unencrypted HTTP connection' });
    }

    // 7. .xyz TLD alone is suspicious
    if (hostname.endsWith('.xyz')) {
        return res.status(200).json({ safe: false, risk: 'SUSPICIOUS', reason: 'Commonly abused TLD (.xyz)' });
    }

    // Default: SAFE (conservative to avoid false positives)
    return res.status(200).json({ safe: true, risk: 'SAFE', reason: 'No threats detected' });
}

// GET /api/link-preview?url=<encoded-url>
router.get('/safety', authMiddleware, checkLinkSafety);

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
