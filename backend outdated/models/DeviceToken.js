// backend/models/DeviceToken.js
// Simple model for device tokens used for FCM push notifications.
// Assuming a MySQL (or compatible) connection via the existing db instance.

const db = require('../../config/database');

class DeviceToken {
  /**
   * Upsert a device token record. If the token already exists for the user/device,
   * it will be updated (e.g., refreshed app version or activity status).
   */
  static async upsert({ userId, deviceId, platform, fcmToken, appVersion }) {
    const now = new Date();
    const query = `INSERT INTO device_tokens (user_id, device_id, platform, fcm_token, app_version, last_seen_at, is_active)
                   VALUES (?,?,?,?,?, ?, 1)
                   ON DUPLICATE KEY UPDATE fcm_token = VALUES(fcm_token), app_version = VALUES(app_version), last_seen_at = VALUES(last_seen_at), is_active = 1`;
    const params = [userId, deviceId, platform, fcmToken, appVersion, now];
    await db.query(query, params);
  }

  static async findActiveTokensByUser(userId) {
    const [rows] = await db.query('SELECT fcm_token FROM device_tokens WHERE user_id = ? AND is_active = 1', [userId]);
    return rows.map(r => r.fcm_token);
  }

  static async deactivateToken(fcmToken) {
    await db.query('UPDATE device_tokens SET is_active = 0 WHERE fcm_token = ?', [fcmToken]);
  }
}

module.exports = DeviceToken;
