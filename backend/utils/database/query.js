const pool = require('../../config/database');

/**
 * Retry a database query with exponential backoff
 * @param {Function} queryFn - Function that returns a promise for the query
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} - Query result
 */
async function retryQuery(queryFn, maxRetries = 3, baseDelay = 1000) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await queryFn();
        } catch (error) {
            lastError = error;

            // Don't retry on certain errors
            if (error.code !== 'ETIMEDOUT' &&
                error.code !== 'ECONNRESET' &&
                error.code !== 'PROTOCOL_CONNECTION_LOST') {
                throw error;
            }

            // Don't wait after the last attempt
            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt);
                const logger = require('../logger');
                logger.debug(`⚠️ Database query failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // All retries failed
    throw lastError;
}

/**
 * Execute a query with automatic retry on connection errors
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise} - Query result
 */
async function query(sql, params = []) {
    return retryQuery(() => pool.query(sql, params));
}

module.exports = {
    query,
    retryQuery,
    pool
};
