// config/database.js - PRODUCTION VERSION
const mysql = require('mysql2/promise');

// ── Strict 10-Connection Budget (Phase 2) ──────────────────────────────────
// Architecture:
//   - Absolute physical maximum: 10 connections (DB_POOL_LIMIT=10)
//   - Normal application workload budget: 8 concurrently occupied connections
//   - Peak-traffic reserve: up to 2 additional connections (only for critical operations:
//     auth login/token refresh, payments/wallet ledger, active messaging transactions)
//   - Queue limit: bounded at 250 waiters to prevent memory bloat under extreme load
//   - Connection acquisition timeout: 5,000ms with fail-fast 503 instead of hanging
const TOTAL_CONNECTION_LIMIT = 10;
const NORMAL_CONNECTION_BUDGET = 8;
const PEAK_RESERVE_BUDGET = 2; // 8 + 2 = 10
const QUEUE_LIMIT = 250;
const SLOW_QUERY_MS = 750;

const pool = mysql.createPool({
    host: process.env.NODE_ENV === 'production' ? process.env.DB_HOST_PROD || process.env.DB_HOST : process.env.DB_HOST,
    user: process.env.NODE_ENV === 'production' ? process.env.DB_USER_PROD || process.env.DB_USER : process.env.DB_USER,
    password: process.env.NODE_ENV === 'production' ? process.env.DB_PASSWORD_PROD || process.env.DB_PASSWORD : process.env.DB_PASSWORD,
    database: process.env.NODE_ENV === 'production' ? process.env.DB_NAME_PROD || process.env.DB_NAME : process.env.DB_NAME,
    port: process.env.NODE_ENV === 'production' ? process.env.DB_PORT_PROD || process.env.DB_PORT : process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: TOTAL_CONNECTION_LIMIT, // Hard 10 limit at driver level
    maxIdle: 2,
    queueLimit: QUEUE_LIMIT,
    connectTimeout: 5000,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    enableKeepAlive: true,
    keepAliveInitialDelay: 30000,
    idleTimeout: 90000,
    timezone: 'Z'
});

// ── Two-Tier Concurrency Gate (8 Normal / 2 Peak Reserve) ─────────────────────
// Controls concurrency BEFORE checking out or querying on physical MySQL connections.
class ConnectionBudgetGate {
    constructor(normalLimit, maxLimit, maxQueue) {
        this.normalLimit = normalLimit; // 8
        this.maxLimit = maxLimit;       // 10
        this.activeCount = 0;           // Current operations actively holding a connection
        this.peakActiveCount = 0;       // Operations currently using the reserve (slots 9 and 10)
        this.normalQueue = [];          // Pending standard waiters
        this.peakQueue = [];            // Pending critical/peak waiters
        this.maxQueue = maxQueue;
    }

    /**
     * Determines whether an operation is critical and eligible for the 2-connection reserve.
     */
    isEligibleForPeak(priorityOrContext) {
        if (priorityOrContext === true || priorityOrContext === 'peak' || priorityOrContext === 'critical') return true;
        if (typeof priorityOrContext === 'string') {
            const p = priorityOrContext.toLowerCase();
            return p.includes('auth') || p.includes('wallet') || p.includes('paystack') ||
                   p.includes('message') || p.includes('deposit') || p.includes('refresh') ||
                   p.includes('security');
        }
        return false;
    }

