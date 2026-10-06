const { Redis } = require('@upstash/redis');
const logger = require('../utils/logger');
const dns = require('dns');

// Force IPv4 resolution to fix Node 18+ "fetch failed" issues with Upstash
dns.setDefaultResultOrder('ipv4first');

// ── L1 in-process write-through cache ──────────────────────────────────────────
// Upstash REST costs ~450-800ms per round-trip from this server. A short-lived
// in-process cache removes that floor for hot keys:
//   * get/mget results are cached for REDIS_L1_TTL_MS (default 3s)
//   * set() writes THROUGH to L1 (so read-after-write in this process is instant)
//   * every mutator (del/incr/sadd/hset/lpush/ltrim) invalidates its key
// TTL is intentionally tiny: with multiple instances, other nodes' writes are
// invisible to this map for at most the TTL. Set REDIS_L1_TTL_MS=0 to disable.
const L1_DEFAULT_TTL_MS = 3000;
const L1_MAX_ENTRIES = 5000;

/**
 * Production-ready Redis Service using Upstash REST Client.
 * Handles caching, OTP storage, and session persistence with graceful fallbacks.
 */
class RedisService {
    constructor() {
        this.client = null;
        this.isEnabled = false;
        this.l1 = new Map();        // l1Key -> { v, exp }
        this.l1Deps = new Map();    // baseKey -> Set<l1Key> (for targeted invalidation)
        const ttl = Number(process.env.REDIS_L1_TTL_MS);
        this.l1TtlMs = Number.isFinite(ttl) ? ttl : L1_DEFAULT_TTL_MS;
        this.initialize();
    }

    initialize() {
        // Enable Redis if ENABLE_REDIS_CACHE is true, regardless of DISABLE_QUEUE which only disables queue workers
        const enableCache = process.env.ENABLE_REDIS_CACHE === 'true';
        if (!enableCache) {
            logger.warn('Redis Service: Caching disabled via ENABLE_REDIS_CACHE flag.');
            this.isEnabled = false;
            this.client = null;
            return;
        }

        if (process.env.DISABLE_QUEUE === 'true') {
            logger.warn('Redis Service: Disabled via DISABLE_QUEUE flag.');
            this.isEnabled = false;
            this.client = null;
            return;
        }
        try {
            const url = process.env.UPSTASH_REDIS_REST_URL;
            const token = process.env.UPSTASH_REDIS_REST_TOKEN;

            if (!url || !token) {
                logger.warn('Redis Service: UPSTASH_REDIS_REST_URL or TOKEN missing. Redis is DISABLED.');
                this.isEnabled = false;
                this.client = null;
                return;
            }

            try {
                this.client = new Redis({
                    url: url,
                    token: token,
                });
                this.isEnabled = true;
                logger.info(`Redis Service: Initialized successfully (REST API, L1 ${this.l1TtlMs}ms)`);
            } catch (err) {
                logger.error('Redis Service: Initialization failed (likely allowlist issue):', err.message);
                this.isEnabled = false;
                this.client = null;
            }
        } catch (error) {
            logger.error('Redis Service: Initialization failed:', error);
            this.isEnabled = false;
        }
    }

    // ── L1 helpers ───────────────────────────────────────────────────────────

    /** Fresh L1 value or undefined (miss). */
    _l1Read(l1k) {
        if (this.l1TtlMs <= 0) return undefined;
        const e = this.l1.get(l1k);
        if (!e || e.exp <= Date.now()) return undefined;
        return e.v;
    }

    /** Value even if expired (used as stale fallback when Upstash is unreachable). */
    _l1Stale(l1k) {
        if (this.l1TtlMs <= 0) return undefined;
        const e = this.l1.get(l1k);
        return e ? e.v : undefined;
    }

