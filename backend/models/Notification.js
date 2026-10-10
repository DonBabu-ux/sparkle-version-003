// Notification model for Sparkle
// Uses the existing MySQL pool via '../config/database'
const db = require('../config/database');

class Notification {
  /**
   * Create a new notification
   * @param {Object} payload - {user_id, type, title, content, actor_id, related_id, action_url, aggregation_count}
   */
  static async create(payload) {
    const {
      user_id,
      type,
      title,
      content,
      actor_id = null,
      related_id = null,
      action_url = null,
      aggregation_count = 1,
    } = payload;
    const [result] = await db.query(
      `INSERT INTO notifications (notification_id, user_id, type, title, content, actor_id, related_id, action_url, aggregation_count)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, type, title, content, actor_id, related_id, action_url, aggregation_count]
    );
    return result.insertId;
  }

  /** Retrieve unread notifications for a user (limit optional) */
  static async getUnread(userId, limit = 20) {
    const [rows] = await db.query(
      `SELECT * FROM notifications WHERE user_id = ? AND is_read = FALSE ORDER BY created_at DESC LIMIT ?`,
      [userId, limit]
    );
    return rows;
  }

  /** Mark notification(s) as read */
  static async markRead(userId, notificationIds) {
    const placeholders = notificationIds.map(() => '?').join(',');
    await db.query(
      `UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE user_id = ? AND notification_id IN (${placeholders})`,
      [userId, ...notificationIds]
    );
    return true;
  }

  /** Aggregate similar notifications (e.g., follow requests) */
  static async upsert(payload) {
    // Simple upsert based on user_id, type, related_id, actor_id
    const { user_id, type, title, content, actor_id = null, related_id = null, action_url = null } = payload;
    // Check for existing unread notification of same type+related
    const [existing] = await db.query(
      `SELECT notification_id, aggregation_count FROM notifications WHERE user_id = ? AND type = ? AND related_id = ? AND is_read = FALSE LIMIT 1`,
      [user_id, type, related_id]
    );
    if (existing.length > 0) {
      const notif = existing[0];
      await db.query(
        `UPDATE notifications SET aggregation_count = aggregation_count + 1, created_at = CURRENT_TIMESTAMP WHERE notification_id = ?`,
        [notif.notification_id]
      );
      return notif.notification_id;
    }
    // Otherwise create new
    return await this.create(payload);
  }
}

module.exports = Notification;