    acquire(priority = false, timeoutMs = 8000, options = {}) {
        const signal = options instanceof AbortSignal ? options : options?.signal;
        if (signal?.aborted) {
            const err = new Error('Database connection acquisition aborted');
            err.name = 'AbortError';
            err.code = 'ACQUISITION_ABORTED';
            err.status = 503;
            const p = Promise.reject(err);
            p.cancel = () => {};
            return p;
        }

        const isPeak = this.isEligibleForPeak(priority);

        // Can we run immediately?
        // Normal work runs if active < 8.
        // Peak-eligible work runs if active < 10.
        if (!isPeak && this.activeCount < this.normalLimit) {
            this.activeCount++;
            const p = Promise.resolve(() => this.release(false));
            p.cancel = () => {};
            return p;
        }
        if (isPeak && this.activeCount < this.maxLimit) {
            this.activeCount++;
            if (this.activeCount > this.normalLimit) {
                this.peakActiveCount++;
            }
            const usedPeak = this.activeCount > this.normalLimit;
            const p = Promise.resolve(() => this.release(usedPeak));
            p.cancel = () => {};
            return p;
        }

        // Bounded queue check
        if (this.normalQueue.length + this.peakQueue.length >= this.maxQueue) {
            const err = new Error('Database connection queue full — operation rejected');
            err.code = 'POOL_QUEUE_EXHAUSTED';
            err.status = 503;
            const p = Promise.reject(err);
            p.cancel = () => {};
            return p;
        }

        let cancelFn;
        const promise = new Promise((resolve, reject) => {
            let timer = null;
            let abortListener = null;

            const cleanup = () => {
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
                if (signal && abortListener) {
                    signal.removeEventListener('abort', abortListener);
                    abortListener = null;
                }
            };

            const waiter = {
                resolve: (cleanupFn) => {
                    cleanup();
                    if (waiter.cancelled) {
                        // Waiter was already cancelled or timed out — immediately release the slot
                        // so activeCount and the physical connection are never leaked!
                        try { cleanupFn(); } catch (_) {}
                        return;
                    }
                    resolve(cleanupFn);
                },
                reject: (err) => {
                    cleanup();
                    reject(err);
                },
                isPeak,
                cancelled: false
            };

            cancelFn = (reason = 'cancelled') => {
                if (waiter.cancelled) return;
                waiter.cancelled = true;
                const q = isPeak ? this.peakQueue : this.normalQueue;
                const idx = q.indexOf(waiter);
                if (idx !== -1) q.splice(idx, 1);
                const err = new Error(`Database connection acquisition ${reason}`);
                err.code = reason === 'aborted' ? 'ACQUISITION_ABORTED' : 'ACQUISITION_CANCELLED';
                if (reason === 'aborted') err.name = 'AbortError';
                err.status = 503;
                waiter.reject(err);
            };

            if (signal) {
                abortListener = () => cancelFn('aborted');
                signal.addEventListener('abort', abortListener, { once: true });
            }

            if (timeoutMs > 0) {
                timer = setTimeout(() => {
                    if (waiter.cancelled) return;
                    waiter.cancelled = true;
                    const q = isPeak ? this.peakQueue : this.normalQueue;
                    const idx = q.indexOf(waiter);
                    if (idx !== -1) q.splice(idx, 1);
                    const err = new Error(`Database connection acquisition timed out after ${timeoutMs}ms`);
                    err.code = 'CONNECTION_ACQUISITION_TIMEOUT';
                    err.status = 503;
                    waiter.reject(err);
                }, timeoutMs);
            }

            if (isPeak) {
                this.peakQueue.push(waiter);
            } else {
                this.normalQueue.push(waiter);
            }
        });

        promise.cancel = () => {
            if (cancelFn) cancelFn('cancelled');
        };

        return promise;
    }

    release(wasPeak = false) {
        this.activeCount = Math.max(0, this.activeCount - 1);
        if (wasPeak) {
            this.peakActiveCount = Math.max(0, this.peakActiveCount - 1);
        }

        // Next dispatcher: Peak waiters have first claim on reserve or normal slots
        while (this.peakQueue.length > 0 && this.activeCount < this.maxLimit) {
            const waiter = this.peakQueue.shift();
            if (waiter.cancelled) continue;
            this.activeCount++;
            const isNowPeak = this.activeCount > this.normalLimit;
            if (isNowPeak) this.peakActiveCount++;
            waiter.resolve(() => this.release(isNowPeak));
            return;
        }

        // Standard waiters can only take slots 1 through 8
        while (this.normalQueue.length > 0 && this.activeCount < this.normalLimit) {
            const waiter = this.normalQueue.shift();
            if (waiter.cancelled) continue;
            this.activeCount++;
            waiter.resolve(() => this.release(false));
            return;
        }
    }

