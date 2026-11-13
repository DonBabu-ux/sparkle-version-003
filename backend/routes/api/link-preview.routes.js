const express = require('express');
const logger = require('../../utils/logger');
const pool = require('../../config/database');
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

// Internal Sparkle link resolver (stories, posts, listings)
// Resolves database metadata directly without making network requests to localhost or app host.
async function resolveInternalSparklePreview(urlStr) {
    try {
        const parsed = new URL(urlStr);
        const host = (parsed.hostname || '').toLowerCase();
        const isInternalHost = host === 'localhost' ||
            host === '127.0.0.1' ||
            host === '::1' ||
            host === 'sparkleapp.com' ||
            host === 'sparklewebapp.vercel.app' ||
            host.endsWith('.sparkleapp.com');

        if (!isInternalHost) return null;

        const pathname = parsed.pathname;

        // 1. Stories: /stories/:id
        const storyMatch = pathname.match(/^\/stories\/([a-zA-Z0-9_-]+)/);
        if (storyMatch) {
            const storyId = storyMatch[1];
            try {
                const [rows] = await pool.query(`
                    SELECT s.story_id, s.media_url, s.media_type, s.caption,
                           u.username, u.name AS user_name, u.avatar_url
                    FROM stories s
                    JOIN users u ON s.user_id = u.user_id
                    WHERE s.story_id = ?
                `, [storyId]);
                if (rows && rows.length > 0) {
                    const s = rows[0];
                    return {
                        success: true,
                        url: urlStr,
                        title: `${s.user_name || s.username}'s Story`,
                        description: s.caption || 'View this story on Sparkle',
                        image: s.media_url || s.avatar_url || null,
                        siteName: 'Sparkle'
                    };
                }
            } catch (err) {
                logger.warn(`Internal story preview failed: ${err.message}`);
            }
            return {
                success: true,
                url: urlStr,
                title: 'Sparkle Story',
                description: 'View this story on Sparkle',
                image: null,
                siteName: 'Sparkle'
            };
        }

        // 2. Posts: /posts/:id or /p/:id
        const postMatch = pathname.match(/^\/(?:posts|p)\/([a-zA-Z0-9_-]+)/);
        if (postMatch) {
            const postId = postMatch[1];
            try {
                const [rows] = await pool.query(`
                    SELECT p.post_id, p.content, p.media_url,
                           u.username, u.name AS user_name, u.avatar_url
                    FROM posts p
                    JOIN users u ON p.user_id = u.user_id
                    WHERE p.post_id = ?
                `, [postId]);
                if (rows && rows.length > 0) {
                    const p = rows[0];
                    return {
                        success: true,
                        url: urlStr,
                        title: `${p.user_name || p.username} on Sparkle`,
                        description: (p.content || '').slice(0, 160) || 'View post on Sparkle',
                        image: p.media_url || p.avatar_url || null,
                        siteName: 'Sparkle'
                    };
                }
            } catch (err) {
                logger.warn(`Internal post preview failed: ${err.message}`);
            }
            return {
                success: true,
                url: urlStr,
                title: 'Sparkle Post',
                description: 'View post on Sparkle',
                image: null,
                siteName: 'Sparkle'
            };
        }

        // 3. Marketplace: /marketplace/:id or /listing/:id
        const marketMatch = pathname.match(/^\/(?:marketplace|listing)\/([a-zA-Z0-9_-]+)/);
        if (marketMatch) {
            const listingId = marketMatch[1];
            try {
                const [rows] = await pool.query(`
                    SELECT title, description, price, currency, images
                    FROM marketplace_listings
                    WHERE listing_id = ? OR id = ?
                `, [listingId, listingId]);
                if (rows && rows.length > 0) {
                    const l = rows[0];
                    let img = null;
                    try {
                        const parsedImg = JSON.parse(l.images);
                        img = Array.isArray(parsedImg) ? parsedImg[0] : parsedImg;
                    } catch {}
                    return {
                        success: true,
                        url: urlStr,
                        title: l.title || 'Marketplace Item',
                        description: l.description ? l.description.slice(0, 160) : `${l.currency || '$'}${l.price || ''}`,
                        image: img || null,
                        siteName: 'Sparkle Marketplace'
                    };
                }
            } catch (err) {
                logger.warn(`Internal marketplace preview failed: ${err.message}`);
            }
            return {
                success: true,
                url: urlStr,
                title: 'Sparkle Marketplace',
                description: 'View item on Sparkle Marketplace',
                image: null,
                siteName: 'Sparkle'
            };
        }

        // Generic fallback for any other internal route
        return {
            success: true,
            url: urlStr,
            title: 'Sparkle',
            description: 'Open in Sparkle',
            image: null,
            siteName: 'Sparkle'
        };
    } catch {
        return null;
    }
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

    // 1. Check for internal Sparkle routes first (avoid network fetch to localhost or app host)
    const internalPreview = await resolveInternalSparklePreview(url);
    if (internalPreview) {
        return res.json(internalPreview);
    }

    // 2. SSRF Check (allow external, block internal)
    const isSafe = await isSafeUrl(url);
    if (!isSafe) {
        return res.status(200).json({ success: false, message: 'Private or local URLs cannot be previewed' });
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
            return res.status(200).json({ success: false, message: `Remote server responded with ${response.status}` });
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
        // Network timeout, DNS failure, connection refused, or HTML parse error
        // An unreachable remote URL is normal client data, not an internal server crash.
        logger.debug(`[link-preview] fetch failed for ${url}: ${err.message}`);
        return res.status(200).json({ success: false, message: 'Link preview unavailable' });
    }
});

module.exports = router;
