// services/cache.service.js
// Unified caching layer: uses Redis (via redis.service) when available,
// falls back to a TTL-aware in-memory Map otherwise.

const logger = require('../utils/logger');

// ── Configurable TTLs ────────────────────────────────────────────────────────
const DISCOVER_TTL = parseInt(process.env.DISCOVER_CACHE_TTL, 10) || 60; // seconds

// ── In-memory fallback store ─────────────────────────────────────────────────
const memStore = new Map();

function memGet(key) {
    const entry = memStore.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
        memStore.delete(key);
        return null;
    }
    return entry.value;
}

function memSet(key, value, ttlSeconds) {
    memStore.set(key, {
        value,
        expiry: Date.now() + (ttlSeconds * 1000)
    });
}

function memDel(key) {
    memStore.delete(key);
}

// ── Lazy-load Redis so the module can be required even when Redis is off ─────
let _redis = null;
function getRedis() {
    if (_redis === null) {
        _redis = require('./redis.service');
    }
    return _redis;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Read-through cache helper.
 * 1. Try cache (Redis → memory fallback).
 * 2. On miss, call `loaderFn()`, cache the result, and return it.
 *
 * @param {string}   key       Cache key
 * @param {number}   ttl       TTL in seconds
 * @param {Function} loaderFn  Async function that produces the value on cache miss
 * @returns {Promise<*>}
 */
async function getOrSet(key, ttl, loaderFn) {
    // 1. Try Redis
    const redis = getRedis();
    if (redis && redis.isEnabled) {
        try {
            const cached = await redis.get(key);
            if (cached !== null && cached !== undefined) {
                // Upstash REST client auto-deserialises JSON, so cached may already be an object
                return typeof cached === 'string' ? safeParse(cached) : cached;
            }
        } catch (e) {
            logger.warn(`[CacheService] Redis GET failed for ${key}: ${e.message}`);
        }
    }

    // 2. Try in-memory fallback
    const memCached = memGet(key);
    if (memCached !== null) {
        return memCached;
    }

    // 3. Cache miss — run loader
    const value = await loaderFn();

    // 4. Store in both layers
    if (value !== null && value !== undefined) {
        // Redis (fire-and-forget)
        if (redis && redis.isEnabled) {
            redis.set(key, JSON.stringify(value), ttl).catch(e =>
                logger.warn(`[CacheService] Redis SET failed for ${key}: ${e.message}`)
            );
        }
        // In-memory (always)
        memSet(key, value, ttl);
    }

    return value;
}

/**
 * Explicitly set a value in both cache layers.
 */
async function set(key, value, ttl) {
    const redis = getRedis();
    if (redis && redis.isEnabled) {
        redis.set(key, JSON.stringify(value), ttl).catch(e =>
            logger.warn(`[CacheService] Redis SET failed for ${key}: ${e.message}`)
        );
    }
    memSet(key, value, ttl);
}

/**
 * Explicitly get a value from cache (Redis → memory fallback).
 */
async function get(key) {
    const redis = getRedis();
    if (redis && redis.isEnabled) {
        try {
            const cached = await redis.get(key);
            if (cached !== null && cached !== undefined) {
                return typeof cached === 'string' ? safeParse(cached) : cached;
            }
        } catch (_) { logger.debug('redis get failed for ' + key + '; falling through to memory cache'); }
    }
    return memGet(key);
}

/**
 * Invalidate a key in both layers.
 */
async function del(key) {
    const redis = getRedis();
    if (redis && redis.isEnabled) {
        redis.del(key).catch(() => {});
    }
    memDel(key);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function safeParse(val) {
    if (!val) return null;
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch { return val; }
}

module.exports = {
    getOrSet,
    get,
    set,
    del,
    DISCOVER_TTL
};
