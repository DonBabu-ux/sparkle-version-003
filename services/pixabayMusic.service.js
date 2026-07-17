const axios = require('axios');

// Deezer public API — no key required, returns 30-second MP3 previews
const DEEZER_API = 'https://api.deezer.com';

// Genre → Deezer genre ID mapping for mood chip searches
const GENRE_MAP = {
  chill:   132, // Pop
  'hip hop': 116,
  hiphop:  116,
  love:    132,
  jazz:    129,
  party:   132,
  sad:     152, // R&B
  epic:    152,
  workout: 113, // Dance
  acoustic:165, // Folk
};

/**
 * Search Deezer for music tracks.
 * Falls back to genre chart if query matches a known mood chip.
 *
 * @param {string} query    - Search term (e.g. "love", "chill", "hip hop")
 * @param {number} page     - Page number (1-indexed)
 * @param {number} perPage  - Results per page (max 25)
 * @returns {Promise<{tracks: Track[], total: number, totalPages: number, page: number}>}
 */
async function searchMusic(query = '', page = 1, perPage = 20) {
  const index = (page - 1) * perPage;

  let hits = [];
  let total = 0;

  const q = query.trim().toLowerCase();
  const genreId = GENRE_MAP[q];

  if (!q || genreId) {
    // No query or recognised mood → fetch from genre chart (trending feel)
    const gid = genreId || 0; // 0 = all genres
    const limit = Math.min(perPage, 25);
    const response = await axios.get(`${DEEZER_API}/chart/${gid}/tracks`, {
      params: { limit, index },
      timeout: 8000,
    });
    hits = response.data.data || [];
    total = response.data.total || hits.length;
  } else {
    // Free-text search
    const response = await axios.get(`${DEEZER_API}/search`, {
      params: { q: query.trim(), limit: Math.min(perPage, 25), index },
      timeout: 8000,
    });
    hits = response.data.data || [];
    total = response.data.total || hits.length;
  }

  // Normalise to the shape the frontend expects
  const tracks = hits
    .filter((hit) => hit.preview) // only include tracks with an audio preview
    .map((hit) => ({
      id: String(hit.id),
      title: hit.title_short || hit.title || 'Untitled',
      artist: hit.artist?.name || 'Unknown Artist',
      duration: hit.duration || 30,
      audioUrl: hit.preview,               // 30-second MP3 — always present
      thumbnailUrl: hit.album?.cover_medium || hit.album?.cover || null,
      tags: hit.album?.title || '',
    }));

  return {
    tracks,
    total,
    totalPages: Math.ceil(total / perPage),
    page,
  };
}

module.exports = { searchMusic };
