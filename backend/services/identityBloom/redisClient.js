'use strict';

const IORedis = require('ioredis');
const { Redis: UpstashRedis } = require('@upstash/redis');
const logger = require('../../utils/logger');

const PROVIDER_COOLDOWN_MS = 30000;

class RedisProviderError extends Error {
    constructor(message, cause) {
        super(message);
        this.name = 'RedisProviderError';
        this.cause = cause;
        this.retryable = true;
    }
}

function normalizeUrl(value) {
    if (typeof value !== 'string') return '';
    return value.trim().replace(/^"|"$/g, '');
}

function targetHost(url) {
    try {
        return new URL(url).hostname.toLowerCase();
    } catch (_) {
        return '';
    }
}

function buildTcpProvider(label, url) {
    let client = null;
    let readyPromise = null;

    const getClient = () => {
        if (client) return client;
        client = new IORedis(url, {
            connectTimeout: 8000,
            maxRetriesPerRequest: 1,
            retryStrategy: (times) => Math.min(times * 500, 15000),
            tls: url.startsWith('rediss://') ? {} : undefined,
            lazyConnect: false
        });
        client.on('error', (err) => {
            logger.warn(`[IdentityBloom] Redis TCP provider ${label} error: ${err.message}`);
        });
        return client;
    };

    const ensureReady = async () => {
        const io = getClient();
        if (io.status === 'ready') return io;
        if (!readyPromise) {
            readyPromise = new Promise((resolve, reject) => {
                const onReady = () => { cleanup(); resolve(io); };
                const onError = (err) => { cleanup(); reject(err); };
                const timer = setTimeout(() => { cleanup(); reject(new Error('redis connect timeout')); }, 10000);
                const cleanup = () => {
                    clearTimeout(timer);
                    io.off('ready', onReady);
                    io.off('error', onError);
                };
                io.once('ready', onReady);
                io.once('error', onError);
            }).finally(() => { readyPromise = null; });
        }
        await readyPromise;
        return io;
    };

    return {
        label,
        kind: 'tcp',
        target: targetHost(url),
        async eval(script, keys, args) {
            const io = await ensureReady();
            const flat = [script, String(keys.length), ...keys, ...args.map((a) => String(a))];
            return io.eval(...flat);
        },
        async get(key) {
            const io = await ensureReady();
            return io.get(key);
        },
        async set(key, value) {
            const io = await ensureReady();
            return io.set(key, String(value));
        },
        async del(keys) {
            const io = await ensureReady();
            const list = Array.isArray(keys) ? keys : [keys];
            return io.del(...list);
        },
        async ping() {
            const io = await ensureReady();
            return io.ping();
        },
        close() {
            if (client) {
                try { client.disconnect(); } catch (_) { /* ignore */ }
                client = null;
            }
        }
    };
}

function buildRestProvider(label, url, token) {
    let client = null;
    const getClient = () => {
        if (!client) {
            client = new UpstashRedis({ url, token });
        }
        return client;
    };
    return {
        label,
        kind: 'rest',
        target: targetHost(url),
        async eval(script, keys, args) {
            return getClient().eval(script, keys, args.map((a) => String(a)));
        },
        async get(key) {
            return getClient().get(key);
        },
        async set(key, value) {
            return getClient().set(key, String(value));
        },
        async del(keys) {
            const list = Array.isArray(keys) ? keys : [keys];
            return getClient().del(...list);
        },
        async ping() {
            return getClient().ping();
        },
        close() {
            client = null;
        }
    };
}

function discoverProviders() {
    const providers = [];
    const explicit = normalizeUrl(process.env.SPARKLE_IDENTITY_BLOOM_REDIS_URL);
    const cacheUrl = normalizeUrl(process.env.REDIS_CACHE_URL);
    const redisUrl = normalizeUrl(process.env.REDIS_URL);
    const restUrl = normalizeUrl(process.env.UPSTASH_REDIS_REST_URL);
    const restToken = normalizeUrl(process.env.UPSTASH_REDIS_REST_TOKEN);

    if (explicit) {
        providers.push(buildTcpProvider('identity-bloom-override', explicit));
        return providers;
    }

    const seen = new Set();
    const pushTcp = (label, url) => {
        if (!url || seen.has(url)) return;
        seen.add(url);
        providers.push(buildTcpProvider(label, url));
    };

    pushTcp('redis-cache', cacheUrl);
    pushTcp('redis-url', redisUrl);

    if (restUrl && restToken && !seen.has(restUrl)) {
        seen.add(restUrl);
        providers.push(buildRestProvider('upstash-rest', restUrl, restToken));
    }

    return providers;
}

