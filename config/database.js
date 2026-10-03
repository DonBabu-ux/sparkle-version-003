// config/database.js - PRODUCTION VERSION
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.NODE_ENV === 'production' ? process.env.DB_HOST_PROD || process.env.DB_HOST : process.env.DB_HOST,
    user: process.env.NODE_ENV === 'production' ? process.env.DB_USER_PROD || process.env.DB_USER : process.env.DB_USER,
    password: process.env.NODE_ENV === 'production' ? process.env.DB_PASSWORD_PROD || process.env.DB_PASSWORD : process.env.DB_PASSWORD,
    database: process.env.NODE_ENV === 'production' ? process.env.DB_NAME_PROD || process.env.DB_NAME : process.env.DB_NAME,
    port: process.env.NODE_ENV === 'production' ? process.env.DB_PORT_PROD || process.env.DB_PORT : process.env.DB_PORT || 3306,
    // Connection limits
    waitForConnections: true,
    connectionLimit: process.env.DB_POOL_LIMIT ? parseInt(process.env.DB_POOL_LIMIT, 10) : 25,
    maxIdle: 10,          // Keep at most 10 idle connections
    queueLimit: 0,
    connectTimeout: 30000,
    // SSL for remote DBs
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    // Keep-alive — sends a ping every 10s so the remote DB doesn't drop idle conns
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    // Evict idle connections after 30s (well before most remote DBs' 120-300s timeout)
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

// Graceful shutdown
process.on('SIGINT', async () => {
    try {
        await pool.end();
        console.log('Database pool closed gracefully');
        process.exit(0);
    } catch (err) {
        console.error('Error closing database pool:', err);
        process.exit(1);
    }
});

const logger = require('../utils/logger');

/** Returns true for errors that are transient connection resets (worth retrying). */
const isTransientError = (err) => {
    const code = err?.code || '';
    const msg = err?.message || '';
    return code === 'ECONNRESET' || code === 'PROTOCOL_CONNECTION_LOST' ||
           msg.includes('ECONNRESET') || msg.includes('PROTOCOL_CONNECTION_LOST') ||
           msg.includes('Connection lost');
};

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
            logger.error('[DB] Query error:', message);
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
            // Suppress expected migration errors (duplicate columns/keys)
            const message = error?.message || error?.sqlMessage || String(error).slice(0, 200) || '';
            const isDuplicateErr = message.includes('Duplicate') || message.includes('already exists');
            
            if (!isDuplicateErr && message.trim().length > 0) {
                logger.error('[DB] Query error (wrapped pool.query): ' + String(message));
            }
            throw error;
        }
    }
};

// Export pool as default so it can be imported directly as:
// const pool = require('./config/database');
module.exports = pool;

// Also attach utility functions to the pool object for backward compatibility
module.exports.safeQuery = safeQuery;
module.exports.getPoolStatus = () => pool._allConnections.length;
