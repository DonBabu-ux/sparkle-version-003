// config/database.js - PRODUCTION VERSION
const mysql = require('mysql2/promise');

// ── Pool Sizing ──────────────────────────────────────────────────────────────
// Keep this small. The MySQL shared-hosting account (`lilbee`) has a low
// max_user_connections limit — ~40 TOTAL across local dev + Render prod.
// One pool per Node process; total DB connections = pool size × processes.
// Default: 3. Override via DB_POOL_LIMIT (or legacy DB_CONNECTION_LIMIT), always
// clamped to 1–10. NEVER raise this blindly — more connections don't fix slow queries.
const CONNECTION_LIMIT = (() => {
    const n = parseInt(process.env.DB_POOL_LIMIT || process.env.DB_CONNECTION_LIMIT, 10);
    return Number.isFinite(n) ? Math.min(Math.max(n, 1), 10) : 3;
})();

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
    queueLimit: 150,          // Queue waiters; return error if exceeded
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

pool.on('error', (err) => {
    console.error('Unexpected error on idle database connection', err);
});

// Connection validation
pool.on('connection', (connection) => {
    // logger.debug('✅ New database connection established');
});

pool.on('acquire', (connection) => {
    // logger.debug('🔗 Connection acquired');
});

pool.on('release', (connection) => {
    // logger.debug('🔄 Connection released');
});

pool.on('enqueue', () => {
    // logger.debug('⏳ Waiting for available connection...');
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
const originalQuery = pool.query.bind(pool);
pool.query = async (sql, params = []) => {
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            // Return the full [rows, fields] tuple like mysql2/promise does
            return await originalQuery(sql, params);
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
            throw error;
        }
    }
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
    } catch (_) {}
    return { limit: CONNECTION_LIMIT };
}

// Export pool as default so it can be imported directly as:
// const pool = require('./config/database');
module.exports = pool;

// Also attach utility functions to the pool object for backward compatibility
module.exports.safeQuery = safeQuery;
module.exports.isConnectionLimitError = isConnectionLimitError;
module.exports.getPoolStatus = getPoolStatus;
