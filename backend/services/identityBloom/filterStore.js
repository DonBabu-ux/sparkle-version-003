'use strict';

const crypto = require('crypto');
const {
    getConfig,
    filterBitsKey,
    filterReadyKey,
    filterMetaKey,
    pendingKey,
    activeVersionKey,
    rebuildProgressKey
} = require('./config');
const { derivePositions, buildReadyToken } = require('./geometry');
const scripts = require('./luaScripts');
const redisClient = require('./redisClient');
const metrics = require('./metrics');
const logger = require('../../utils/logger');
const {
    createIdentityHmac,
    getIdentityHmacFingerprint,
    isIdentityHmacConfigured,
    assertIdentityType,
    normalizeUsername,
    normalizeEmail
} = require('../../utils/identity/identity');

const PROBE_STATE = Object.freeze({
    ABSENT: 'absent',
    PRESENT: 'present',
    PENDING: 'pending',
    NOT_READY: 'not_ready',
    HMAC_MISMATCH: 'hmac_mismatch',
    UNAVAILABLE: 'unavailable'
});

let versionCache = { at: 0, versions: null };
let readinessCache = { username: false, email: false, checkedAt: 0 };

async function resolveActiveVersions(force = false) {
    const config = getConfig();
    const now = Date.now();
    if (!force && versionCache.versions && now - versionCache.at < config.versionCacheTtlMs) {
        return versionCache.versions;
    }

    const versions = {
        username: config.configuredVersion,
        email: config.configuredVersion,
        previousUsername: null,
        previousEmail: null,
        switchedAt: 0
    };

    try {
        const raw = await redisClient.get(activeVersionKey(), config.timeoutMs);
        if (raw) {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (parsed && typeof parsed.username === 'string' && typeof parsed.email === 'string') {
                versions.username = parsed.username;
                versions.email = parsed.email;
                if (typeof parsed.previous_username === 'string') versions.previousUsername = parsed.previous_username;
                if (typeof parsed.previous_email === 'string') versions.previousEmail = parsed.previous_email;
                if (Number.isFinite(Number(parsed.switched_at))) versions.switchedAt = Number(parsed.switched_at);
            }
        }
    } catch (error) {
        metrics.increment('redisErrors');
        logger.warn(`[IdentityBloom] Could not read active filter version: ${error.message}`);
    }

    versionCache = { at: now, versions };
    return versions;
}

function invalidateVersionCache() {
    versionCache = { at: 0, versions: null };
}

function canonicalize(identityType, rawValue) {
    return identityType === 'username' ? normalizeUsername(rawValue) : normalizeEmail(rawValue);
}

async function probeIdentity(identityType, normalizedValue, options = {}) {
    const type = assertIdentityType(identityType);
    const reserve = options.reserve === true;
    const config = getConfig();

    if (!isIdentityHmacConfigured()) {
        metrics.increment('filterNotReady');
        return { state: PROBE_STATE.UNAVAILABLE, reason: 'hmac_not_configured', hmac: null, positions: null };
    }

    let hmac;
    let positions;
    try {
        const canonical = canonicalize(type, normalizedValue);
        hmac = createIdentityHmac(type, canonical);
        positions = derivePositions(hmac, config.bits, config.hashCount);
    } catch (error) {
        metrics.increment('filterNotReady');
        return { state: PROBE_STATE.UNAVAILABLE, reason: error.message, hmac: null, positions: null };
    }

    const versions = await resolveActiveVersions();
    const version = versions[type];
    const readyToken = buildReadyToken(getIdentityHmacFingerprint(), config.bits, config.hashCount);
    const keys = [
        filterReadyKey(type, version),
        filterBitsKey(type, version),
        pendingKey(type)
    ];
    const args = [
        readyToken,
        String(config.hashCount),
        ...positions.map(String),
        hmac,
        reserve ? '1' : '0',
        String(config.pendingTtlMs),
        String(Date.now())
    ];

    const startedAt = Date.now();
    let result;
    try {
        result = await redisClient.eval(scripts.PROBE, keys, args, config.timeoutMs);
    } catch (error) {
        metrics.increment('redisErrors');
        metrics.increment('redisFallbacks');
        logger.warn(`[IdentityBloom] Probe failed for ${type} filter: ${error.message}`);
        return { state: PROBE_STATE.UNAVAILABLE, reason: 'redis_error', hmac, positions };
    }
    metrics.observeLatency('redisLatency', Date.now() - startedAt);

    const code = Array.isArray(result) ? Number(result[0]) : Number(result);
    const reserved = Array.isArray(result) ? Number(result[1]) === 1 : false;

    if (code === -1) {
        metrics.increment('filterNotReady');
        readinessCache[type] = false;
        return { state: PROBE_STATE.NOT_READY, reason: 'filter_not_ready', version, hmac, positions };
    }
    if (code === -2) {
        metrics.increment('hmacMismatch');
        readinessCache[type] = false;
        logger.error('[IdentityBloom] HMAC fingerprint mismatch - filter geometry or secret does not match this instance.');
        return { state: PROBE_STATE.HMAC_MISMATCH, reason: 'hmac_or_geometry_mismatch', version, hmac, positions };
    }

    readinessCache[type] = true;

    if (code === 0) {
        metrics.increment(type === 'username' ? 'usernameLookups' : 'emailLookups');
        metrics.increment('definitelyAbsent');
        return { state: PROBE_STATE.ABSENT, reserved, version, hmac, positions };
    }
    if (code === 2) {
        metrics.increment(type === 'username' ? 'usernameLookups' : 'emailLookups');
        metrics.increment('possiblyPresent');
        metrics.increment('pendingProtected');
        return { state: PROBE_STATE.PENDING, reserved, version, hmac, positions };
    }

    metrics.increment(type === 'username' ? 'usernameLookups' : 'emailLookups');
    metrics.increment('possiblyPresent');
    return { state: PROBE_STATE.PRESENT, reserved, version, hmac, positions };
}

