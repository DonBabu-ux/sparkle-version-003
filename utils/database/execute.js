// utils/database/execute.js
// Simple wrapper for INSERT/UPDATE/DELETE that optionally uses a transaction connection.
// If a connection is passed, it will use that connection; otherwise it falls back to the pool.
const { pool } = require('./pool');

/**
 * Executes a write query (INSERT, UPDATE, DELETE).
 * @param {string} sql
 * @param {Array<any>} [params=[]]
 * @param {any} [conn=null] - Optional connection from transaction.
 * @returns {Promise<any>} - The raw result from the driver.
 */
async function execute(sql, params = [], conn = null) {
  if (conn) {
    const [result] = await conn.execute(sql, params);
    return result;
  }
  const [result] = await pool.execute(sql, params);
  return result;
}

module.exports = { execute };
