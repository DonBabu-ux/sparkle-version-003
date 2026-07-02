// utils/database/transaction.js
// Helper to run a series of queries inside a MySQL transaction.
// Usage: await transaction(async (conn) => { await query('INSERT ...', [], conn); });
const pool = require('../../config/database');

/**
 * Executes a callback inside a transaction.
 * The callback receives a connection object that should be passed to
 * query/execute helpers that accept an optional connection parameter.
 *
 * @template T
 * @param {(conn: any) => Promise<T>} callback
 * @returns {Promise<T>}
 */
async function transaction(callback) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { transaction };