async function probeBitsAtVersion(identityType, normalizedValue, version) {
    const type = assertIdentityType(identityType);
    const config = getConfig();
    if (!isIdentityHmacConfigured()) return false;
    const hmac = createIdentityHmac(type, normalizedValue);
    const positions = derivePositions(hmac, config.bits, config.hashCount);
    const result = await redisClient.eval(
        scripts.PROBE_BITS,
        [filterBitsKey(type, version)],
        [String(config.hashCount), ...positions.map(String)],
        Math.max(config.timeoutMs, 10000)
    );
    return Number(result) === 1;
}

async function insertIdentity(identityType, hmac, options = {}) {
    const type = assertIdentityType(identityType);
    const config = getConfig();
    const versions = await resolveActiveVersions(options.forceVersionRefresh === true);
    const targets = [{ version: versions[type], previous: false }];

    const graceMs = config.versionCacheTtlMs * 6;
    const previousVersion = type === 'username' ? versions.previousUsername : versions.previousEmail;
    if (previousVersion && versions.switchedAt && Date.now() - versions.switchedAt < graceMs) {
        targets.push({ version: previousVersion, previous: true });
    }

    const positions = derivePositions(hmac, config.bits, config.hashCount);

    for (const target of targets) {
        const keys = [filterBitsKey(type, target.version), pendingKey(type)];
        const args = [String(config.hashCount), ...positions.map(String), hmac];
        await redisClient.eval(scripts.INSERT, keys, args, config.timeoutMs);
    }

    return { version: versions[type], insertedVersions: targets.map((t) => t.version) };
}

async function insertIdentityBatch(identityType, version, hmacList) {
    const type = assertIdentityType(identityType);
    const config = getConfig();
    if (!Array.isArray(hmacList) || hmacList.length === 0) return 0;

    const positions = hmacList.map((hmac) => derivePositions(hmac, config.bits, config.hashCount));
    const args = [String(config.hashCount), String(positions.length)];
    for (const list of positions) {
        for (const position of list) args.push(String(position));
    }

    const result = await redisClient.eval(
        scripts.INSERT_BATCH,
        [filterBitsKey(type, version)],
        args,
        Math.max(config.timeoutMs, 10000)
    );
    return Number(result) || positions.length;
}

async function markPending(identityType, hmac) {
    const type = assertIdentityType(identityType);
    const config = getConfig();
    await redisClient.eval(
        scripts.MARK_PENDING,
        [pendingKey(type)],
        [hmac, String(Date.now())],
        config.timeoutMs
    );
}

async function markPendingBatch(entries) {
    const config = getConfig();
    const list = (entries || []).filter((e) => e && e.identityType && e.hmac);
    if (list.length === 0) return 0;

    const byType = new Map();
    for (const entry of list) {
        if (!byType.has(entry.identityType)) byType.set(entry.identityType, []);
        byType.get(entry.identityType).push(entry.hmac);
    }

    const keys = [];
    const args = [];
    for (const [type, hmacs] of byType.entries()) {
        keys.push(pendingKey(type));
        args.push(...hmacs);
    }
    args.push(String(Date.now()));

    await redisClient.eval(scripts.MARK_PENDING, keys, args, config.timeoutMs);
    return list.length;
}

