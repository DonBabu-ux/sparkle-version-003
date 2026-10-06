// config/database.js - PRODUCTION VERSION
const mysql = require('mysql2/promise');

// ── Pool Sizing ──────────────────────────────────────────────────────────────
// Host budget: MySQL account `lilbee` has max_user_connections = 40 TOTAL across
// ALL hosts (Render prod + local dev + teammates). Check live usage with:
//   SELECT COUNT(*) FROM information_schema.processlist WHERE user = 'lilbee';
// Budget: Render ≤ 24, local dev ≤ 8, reserve 8 for migrations/ops.
// One pool per Node process; total = pool size × processes on that host.
// Override via DB_POOL_LIMIT (or legacy DB_CONNECTION_LIMIT); clamped 1–32.
// NEVER raise blindly — more connections don't fix slow queries.
// Watch live usage at GET /api/debug/pool (auth) and /api/health.
const CONNECTION_LIMIT = (() => {
    const n = parseInt(process.env.DB_POOL_LIMIT || process.env.DB_CONNECTION_LIMIT, 10);
    return Number.isFinite(n) ? Math.min(Math.max(n, 1), 32) : 8;
})();
const QUEUE_LIMIT = 500; // Waiters allowed beyond the pool; cheap memory, avoids burst 503s
const SLOW_QUERY_MS = 750; // Queries slower than this are logged + surfaced in metrics

const pool = mysql.createPool({
    host: process.env.NODE_ENV === 'production' ? process.env.DB_HOST_PROD || process.env.DB_HOST : process.env.DB_HOST,
    user: process.env.NODE_ENV === 'production' ? process.env.DB_USER_PROD || process.env.DB_USER : process.env.DB_USER,
    password: process.env.NODE_ENV === 'production' ? process.env.DB_PASSWORD_PROD || process.env.DB_PASSWORD : process.env.DB_PASSWORD,
    database: process.env.NODE_ENV === 'production' ? process.env.DB_NAME_PROD || process.env.DB_NAME : process.env.DB_NAME,
    port: process.env.NODE_ENV === 'production' ? process.env.DB_PORT_PROD || process.env.DB_PORT : process.env.DB_PORT || 3306,
    // Connection pool — bounded and shared across ALL requests, sockets, workers
    waitForConnections: true,
    connectionLimit: CONNECTION_LIMIT,
    maxIdle: Math.min(2, Math.max(1, Math.floor(CONNECTION_LIMIT / 2))),
    queueLimit: QUEUE_LIMIT,   // Queue waiters; return error if exceeded
    connectTimeout: 10000,    // Fail fast — don't hold a slot waiting forever
    // SSL for remote DBs
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    // Keep-alive — sends a ping so the remote DB doesn't drop idle conns
    enableKeepAlive: true,
    keepAliveInitialDelay: 30000,
    // Evict idle connections after 30s
    idleTimeout: 30000,
    // Timezone
    timezone: 'Z'
});

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
async function safeQuery(sql, params = []) {
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const [rows] = await pool.query(sql, params);
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
}

// Backward‑compatible wrapper: expose a `query` method on the exported pool that returns [rows, fields].
// Also instruments every query: duration window, slow-query log, error counters.
const originalQuery = pool.query.bind(pool);
pool.query = async (sql, params = []) => {
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
};

// Transactions: queries on explicitly checked-out connections are timed too
const originalGetConnection = pool.getConnection.bind(pool);
pool.getConnection = async (...args) => {
    const conn = await originalGetConnection(...args);
    if (conn && typeof conn.query === 'function') conn.query = wrapThenable(conn.query.bind(conn), 'tx:');
    if (conn && typeof conn.execute === 'function') conn.execute = wrapThenable(conn.execute.bind(conn), 'tx:');
    return conn;
};

/**
 * Returns safe pool diagnostics without exposing credentials.
 * Uses the mysql2 PoolNamespace internals available in mysql2 >= 2.x
 */
function getPoolStatus() {
    try {
        // mysql2/promise wraps a core Pool; access via pool.pool for the underlying PoolNamespace
        const corePool = pool.pool;
        if (corePool && typeof corePool._allConnections !== 'undefined') {
            return {
                limit: CONNECTION_LIMIT,
                all: corePool._allConnections.length,
                free: corePool._freeConnections.length,
                queued: corePool._connectionQueue ? corePool._connectionQueue.length : 0,
                active: corePool._allConnections.length - corePool._freeConnections.length,
            };
        }
    } catch (_) {
        logger.debug('getPoolStatus failed; returning default connection limit');
    }
    return { limit: CONNECTION_LIMIT };
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

/**
 * Full pool observability snapshot for GET /api/debug/pool (auth-guarded).
 * Shows how the connection budget is used + where capacity goes.
 */
function getPoolMetrics() {
    const live = getPoolStatus();
    const d = [...poolMetrics.durations].sort((a, b) => a - b);
    const q = (p) => d.length ? +(d[Math.min(d.length - 1, Math.floor(d.length * p))]).toFixed(1) : null;
    const avg = d.length ? +(d.reduce((a, b) => a + b, 0) / d.length).toFixed(1) : null;
    const s = poolMetrics.samples;
    const atCap = s.filter((x) => x.a != null && x.a >= CONNECTION_LIMIT).length;
    const maxActive = s.reduce((m, x) => Math.max(m, x.a || 0), 0);
    const maxQueued = s.reduce((m, x) => Math.max(m, x.q || 0), 0);
    return {
        config: {
            connectionLimit: CONNECTION_LIMIT,
            queueLimit: QUEUE_LIMIT,
            slowQueryMs: SLOW_QUERY_MS,
            hostBudget: 40,
            envVar: process.env.DB_POOL_LIMIT || process.env.DB_CONNECTION_LIMIT || null,
        },
        live,
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