    getStatus() {
        return {
            normalLimit: this.normalLimit,
            maxLimit: this.maxLimit,
            activeCount: this.activeCount,
            peakActiveCount: this.peakActiveCount,
            normalQueueLength: this.normalQueue.length,
            peakQueueLength: this.peakQueue.length,
            totalQueued: this.normalQueue.length + this.peakQueue.length
        };
    }
}

const budgetGate = new ConnectionBudgetGate(NORMAL_CONNECTION_BUDGET, TOTAL_CONNECTION_LIMIT, QUEUE_LIMIT);

// ── Pool metrics ─────────────────────────────────────────────────────────────
// Rolling counters/windows exposed via GET /api/debug/pool (auth-guarded).
const poolMetrics = {
    startedAt: Date.now(),
    queries: 0,
    queryErrors: 0,
    connLimitErrors: 0,
    slowCount: 0,
    events: { connections: 0, acquires: 0, releases: 0, enqueues: 0 },
    durations: [],   // last 4000 query durations in ms
    slow: [],        // recent slow queries, newest first (cap 50)
    samples: [],     // 1s samples {t, a: active, q: queued} (cap 900 = 15 min)
};

function recordQuery(label, ms, err) {
    try {
        poolMetrics.queries++;
        if (err) {
            poolMetrics.queryErrors++;
            if (isConnectionLimitError(err)) poolMetrics.connLimitErrors++;
        }
        poolMetrics.durations.push(ms);
        if (poolMetrics.durations.length > 4000) poolMetrics.durations.shift();
        if (ms >= SLOW_QUERY_MS) {
            poolMetrics.slowCount++;
            poolMetrics.slow.unshift({ ms: Math.round(ms), at: new Date().toISOString(), sql: label });
            if (poolMetrics.slow.length > 50) poolMetrics.slow.pop();
            logger.warn(`[SLOW QUERY] ${Math.round(ms)}ms :: ${label}`);
        }
    } catch (_) { /* metrics must never break a query */ }
}

const elapsedMs = (t0) => Number(process.hrtime.bigint() - t0) / 1e6;
const sqlLabel = (sql) => typeof sql === 'string' ? sql.replace(/\s+/g, ' ').trim().slice(0, 240) : '[non-sql]';

function wrapThenable(fn, prefix) {
    return function (...args) {
        const t0 = process.hrtime.bigint();
        const label = `${prefix}${sqlLabel(args[0])}`;
        let res;
        try { res = fn.apply(this, args); } catch (e) { recordQuery(label, elapsedMs(t0), e); throw e; }
        if (res && typeof res.then === 'function') {
            return res.then(
                (v) => { recordQuery(label, elapsedMs(t0), null); return v; },
                (e) => { recordQuery(label, elapsedMs(t0), e); throw e; }
            );
        }
        return res;
    };
}

pool.on('error', (err) => {
    console.error('Unexpected error on idle database connection', err);
});

pool.on('connection', () => {
    poolMetrics.events.connections++;
});

pool.on('acquire', () => {
    poolMetrics.events.acquires++;
});

pool.on('release', () => {
    poolMetrics.events.releases++;
});

pool.on('enqueue', () => {
    poolMetrics.events.enqueues++;
});

// Graceful shutdown (SIGTERM = Render/K8s deploys, SIGINT = Ctrl-C)
async function closePool(signal) {
    try {
        await pool.end();
        console.log(`Database pool closed gracefully (${signal})`);
        process.exit(0);
    } catch (err) {
        console.error('Error closing database pool:', err);
        process.exit(1);
    }
}
process.on('SIGINT', () => closePool('SIGINT'));
process.on('SIGTERM', () => closePool('SIGTERM'));

const logger = require('../utils/logger');

/** Returns true for errors that are transient connection resets (worth retrying). */
const isTransientError = (err) => {
    const code = err?.code || '';
    const msg = err?.message || '';
    return code === 'ECONNRESET' || code === 'PROTOCOL_CONNECTION_LOST' ||
           msg.includes('ECONNRESET') || msg.includes('PROTOCOL_CONNECTION_LOST') ||
           msg.includes('Connection lost');
};

