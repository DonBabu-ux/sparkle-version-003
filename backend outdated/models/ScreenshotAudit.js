const pool = require('../../config/database'); // Adjust path as needed

/**
 * ScreenshotAudit model for logging screenshot or screen recording attempts.
 * Stores: user_id, chat_id (optional), attempted_at, method, ip_address.
 */
class ScreenshotAudit {
  /**
   * Create a new audit record.
   * @param {Object} params - { userId, chatId, method, ip }
   * @returns {Promise<number>} inserted record id
   */
  static async create({ userId, chatId = null, method, ip = null }) {
    const [result] = await pool.query(
      `INSERT INTO screenshot_audit (user_id, chat_id, method, ip_address) VALUES (?,?,?,?)`,
      [userId, chatId, method, ip]
    );
    return result.insertId;
  }

  /**
   * Retrieve recent attempts for a user (optional limit).
   */
  static async getRecentByUser(userId, limit = 20) {
    const [rows] = await pool.query(
      `SELECT * FROM screenshot_audit WHERE user_id = ? ORDER BY attempted_at DESC LIMIT ?`,
      [userId, limit]
    );
    return rows;
  }
}

module.exports = ScreenshotAudit;