    _l1Write(l1k, baseKey, v) {
        if (this.l1TtlMs <= 0 || v === undefined) return;
        if (this.l1.size >= L1_MAX_ENTRIES) this._l1Prune();
        this.l1.set(l1k, { v, exp: Date.now() + this.l1TtlMs });
        let s = this.l1Deps.get(baseKey);
        if (!s) this.l1Deps.set(baseKey, (s = new Set()));
        s.add(l1k);
    }

    _l1Invalidate(baseKey) {
        if (this.l1TtlMs <= 0) return;
        const s = this.l1Deps.get(baseKey);
        if (s) {
            for (const k of s) this.l1.delete(k);
            this.l1Deps.delete(baseKey);
        }
        this.l1.delete(baseKey);
    }

    _l1Prune() {
        const now = Date.now();
        for (const [k, e] of this.l1) {
            if (e.exp <= now) this.l1.delete(k);
        }
        if (this.l1.size >= L1_MAX_ENTRIES) {
            // Hard cap: correctness is preserved (cold reads repopulate).
            this.l1.clear();
            this.l1Deps.clear();
        }
    }

    // ── Public API ───────────────────────────────────────────────────────────

    /**
     * Get a value from Redis
     */
    async get(key) {
        if (!this.isEnabled) return null;
        const fresh = this._l1Read(key);
        if (fresh !== undefined) return fresh;
        try {
            const val = await this.client.get(key);
            this._l1Write(key, key, val);
            return val;
        } catch (error) {
            logger.error(`Redis Get Error [${key}]:`, error.message);
            const stale = this._l1Stale(key);
            return stale !== undefined ? stale : null;
        }
    }

    /**
     * Get multiple values from Redis (Optimized Batching)
     */
    async mget(...keys) {
        if (!this.isEnabled) return keys.map(() => null);
        const cached = keys.map(k => this._l1Read(k));
        if (cached.every(v => v !== undefined)) return cached;
        try {
            const vals = await this.client.mget(...keys);
            const arr = Array.isArray(vals) ? vals : [vals];
            keys.forEach((k, i) => this._l1Write(k, k, arr[i]));
            return keys.map((k, i) => (arr[i] !== undefined ? arr[i] : null));
        } catch (error) {
            logger.error(`Redis MGet Error [${keys.length} keys]:`, error.message);
            return keys.map(k => {
                const stale = this._l1Stale(k);
                return stale !== undefined ? stale : null;
            });
        }
    }

    /**
     * Set a value in Redis with optional TTL (seconds) and options (like NX)
     */
    async set(key, value, ttlOrOptions = null, maybeNx = null) {
        if (!this.isEnabled) return "DISABLED"; // Return truthy so locks don't fail when disabled
        try {
            let options = {};
            if (typeof ttlOrOptions === 'number') {
                options.ex = ttlOrOptions;
            } else if (ttlOrOptions && typeof ttlOrOptions === 'object') {
                options = ttlOrOptions;
            }

            if (maybeNx === 'NX' || (ttlOrOptions === 'NX')) {
                options.nx = true;
            }

            const res = await this.client.set(key, value, options);
            // Truthy res ("OK") = write committed (NX success included);
            // NX failure returns null/undefined — leave L1 untouched.
            if (res) {
                this._l1Invalidate(key);
                this._l1Write(key, key, value);
            }
            return res;
        } catch (error) {
            const msg = error.message || (typeof error === 'string' ? error : JSON.stringify(error));
            logger.error(`Redis Set Error [${key}]: ${msg}`);
            return null;
        }
    }

    /**
     * Delete a key
     */
    async del(key) {
        if (!this.isEnabled) return null;
        this._l1Invalidate(key);
        try {
            return await this.client.del(key);
        } catch (error) {
            logger.error(`Redis Del Error [${key}]:`, error.message);
            return null;
        }
    }

    /**
     * Increment a value (useful for rate limiting)
     */
    async incr(key) {
        if (!this.isEnabled) return 0;
        this._l1Invalidate(key);
        try {
            return await this.client.incr(key);
        } catch (error) {
            logger.error(`Redis Incr Error [${key}]:`, error.message);
            return 0;
        }
    }

