// utils/database/query.js
// FIXED - Uses safeQuery only

const { safeQuery } = require('../../config/database');
const logger = require('../logger');

/**
 * Retry a database query with exponential backoff
 */
async function retryQuery(queryFn, maxRetries = 3, baseDelay = 1000) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await queryFn();
        } catch (error) {
            lastError = error;

            // Don't retry on certain errors
            if (error.code !== 'ETIMEDOUT' && error.code !== 'ECONNRESET' && error.code !== 'PROTOCOL_CONNECTION_LOST') {
                throw error;
            }

            // Don't wait after the last attempt
            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt);
                logger.debug(`⚠️ Database query failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // All retries failed
    throw lastError;
}

/**
 * Execute a database query using safeQuery
 */
async function query(sql, params = []) {
    try {
        const rows = await safeQuery(sql, params);
        return rows;
    } catch (error) {
        logger.error('[Query] Error:', error.message);
        throw error;
    }
}

/**
 * Execute a query and return the first row
 */
async function queryOne(sql, params = []) {
    const rows = await query(sql, params);
    return rows && rows.length > 0 ? rows[0] : null;
}

/**
 * Execute a query and return the first column of the first row
 */
async function queryValue(sql, params = []) {
    const row = await queryOne(sql, params);
    return row ? Object.values(row)[0] : null;
}

module.exports = {
    query,
    queryOne,
    queryValue
};