class IdentityBloomRedisClient {
    constructor() {
        this.providers = [];
        this.activeIndex = -1;
        this.cooldownUntil = new Map();
        this.initialized = false;
        this.lastError = null;
    }

    initialize() {
        if (this.initialized) return;
        this.initialized = true;
        this.providers = discoverProviders();
        this.activeIndex = this.providers.length > 0 ? 0 : -1;
        if (this.providers.length === 0) {
            logger.warn('[IdentityBloom] No Redis provider configured - identity bloom filter stays disabled.');
        } else {
            logger.info(`[IdentityBloom] Redis providers available: ${this.providers.map((p) => p.label).join(', ')}`);
        }
    }

    isConfigured() {
        this.initialize();
        return this.providers.length > 0;
    }

    getActiveProvider() {
        this.initialize();
        if (this.activeIndex >= 0 && this.activeIndex < this.providers.length) {
            const cooldown = this.cooldownUntil.get(this.activeIndex) || 0;
            if (cooldown <= Date.now()) return this.providers[this.activeIndex];
        }
        for (let i = 0; i < this.providers.length; i++) {
            const cooldown = this.cooldownUntil.get(i) || 0;
            if (cooldown > Date.now()) continue;
            this.activeIndex = i;
            return this.providers[i];
        }
        if (this.activeIndex >= 0 && this.activeIndex < this.providers.length) {
            return this.providers[this.activeIndex];
        }
        return null;
    }

    markProviderFailure(index) {
        this.cooldownUntil.set(index, Date.now() + PROVIDER_COOLDOWN_MS);
    }

    async withTimeout(promise, timeoutMs, label) {
        const effectiveTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 5000;
        let timer = null;
        try {
            return await Promise.race([
                promise,
                new Promise((_, reject) => {
                    timer = setTimeout(() => reject(new RedisProviderError(`Redis ${label} timed out after ${effectiveTimeout}ms`)), effectiveTimeout);
                    if (typeof timer.unref === 'function') timer.unref();
                })
            ]);
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    async run(operation, timeoutMs) {
        this.initialize();
        const primary = this.getActiveProvider();
        if (!primary) throw new RedisProviderError('No Redis provider available');

        const candidates = this.providers.filter((provider) => provider.target === primary.target);
        let lastError = null;

        for (const provider of candidates) {
            const index = this.providers.indexOf(provider);
            if (provider !== primary && (this.cooldownUntil.get(index) || 0) > Date.now()) continue;
            try {
                const result = await this.withTimeout(operation(provider), timeoutMs, provider.label);
                this.lastError = null;
                this.activeIndex = index;
                return result;
            } catch (error) {
                lastError = error;
                this.lastError = error.message;
                this.markProviderFailure(index);
                logger.warn(`[IdentityBloom] Redis operation failed on ${provider.label}: ${error.message}`);
            }
        }

        throw lastError || new RedisProviderError('No Redis provider available');
    }

    eval(script, keys, args, timeoutMs) {
        return this.run((provider) => provider.eval(script, keys, args), timeoutMs);
    }

    get(key, timeoutMs) {
        return this.run((provider) => provider.get(key), timeoutMs);
    }

    set(key, value, timeoutMs) {
        return this.run((provider) => provider.set(key, value), timeoutMs);
    }

    del(keys, timeoutMs) {
        const list = Array.isArray(keys) ? keys : [keys];
        return this.run((provider) => provider.del(list), timeoutMs);
    }

    ping(timeoutMs) {
        return this.run((provider) => provider.ping(), timeoutMs);
    }

    getHealth() {
        this.initialize();
        return {
            configured: this.providers.length > 0,
            activeProvider: this.activeIndex >= 0 && this.providers[this.activeIndex]
                ? this.providers[this.activeIndex].label
                : null,
            providers: this.providers.map((p) => p.label),
            lastError: this.lastError
        };
    }

    close() {
        for (const provider of this.providers) {
            try { provider.close(); } catch (_) { /* ignore */ }
        }
        this.providers = [];
        this.activeIndex = -1;
        this.initialized = false;
    }
}

module.exports = new IdentityBloomRedisClient();
module.exports.RedisProviderError = RedisProviderError;