/** Returns true for connection-limit errors that should be handled gracefully. */
const isConnectionLimitError = (err) => {
    const code = err?.code || '';
    const errno = err?.errno;
    const msg = err?.message || '';
    return code === 'ER_TOO_MANY_USER_CONNECTIONS' || errno === 1203 ||
           msg.includes('max_user_connections') || msg.includes('ER_TOO_MANY_USER_CONNECTIONS');
};

/**
 * H23 — true when the DB is unreachable/overloaded (network-level failure),
 * as opposed to a SQL or domain error. Callers must answer 503 for these
 * instead of 401, otherwise clients log out a perfectly valid session
 * during a DB blip.
 */
const isDatabaseUnavailableError = (err) => {
    if (!err) return false;
    if (err.name === 'AggregateError' || err instanceof AggregateError) return true;
    if (isConnectionLimitError(err)) return true;
    const code = err.code || '';
    const msg = err.message || '';
    const netCodes = [
        'ETIMEDOUT', 'ETIMEOUT', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND',
        'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH', 'EPIPE',
        'PROTOCOL_CONNECTION_LOST', 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR'
    ];
    if (netCodes.includes(code)) return true;
    return /connect ETIMEDOUT|ECONNREFUSED|ENOTFOUND|getaddrinfo|Too many connections|pool is exhausted|Connection lost/i.test(msg);
};

// ── Throttled error logging ───────────────────────────────────────────────────
// Prevents flooding logs with hundreds of identical DB errors per second.
const _errorCounts = new Map();
const _errorLastLogged = new Map();
const ERROR_THROTTLE_MS = 30000; // 30 seconds between duplicate log lines

function throttledError(key, message) {
    const now = Date.now();
    const lastLogged = _errorLastLogged.get(key) || 0;
    const count = (_errorCounts.get(key) || 0) + 1;
    _errorCounts.set(key, count);

    if (now - lastLogged >= ERROR_THROTTLE_MS) {
        if (count > 1) {
            logger.error(`[DB] ${message} (suppressed ${count - 1} duplicate(s) in the last 30s)`);
        } else {
            logger.error(`[DB] ${message}`);
        }
        _errorLastLogged.set(key, now);
        _errorCounts.set(key, 0);
    }
}

/**
 * Safe wrapper for MySQL queries that logs errors and rethrows.
 * Automatically retries once on transient ECONNRESET errors.
 * @param {string} sql - The SQL query string.
 * @param {Array} [params=[]] - Parameter values for placeholders.
 * @returns {Promise<Array>} Result rows.
 */
async function safeQuery(sql, params = [], priority = false) {
    const releaseGate = await budgetGate.acquire(priority);
    try {
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const [rows] = await originalQuery(sql, params);
                return rows;
            } catch (error) {
                if (attempt === 0 && isTransientError(error)) {
                    logger.warn('[DB] ECONNRESET on safeQuery — retrying once...');
                    await new Promise(r => setTimeout(r, 300));
                    continue;
                }
                const message = error?.message || error?.sqlMessage || String(error).slice(0, 200);
                if (isConnectionLimitError(error)) {
                    throttledError('connection_limit', 'Connection limit reached — reduce pool size or concurrent queries');
                } else {
                    logger.error('[DB] Query error:', message);
                }
                throw error;
            }
        }
    } finally {
        releaseGate();
    }
}

