/**
 * feedShuffle.js
 * Deterministic seeded shuffle for feed diversity.
 *
 * Same ranked pool → different order per device → no extra DB work.
 * Algorithm: mulberry32 PRNG (fast, portable, reproducible)
 */

/**
 * Fast seedable pseudo-random number generator (mulberry32).
 * Returns a float in [0, 1) for a given seed + index.
 */
function seededRandom(seed, index) {
    let t = (seed + index) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Deterministic Fisher-Yates shuffle with a given seed.
 * The shuffle intensity (0–1) controls how much the array is permuted:
 *   0   = no shuffle (stable original order)
 *   0.5 = moderate shuffle
 *   1.0 = full shuffle
 */
function shuffleWithSeed(array, seed, intensity = 1.0) {
    if (!array || array.length === 0) return array;
    const result = [...array];
    const swapCount = Math.floor(result.length * intensity);

    for (let i = result.length - 1; i > result.length - 1 - swapCount; i--) {
        const j = Math.floor(seededRandom(seed, i) * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/**
 * Banded seeded shuffle.
 *
 * Splits posts into quality tiers based on discovery_score, applies
 * different shuffle intensities per tier, then reassembles.
 *
 *   Top tier  (score ≥ 0.7): light shuffle   — best posts stay near top
 *   Mid tier  (score ≥ 0.4): moderate shuffle — variety in the middle
 *   Low tier  (score  < 0.4): heavy shuffle   — exploration zone
 *
 * @param {Array} posts  - Ranked posts from DB (already have discovery_score)
 * @param {number} seed  - Stable device seed (hash of userId+deviceId)
 * @returns {Array}      - Shuffled posts
 */
function bandedSeededShuffle(posts, seed) {
    if (!posts || posts.length === 0) return posts;

    const top = posts.filter(p => (p.discovery_score || 0) >= 0.7);
    const mid = posts.filter(p => (p.discovery_score || 0) >= 0.4 && (p.discovery_score || 0) < 0.7);
    const low = posts.filter(p => (p.discovery_score || 0) < 0.4);

    return [
        ...shuffleWithSeed(top, seed, 0.15),   // top posts barely move
        ...shuffleWithSeed(mid, seed + 1000, 0.40),
        ...shuffleWithSeed(low, seed + 2000, 0.80),
    ];
}

/**
 * Generate a stable numeric seed from a userId + deviceId string.
 * Same input → always same number. No randomness here.
 */
function deviceSeedFromIds(userId = '', deviceId = '') {
    const str = `${userId}:${deviceId}`;
    let hash = 2166136261; // FNV-1a 32-bit offset basis
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash;
}

module.exports = { bandedSeededShuffle, deviceSeedFromIds, shuffleWithSeed };
