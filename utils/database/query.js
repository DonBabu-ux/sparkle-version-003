const pool = require('../../config/database');
const logger = require('../logger');

// Retryable error codes (transient network/connection failures)
const RETRYABLE_CODES = new Set([
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'PROTOCOL_CONNECTION_LOST',
    'ER_CON_COUNT_ERROR', // Too many connections - backoff and retry
]);

/**
 * Execute a query with automatic exponential-backoff retry on transient errors.
 */
async function query(sql, params = [], { maxRetries = 3, baseDelay = 200 } = {}) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await pool.query(sql, params);
        } catch (error) {
            lastError = error;

            if (!RETRYABLE_CODES.has(error.code)) {
                // Non-retryable — surface immediately (duplicate key, bad syntax, etc.)
                throw error;
            }

            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 50; // jitter
                logger.warn(`[DB] Query failed (${error.code}), attempt ${attempt + 1}/${maxRetries + 1}, retrying in ${Math.round(delay)}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    logger.error(`[DB] Query exhausted ${maxRetries} retries. Last error: ${lastError.code}`);
    throw lastError;
}

/**
 * Execute multiple queries in a single transaction.
 * Rolls back automatically on any failure.
 * @param {Array<{sql: string, values: Array}>} queries
 */
async function transaction(queries) {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
        const results = [];
        for (const q of queries) {
            const [rows] = await connection.query(q.sql, q.values || []);
            results.push(rows);
        }
        await connection.commit();
        return results;
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

/**
 * Paginated SELECT helper.
 * Returns { rows, total, page, limit, pages }
 */
async function paginate(sql, params = [], { page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    const [rows] = await query(`${sql} LIMIT ? OFFSET ?`, [...params, limit, offset]);

    // Count total — strip ORDER BY to avoid DB cost
    const countSql = `SELECT COUNT(*) as total FROM (${sql.replace(/ORDER BY .+$/i, '')}) AS _count`;
    const [countRows] = await query(countSql, params);
    const total = countRows[0]?.total || 0;

    return {
        rows,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
    };
}

module.exports = { query, transaction, paginate, pool };
