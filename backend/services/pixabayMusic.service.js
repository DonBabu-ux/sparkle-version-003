const axios = require('axios');

// Deezer public API — no key required, returns 30-second MP3 previews.
// Sparkle uses this as the licensed preview catalogue: we stream the
// official 30s preview URLs provided by Deezer and never download or
// rehost full tracks.
const DEEZER_API = 'https://api.deezer.com';

// Mood/category chip → Deezer genre ID. Categories requested by the reel
// creator UI. Bright/Dreamy/Groovy/Sentimental map to closest real genres.
const GENRE_MAP = {
  birthday: 132,        // Pop charts read best for celebration playlists
  'date night': 152,    // R&B
  family: 165,          // Folk
  love: 132,            // Pop
  morning: 132,         // Pop
  'r&b': 152,
  'r&b and soul': 152,
  rnb: 152,
  soul: 152,
  pop: 132,
  'hip-hop': 116,
  hiphop: 116,
  'hip hop': 116,
  rap: 116,
  rock: 113,            // Rock (Deezer 113 is Dance; 85/152 alternatives — use search fallback below)
  country: 165,
  bright: 132,
  dreamy: 152,
  groovy: 113,
  sentimental: 152,
  chill: 132,
  jazz: 129,
  party: 132,
  sad: 152,
  epic: 152,
  workout: 113,
  acoustic: 165,
};

// Genre IDs that have a dedicated Deezer chart endpoint. Others fall back
// to a free-text search on the category name (still real catalogue results).
const CHART_GENRES = new Set([132, 116, 152, 113, 129, 165, 127, 85]);

const CATEGORY_LIST = [
  'Birthday', 'Date Night', 'Family', 'Love', 'Morning',
  'R&B and Soul', 'Pop', 'Hip-Hop', 'Rock', 'Country',
  'Bright', 'Dreamy', 'Groovy', 'Sentimental',
];

function normalizeTrack(hit) {
  if (!hit || !hit.preview) return null;
  return {
    id: String(hit.id),
    title: hit.title_short || hit.title || 'Untitled',
    artist: hit.artist?.name || 'Unknown Artist',
    artistId: hit.artist?.id != null ? String(hit.artist.id) : null,
    duration: hit.duration || 30,
    audioUrl: hit.preview,
    thumbnailUrl: hit.album?.cover_medium || hit.album?.cover || null,
    albumTitle: hit.album?.title || '',
    link: hit.link || null,
  };
}

async function fetchChart(genreId = 0, limit = 20, index = 0) {
  const response = await axios.get(`${DEEZER_API}/chart/${genreId}/tracks`, {
    params: { limit, index },
    timeout: 8000,
  });
  return response.data?.data || [];
}

async function fetchSearch(query, limit = 20, index = 0) {
  const response = await axios.get(`${DEEZER_API}/search`, {
    params: { q: query, limit, index },
    timeout: 8000,
  });
  return response.data?.data || [];
}

/**
 * Search Deezer for music tracks.
 * Falls back to a genre chart when the query matches a known mood chip.
 */
async function searchMusic(query = '', page = 1, perPage = 20) {
  const index = (page - 1) * perPage;
  const q = String(query || '').trim().toLowerCase();
  const genreId = GENRE_MAP[q];

  let hits = [];
  if (!q || (genreId && CHART_GENRES.has(genreId))) {
    hits = await fetchChart(genreId || 0, Math.min(perPage, 25), index);
  } else if (genreId) {
    // Non-chart genre chip → search by the chip name for real results
    hits = await fetchSearch(q, Math.min(perPage, 25), index);
    if (!hits.length) hits = await fetchChart(0, Math.min(perPage, 25), index);
  } else {
    hits = await fetchSearch(query.trim(), Math.min(perPage, 25), index);
  }

  const tracks = hits.map(normalizeTrack).filter(Boolean);
  return {
    tracks,
    total: tracks.length,
    totalPages: 1,
    page,
  };
}

/**
 * Trending recommendations for the Create-reel "Use popular music" shelf.
 * Backed by Deezer's live charts (optionally genre-scoped). Never fabricates
 * rankings — an empty/failed upstream returns an empty list, not fake rows.
 */
async function getTrending({ genre = null, limit = 4 } = {}) {
  const capped = Math.min(Math.max(parseInt(limit, 10) || 4, 1), 25);
  const key = String(genre || '').trim().toLowerCase();
  const genreId = key ? (GENRE_MAP[key] ?? null) : null;

  let hits;
  if (key && genreId == null) {
    // Unknown chip → text search on the category (still real data)
    hits = await fetchSearch(key, capped, 0);
  } else {
    hits = await fetchChart(genreId ?? 0, capped, 0);
  }
  return hits.map(normalizeTrack).filter(Boolean);
}

/** Category chips for the music discovery page (stable order for the UI). */
function getCategories() {
  return CATEGORY_LIST.map((name) => ({
    id: name.toLowerCase(),
    label: name,
  }));
}

module.exports = { searchMusic, getTrending, getCategories, CATEGORY_LIST };
