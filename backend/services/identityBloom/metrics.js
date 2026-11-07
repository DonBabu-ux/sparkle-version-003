'use strict';

const counters = {
    usernameLookups: 0,
    emailLookups: 0,
    definitelyAbsent: 0,
    possiblyPresent: 0,
    pendingProtected: 0,
    mysqlSelectsAvoided: 0,
    mysqlVerifications: 0,
    falsePositives: 0,
    redisErrors: 0,
    redisFallbacks: 0,
    filterNotReady: 0,
    hmacMismatch: 0,
    duplicateKeyConflicts: 0,
    registrationLatencyTotalMs: 0,
    registrationLatencyCount: 0,
    registrationLatencyMaxMs: 0,
    redisLatencyTotalMs: 0,
    redisLatencyCount: 0,
    redisLatencyMaxMs: 0,
    outboxEnqueued: 0,
    outboxProcessed: 0,
    outboxFailed: 0,
    outboxRetried: 0,
    outboxSyncDelayTotalMs: 0,
    outboxSyncDelayCount: 0,
    rebuildDurationMs: 0,
    rebuildIdentities: 0,
    rebuildRuns: 0
};

const gauges = {
    outboxBacklog: 0,
    filterReady: false,
    activeUsernameVersion: null,
    activeEmailVersion: null,
    filterCapacity: 0,
    filterBits: 0,
    filterHashCount: 0,
    filterErrorRate: 0,
    rebuildProgress: null,
    lastRebuildAt: null,
    lastOutboxProcessedAt: null
};

function increment(name, amount = 1) {
    if (typeof counters[name] !== 'number') return;
    counters[name] += amount;
}

function setGauge(name, value) {
    gauges[name] = value;
}

function observeLatency(bucket, milliseconds) {
    if (typeof milliseconds !== 'number' || !Number.isFinite(milliseconds)) return;
    if (typeof counters[bucket] !== 'number') return;
    counters[bucket] += milliseconds;
    counters[`${bucket}Count`] += 1;
    const maxKey = `${bucket}MaxMs`;
    if (typeof counters[maxKey] === 'number' && milliseconds > counters[maxKey]) {
        counters[maxKey] = milliseconds;
    }
}

function snapshot() {
    const average = (total, count) => (count > 0 ? Math.round((total / count) * 100) / 100 : 0);
    return {
        counters: { ...counters },
        gauges: { ...gauges },
        averages: {
            redisLatencyMs: average(counters.redisLatencyTotalMs, counters.redisLatencyCount),
            registrationLatencyMs: average(counters.registrationLatencyTotalMs, counters.registrationLatencyCount),
            outboxSyncDelayMs: average(counters.outboxSyncDelayTotalMs, counters.outboxSyncDelayCount)
        },
        falsePositiveRate: counters.mysqlVerifications > 0
            ? Math.round((counters.falsePositives / counters.mysqlVerifications) * 100000) / 100000
            : 0
    };
}

function reset() {
    for (const key of Object.keys(counters)) counters[key] = 0;
    for (const key of Object.keys(gauges)) gauges[key] = null;
}

module.exports = { increment, setGauge, observeLatency, snapshot, reset };