// Backward‑compatible wrapper: expose a `query` method on the exported pool that returns [rows, fields].
// Also instruments every query: duration window, slow-query log, error counters.
const originalQuery = pool.query.bind(pool);
pool.query = async (sql, params = [], priority = false) => {
    const releaseGate = await budgetGate.acquire(priority);
    try {
        const t0 = process.hrtime.bigint();
        const label = sqlLabel(sql);
        if (process.env.DB_QUERY_TRACE === '1') logger.info('[QTRACE] ' + label);
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                // Return the full [rows, fields] tuple like mysql2/promise does
                const result = await originalQuery(sql, params);
                recordQuery(label, elapsedMs(t0), null);
                return result;
            } catch (error) {
                if (attempt === 0 && isTransientError(error)) {
                    logger.warn('[DB] ECONNRESET on pool.query — retrying once...');
                    await new Promise(r => setTimeout(r, 300));
                    continue;
                }
                const message = error?.message || error?.sqlMessage || String(error).slice(0, 200) || '';
                const isDuplicateErr = message.includes('Duplicate') || message.includes('already exists');

                if (isConnectionLimitError(error)) {
                    throttledError('connection_limit', 'ER_TOO_MANY_USER_CONNECTIONS — pool exhausted');
                } else if (!isDuplicateErr && message.trim().length > 0) {
                    logger.error('[DB] Query error (wrapped pool.query): ' + String(message));
                }
                recordQuery(label, elapsedMs(t0), error);
                throw error;
            }
        }
    } finally {
        releaseGate();
    }
};

// Prepared statement execution: also instrumented and guarded by budgetGate
const originalExecute = pool.execute.bind(pool);
pool.execute = async (sql, params = [], priority = false) => {
    const releaseGate = await budgetGate.acquire(priority);
    try {
        const t0 = process.hrtime.bigint();
        const label = sqlLabel(sql);
        if (process.env.DB_QUERY_TRACE === '1') logger.info('[QTRACE:EXEC] ' + label);
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const result = await originalExecute(sql, params);
                recordQuery(label, elapsedMs(t0), null);
                return result;
            } catch (error) {
                if (attempt === 0 && isTransientError(error)) {
                    logger.warn('[DB] ECONNRESET on pool.execute — retrying once...');
                    await new Promise(r => setTimeout(r, 300));
                    continue;
                }
                const message = error?.message || error?.sqlMessage || String(error).slice(0, 200) || '';
                const isDuplicateErr = message.includes('Duplicate') || message.includes('already exists');

                if (isConnectionLimitError(error)) {
                    throttledError('connection_limit', 'ER_TOO_MANY_USER_CONNECTIONS — pool exhausted');
                } else if (!isDuplicateErr && message.trim().length > 0) {
                    logger.error('[DB] Execute error (wrapped pool.execute): ' + String(message));
                }
                recordQuery(label, elapsedMs(t0), error);
                throw error;
            }
        }
    } finally {
        releaseGate();
    }
};

// Transactions: explicit checkouts acquire a slot on the gate and release on conn.release()
const originalGetConnection = pool.getConnection.bind(pool);
pool.getConnection = async (priority = 'critical', timeoutMs = 8000, options = {}) => {
    const releaseGate = await budgetGate.acquire(priority, timeoutMs, options);
    try {
        const conn = await originalGetConnection();
        if (conn) {
            const originalRelease = conn.release.bind(conn);
            let released = false;
            conn.release = () => {
                if (!released) {
                    released = true;
                    try { releaseGate(); } catch (_) {}
                    return originalRelease();
                }
            };
            if (typeof conn.query === 'function') conn.query = wrapThenable(conn.query.bind(conn), 'tx:');
            if (typeof conn.execute === 'function') conn.execute = wrapThenable(conn.execute.bind(conn), 'tx:');
        }
        return conn;
    } catch (err) {
        releaseGate();
        throw err;
    }
};

/**
 * Returns safe pool diagnostics without exposing credentials.
 * Uses the mysql2 PoolNamespace internals available in mysql2 >= 2.x
 */
