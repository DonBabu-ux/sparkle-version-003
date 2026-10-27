const { searchMusic, getTrending, getCategories } = require('../services/pixabayMusic.service');

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

module.exports = { search, trending, categories };