async function setFilterReady(identityType, version, details = {}) {
    const type = assertIdentityType(identityType);
    const config = getConfig();
    const fingerprint = getIdentityHmacFingerprint();
    const readyToken = buildReadyToken(fingerprint, config.bits, config.hashCount);
    const meta = JSON.stringify({
        identityType: type,
        version,
        capacity: config.capacity,
        errorRate: config.errorRate,
        bits: config.bits,
        hashCount: config.hashCount,
        byteLength: config.byteLength,
        hmacFingerprint: fingerprint,
        populatedAt: new Date().toISOString(),
        sourceCount: details.sourceCount || 0,
        durationMs: details.durationMs || 0,
        buildId: details.buildId || crypto.randomUUID()
    });
    await redisClient.eval(
        scripts.SET_READY,
        [filterReadyKey(type, version), filterMetaKey(type, version)],
        [readyToken, meta],
        Math.max(config.timeoutMs, 10000)
    );
    return meta;
}

async function readFilterMeta(identityType, version) {
    const type = assertIdentityType(identityType);
    const config = getConfig();
    try {
        const raw = await redisClient.get(filterMetaKey(type, version), config.timeoutMs);
        if (!raw) return null;
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (error) {
        metrics.increment('redisErrors');
        return null;
    }
}

async function switchActiveVersion(next) {
    const payload = JSON.stringify({
        username: next.username,
        email: next.email,
        previous_username: next.previousUsername || null,
        previous_email: next.previousEmail || null,
        switched_at: Date.now()
    });
    await redisClient.eval(scripts.SET_ACTIVE_VERSION, [activeVersionKey()], [payload], 10000);
    invalidateVersionCache();
    return payload;
}

async function preallocateFilter(identityType, version) {
    const type = assertIdentityType(identityType);
    const config = getConfig();
    const result = await redisClient.eval(
        scripts.PREALLOCATE,
        [filterBitsKey(type, version)],
        [String(Math.max(0, config.byteLength - 1))],
        Math.max(config.timeoutMs, 10000)
    );
    return Number(result) || 0;
}

async function countFilterBits(identityType, version) {
    const type = assertIdentityType(identityType);
    const config = getConfig();
    const result = await redisClient.eval(
        scripts.COUNT_BITS,
        [filterBitsKey(type, version)],
        [],
        Math.max(config.timeoutMs, 10000)
    );
    return Number(result) || 0;
}

async function countPending(identityType) {
    const type = assertIdentityType(identityType);
    const config = getConfig();
    const result = await redisClient.eval(scripts.COUNT_PENDING, [pendingKey(type)], [], config.timeoutMs);
    return Number(result) || 0;
}

async function clearStalePending(identityType, olderThanMs) {
    const type = assertIdentityType(identityType);
    const config = getConfig();
    const cutoff = Date.now() - olderThanMs;
    const result = await redisClient.eval(
        scripts.CLEAR_OLD_PENDING,
        [pendingKey(type)],
        [String(cutoff)],
        config.timeoutMs
    );
    return Number(result) || 0;
}

async function setRebuildProgress(version, progress) {
    const config = getConfig();
    await redisClient.set(rebuildProgressKey(version), JSON.stringify(progress), Math.max(config.timeoutMs, 10000));
    metrics.setGauge('rebuildProgress', progress);
}

async function readRebuildProgress(version) {
    const config = getConfig();
    try {
        const raw = await redisClient.get(rebuildProgressKey(version), config.timeoutMs);
        if (!raw) return null;
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (error) {
        return null;
    }
}

function getReadinessSnapshot() {
    return { ...readinessCache };
}

module.exports = {
    PROBE_STATE,
    derivePositions,
    buildReadyToken,
    resolveActiveVersions,
    invalidateVersionCache,
    probeIdentity,
    probeBitsAtVersion,
    insertIdentity,
    insertIdentityBatch,
    markPending,
    markPendingBatch,
    setFilterReady,
    readFilterMeta,
    switchActiveVersion,
    preallocateFilter,
    countFilterBits,
    countPending,
    clearStalePending,
    setRebuildProgress,
    readRebuildProgress,
    getReadinessSnapshot
};