    /**
     * Set expiration on a key
     */
    async expire(key, seconds) {
        if (!this.isEnabled) return null;
        try {
            return await this.client.expire(key, seconds);
        } catch (error) {
            logger.error(`Redis Expire Error [${key}]:`, error.message);
            return null;
        }
    }
    /**
     * Add to a Set (for seen videos)
     */
    async sadd(key, ...members) {
        if (!this.isEnabled) return 0;
        // Set membership changed: any cached smembers/list view of this key is stale.
        this._l1Invalidate(key);
        try {
            return await this.client.sadd(key, ...members);
        } catch (error) {
            logger.error(`Redis SAdd Error [${key}]:`, error.message);
            return 0;
        }
    }

    /**
     * Get all members of a Set
     */
    async smembers(key) {
        if (!this.isEnabled) return [];
        const l1k = `smembers:${key}`;
        const fresh = this._l1Read(l1k);
        if (fresh !== undefined) return fresh;
        try {
            const val = await this.client.smembers(key);
            this._l1Write(l1k, key, val);
            return val;
        } catch (error) {
            logger.error(`Redis SMembers Error [${key}]:`, error.message);
            const stale = this._l1Stale(l1k);
            return stale !== undefined ? stale : [];
        }
    }

    /**
     * Hash Operations
     */
    async hgetall(key) {
        if (!this.isEnabled) return null;
        const l1k = `hgetall:${key}`;
        const fresh = this._l1Read(l1k);
        if (fresh !== undefined) return fresh;
        try {
            const val = await this.client.hgetall(key);
            this._l1Write(l1k, key, val);
            return val;
        } catch (error) {
            logger.error(`Redis HGetAll Error [${key}]:`, error.message);
            const stale = this._l1Stale(l1k);
            return stale !== undefined ? stale : null;
        }
    }

    async hincrbyfloat(key, field, value) {
        if (!this.isEnabled) return 0;
        this._l1Invalidate(key);
        try {
            return await this.client.hincrbyfloat(key, field, value);
        } catch (error) {
            logger.error(`Redis HIncrByFloat Error [${key}][${field}]:`, error.message);
            return 0;
        }
    }

    async hset(key, field, value) {
        if (!this.isEnabled) return null;
        this._l1Invalidate(key);
        try {
            // Upstash hset takes an object or multiple field/value arguments.
            // Using object format: { [field]: value }
            return await this.client.hset(key, { [field]: value });
        } catch (error) {
            logger.error(`Redis HSet Error [${key}][${field}]:`, error.message);
            return null;
        }
    }


    /**
     * List Operations
     */
    async lpush(key, ...members) {
        if (!this.isEnabled) return 0;
        this._l1Invalidate(key);
        try {
            return await this.client.lpush(key, ...members);
        } catch (error) {
            logger.error(`Redis LPush Error [${key}]:`, error.message);
            return 0;
        }
    }

    async lrange(key, start, stop) {
        if (!this.isEnabled) return [];
        const l1k = `lrange:${key}:${start}:${stop}`;
        const fresh = this._l1Read(l1k);
        if (fresh !== undefined) return fresh;
        try {
            const val = await this.client.lrange(key, start, stop);
            this._l1Write(l1k, key, val);
            return val;
        } catch (error) {
            logger.error(`Redis LRange Error [${key}]:`, error.message);
            const stale = this._l1Stale(l1k);
            return stale !== undefined ? stale : [];
        }
    }

    async ltrim(key, start, stop) {
        if (!this.isEnabled) return null;
        this._l1Invalidate(key);
        try {
            return await this.client.ltrim(key, start, stop);
        } catch (error) {
            logger.error(`Redis LTrim Error [${key}]:`, error.message);
            return null;
        }
    }
}

// Export a singleton instance
module.exports = new RedisService();
