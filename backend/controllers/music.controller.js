const { searchMusic, getTrending, getCategories } = require('../services/pixabayMusic.service');
const axios = require('axios');
const url = require('url');

/**
 * GET /api/music/search?q=<query>&page=<n>&per_page=<n>
 * Returns a paginated list of catalogue tracks (Deezer public previews).
 */
async function search(req, res) {
  try {
    const { q = '', page = 1, per_page = 20 } = req.query;

    const result = await searchMusic(q, parseInt(page, 10), parseInt(per_page, 10));

    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('[MusicController] Search error:', err.message);

    const status = err.response?.status || 500;
    res.status(status).json({
      success: false,
      message: err.response?.data?.error || 'Failed to fetch music. Please try again.',
    });
  }
}

/**
 * GET /api/music/trending?genre=<chip>&limit=<n>
 * Four real chart tracks by default for the Create-reel shelf.
 */
async function trending(req, res) {
  try {
    const { genre, limit } = req.query;
    const tracks = await getTrending({ genre, limit });
    res.json({ success: true, tracks });
  } catch (err) {
    console.error('[MusicController] Trending error:', err.message);
    // Upstream failure → explicit empty state the UI can render honestly
    res.status(502).json({
      success: false,
      tracks: [],
      message: 'Trending music is unavailable right now. Try search instead.',
    });
  }
}

/** GET /api/music/categories */
async function categories(req, res) {
  res.json({ success: true, categories: getCategories() });
}

/**
 * GET /api/music/preview-proxy?url=<encoded_deezer_preview_url>
 * Pipes a Deezer 30s preview through the backend so the Android WebView
 * receives audio over the same HTTPS origin (no CORS / cleartext block).
 * Only allows cdn-preview Deezer hostnames to prevent open-proxy abuse.
 */
async function previewProxy(req, res) {
  try {
    const { url: rawUrl } = req.query;
    if (!rawUrl) return res.status(400).json({ message: 'Missing url param' });

    const parsed = url.parse(rawUrl);
    const allowed = /\.dzcdn\.net$|\.deezer\.com$|^cdnt\d+\./i;
    if (!parsed.hostname || !allowed.test(parsed.hostname)) {
      return res.status(403).json({ message: 'Disallowed audio host' });
    }

    // Force HTTPS regardless of what was passed in
    const safeUrl = rawUrl.startsWith('http://') ? 'https://' + rawUrl.slice(7) : rawUrl;

    const upstream = await axios.get(safeUrl, {
      responseType: 'stream',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Range': req.headers['range'] || '',
      },
    });

    res.setHeader('Content-Type', upstream.headers['content-type'] || 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'bytes');
    if (upstream.headers['content-length']) {
      res.setHeader('Content-Length', upstream.headers['content-length']);
    }
    if (upstream.headers['content-range']) {
      res.setHeader('Content-Range', upstream.headers['content-range']);
    }
    res.status(upstream.status);
    upstream.data.pipe(res);
  } catch (err) {
    console.error('[MusicController] Preview proxy error:', err.message);
    if (!res.headersSent) {
      res.status(502).json({ message: 'Could not fetch audio preview.' });
    }
  }
}

module.exports = { search, trending, categories, previewProxy };