function getPoolStatus() {
    try {
        const corePool = pool.pool;
        const gate = budgetGate.getStatus();
        if (corePool && typeof corePool._allConnections !== 'undefined') {
            return {
                limit: TOTAL_CONNECTION_LIMIT,
                normalBudget: NORMAL_CONNECTION_BUDGET,
                peakBudget: PEAK_RESERVE_BUDGET,
                all: corePool._allConnections.length,
                free: corePool._freeConnections.length,
                queued: corePool._connectionQueue ? corePool._connectionQueue.length : 0,
                active: corePool._allConnections.length - corePool._freeConnections.length,
                gateActive: gate.activeCount,
                gatePeakActive: gate.peakActiveCount,
                gateQueued: gate.totalQueued,
                gatePeakQueued: gate.peakQueueLength
            };
        }
    } catch (_) {
        logger.debug('getPoolStatus failed; returning default connection limit');
    }
    return { limit: TOTAL_CONNECTION_LIMIT, normalBudget: NORMAL_CONNECTION_BUDGET, peakBudget: PEAK_RESERVE_BUDGET };
}

// 1-second sampler of live usage (rolling 15-minute window)
setInterval(() => {
    try {
        const s = getPoolStatus();
        poolMetrics.samples.push({ t: Date.now(), a: s.active ?? null, q: s.queued ?? 0 });
        if (poolMetrics.samples.length > 900) poolMetrics.samples.shift();
    } catch (_) {
        logger.debug('pool sampler tick failed');
    }
}, 1000).unref();

// Warm the pool immediately
setImmediate(() => {
    originalQuery('SELECT 1').catch(() => { /* warm-up is best-effort */ });
});

/**
 * Full pool observability snapshot for GET /api/debug/pool (auth-guarded).
 * Shows how the connection budget is used + where capacity goes.
 */
function getPoolMetrics() {
    const live = getPoolStatus();
    const gate = budgetGate.getStatus();
    const d = [...poolMetrics.durations].sort((a, b) => a - b);
    const q = (p) => d.length ? +(d[Math.min(d.length - 1, Math.floor(d.length * p))]).toFixed(1) : null;
    const avg = d.length ? +(d.reduce((a, b) => a + b, 0) / d.length).toFixed(1) : null;
    const s = poolMetrics.samples;
    const atCap = s.filter((x) => x.a != null && x.a >= TOTAL_CONNECTION_LIMIT).length;
    const maxActive = s.reduce((m, x) => Math.max(m, x.a || 0), 0);
    const maxQueued = s.reduce((m, x) => Math.max(m, x.q || 0), 0);
    return {
        config: {
            connectionLimit: TOTAL_CONNECTION_LIMIT,
            normalBudget: NORMAL_CONNECTION_BUDGET,
            peakReserve: PEAK_RESERVE_BUDGET,
            queueLimit: QUEUE_LIMIT,
            slowQueryMs: SLOW_QUERY_MS,
            hostBudget: 40,
            envVar: process.env.DB_POOL_LIMIT || process.env.DB_CONNECTION_LIMIT || null,
        },
        live,
        gate,
        uptimeSec: Math.round((Date.now() - poolMetrics.startedAt) / 1000),
        counters: {
            queries: poolMetrics.queries,
            queryErrors: poolMetrics.queryErrors,
            connLimitErrors: poolMetrics.connLimitErrors,
            slowCount: poolMetrics.slowCount,
            ...poolMetrics.events,
        },
        queryMs: {
            window: d.length,
            avg,
            p50: q(0.5),
            p95: q(0.95),
            p99: q(0.99),
            max: d.length ? +(d[d.length - 1]).toFixed(1) : null,
        },
        usage: {
            sampledSec: s.length,
            maxActive,
            pctTimeAtCap: s.length ? +(100 * atCap / s.length).toFixed(1) : 0,
            maxQueued,
            last: s.length ? s[s.length - 1] : null,
        },
        slowestRecent: poolMetrics.slow.slice(0, 10),
    };
}

// Export pool as default so it can be imported directly as:
// const pool = require('./config/database');
module.exports = pool;

// Also attach utility functions to the pool object for backward compatibility
module.exports.safeQuery = safeQuery;
module.exports.isConnectionLimitError = isConnectionLimitError;
module.exports.isDatabaseUnavailableError = isDatabaseUnavailableError;
module.exports.getPoolStatus = getPoolStatus;
module.exports.getPoolMetrics = getPoolMetrics;
module.exports.ConnectionBudgetGate = ConnectionBudgetGate;
module.exports.budgetGate = budgetGate;
