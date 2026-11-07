'use strict';

const KEY_PREFIX = 'sparkle:identity:bloom';

const DEFAULT_CAPACITY = 1000000;
const DEFAULT_ERROR_RATE = 0.001;
const DEFAULT_VERSION = 'v1';
const DEFAULT_TIMEOUT_MS = 1500;
const DEFAULT_VERSION_CACHE_TTL_MS = 10000;
const DEFAULT_PENDING_TTL_MS = 15 * 60 * 1000;

const MIN_CAPACITY = 1000;
const MAX_CAPACITY = 50000000;
const MIN_ERROR_RATE = 0.000001;
const MAX_ERROR_RATE = 0.1;

function readInt(name, fallback, min, max) {
    const raw = process.env[name];
    if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
    const parsed = Number.parseInt(String(raw), 10);
    if (!Number.isFinite(parsed)) return fallback;
    if (min !== undefined && parsed < min) return min;
    if (max !== undefined && parsed > max) return max;
    return parsed;
}

function readFloat(name, fallback, min, max) {
    const raw = process.env[name];
    if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
    const parsed = Number.parseFloat(String(raw));
    if (!Number.isFinite(parsed)) return fallback;
    if (min !== undefined && parsed < min) return min;
    if (max !== undefined && parsed > max) return max;
    return parsed;
}

function getBloomGeometry(capacity, errorRate) {
    const n = capacity;
    const p = errorRate;
    const ln2 = Math.LN2;
    const bits = Math.ceil(-(n * Math.log(p)) / (ln2 * ln2));
    const hashCount = Math.max(1, Math.round((bits / n) * ln2));
    return {
        capacity: n,
        errorRate: p,
        bits,
        hashCount,
        byteLength: Math.ceil(bits / 8)
    };
}

function getConfig() {
    const capacity = readInt('SPARKLE_IDENTITY_BLOOM_CAPACITY', DEFAULT_CAPACITY, MIN_CAPACITY, MAX_CAPACITY);
    const errorRate = readFloat('SPARKLE_IDENTITY_BLOOM_ERROR_RATE', DEFAULT_ERROR_RATE, MIN_ERROR_RATE, MAX_ERROR_RATE);
    const geometry = getBloomGeometry(capacity, errorRate);
    return {
        keyPrefix: KEY_PREFIX,
        configuredVersion: (process.env.SPARKLE_IDENTITY_BLOOM_VERSION || DEFAULT_VERSION).trim() || DEFAULT_VERSION,
        capacity,
        errorRate,
        bits: geometry.bits,
        hashCount: geometry.hashCount,
        byteLength: geometry.byteLength,
        timeoutMs: readInt('SPARKLE_IDENTITY_BLOOM_TIMEOUT_MS', DEFAULT_TIMEOUT_MS, 100, 30000),
        versionCacheTtlMs: readInt('SPARKLE_IDENTITY_BLOOM_VERSION_TTL_MS', DEFAULT_VERSION_CACHE_TTL_MS, 1000, 600000),
        pendingTtlMs: readInt('SPARKLE_IDENTITY_BLOOM_PENDING_TTL_MS', DEFAULT_PENDING_TTL_MS, 60000, 24 * 60 * 60 * 1000),
        workerIntervalMs: readInt('SPARKLE_IDENTITY_BLOOM_WORKER_INTERVAL_MS', 5000, 1000, 600000),
        workerBatchSize: readInt('SPARKLE_IDENTITY_BLOOM_WORKER_BATCH_SIZE', 100, 1, 1000),
        workerMaxAttempts: readInt('SPARKLE_IDENTITY_BLOOM_WORKER_MAX_ATTEMPTS', 12, 1, 100),
        rebuildBatchSize: readInt('SPARKLE_IDENTITY_BLOOM_REBUILD_BATCH_SIZE', 250, 1, 5000)
    };
}

function filterBitsKey(identityType, version) {
    return `${KEY_PREFIX}:${identityType}:${version}`;
}

function filterReadyKey(identityType, version) {
    return `${KEY_PREFIX}:${identityType}:${version}:ready`;
}

function filterMetaKey(identityType, version) {
    return `${KEY_PREFIX}:${identityType}:${version}:meta`;
}

function pendingKey(identityType) {
    return `${KEY_PREFIX}:pending:${identityType}`;
}

function activeVersionKey() {
    return `${KEY_PREFIX}:active`;
}

function rebuildProgressKey(version) {
    return `${KEY_PREFIX}:rebuild:${version}`;
}

module.exports = {
    KEY_PREFIX,
    DEFAULT_CAPACITY,
    DEFAULT_ERROR_RATE,
    DEFAULT_VERSION,
    getBloomGeometry,
    getConfig,
    filterBitsKey,
    filterReadyKey,
    filterMetaKey,
    pendingKey,
    activeVersionKey,
    rebuildProgressKey
};
