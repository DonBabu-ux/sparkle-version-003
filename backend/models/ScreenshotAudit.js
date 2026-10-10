const pool = require('../config/database');

class ScreenshotAudit {
  /**
   * Create a new screenshot audit record.
   * @param {Object} data - { userId, chatId, method, ip }
   * @returns {Promise<number>} inserted id
   */
  static async create({ userId, chatId = null, method = 'screenshot', ip = null }) {
    const [result] = await pool.query(
      `INSERT INTO screenshot_audit (user_id, chat_id, method, ip_address, attempted_at) VALUES (?, ?, ?, ?, NOW())`,
      [userId, chatId, method, ip]
    );
    return result.insertId;
  }

  /**
   * Retrieve audit entries for a user (optional filters).
   */
  static async findByUser(userId, { limit = 100, offset = 0 } = {}) {
    const [rows] = await pool.query(
      `SELECT * FROM screenshot_audit WHERE user_id = ? ORDER BY attempted_at DESC LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
    return rows;
  }
}

module.exports = ScreenshotAudit;
