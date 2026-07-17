const { searchMusic } = require('../services/pixabayMusic.service');

/**
 * GET /api/music/search?q=<query>&page=<n>&per_page=<n>
 * Returns a paginated list of Pixabay music tracks.
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

    // Pixabay key missing → 503 (server config issue, not user error)
    if (err.message.includes('PIXABAY_API_KEY')) {
      return res.status(503).json({ success: false, message: 'Music search is not configured.' });
    }

    // Pixabay returned a non-2xx or network error
    const status = err.response?.status || 500;
    res.status(status).json({
      success: false,
      message: err.response?.data?.error || 'Failed to fetch music. Please try again.',
    });
  }
}

module.exports = { search };
