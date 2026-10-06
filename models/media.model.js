/**
 * media.model.js
 * Sparkle Enterprise Ephemeral Media Delivery v2
 */

const db = require('../config/database');
const crypto = require('crypto');

class MediaModel {
  /**
   * Ensure database tables exist for ephemeral media tracking
   */
  static async initTables() {
    if (MediaModel._tablesReady) return;
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS media_objects (
          media_id VARCHAR(128) PRIMARY KEY,
          chat_id VARCHAR(128) NOT NULL,
          uploader_id VARCHAR(128) NOT NULL,
          mime_type VARCHAR(128) NOT NULL,
          size_bytes BIGINT NOT NULL,
          sha256_hash VARCHAR(128) NOT NULL,
          encryption_iv VARCHAR(128) NOT NULL,
          thumbnail_blurhash TEXT,
          status ENUM('UPLOADING', 'AVAILABLE', 'DELIVERED', 'DOWNLOADED', 'EXPIRED', 'DELETED') DEFAULT 'UPLOADING',
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_chat_media (chat_id),
          INDEX idx_media_status_expiry (status, expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS media_deliveries (
          id INT AUTO_INCREMENT PRIMARY KEY,
          media_id VARCHAR(128) NOT NULL,
          recipient_id VARCHAR(128) NOT NULL,
          download_status ENUM('PENDING', 'DOWNLOADED') DEFAULT 'PENDING',
          downloaded_at DATETIME,
          UNIQUE KEY uk_media_recipient (media_id, recipient_id),
          FOREIGN KEY (media_id) REFERENCES media_objects(media_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      MediaModel._tablesReady = true;
    } catch (err) {
      console.warn('[MediaModel] Table init warning:', err.message);
    }
  }

  /**
   * Register a new media object during upload initialization
   */
  static async createMediaObject({ mediaId, chatId, uploaderId, mimeType, sizeBytes, sha256Hash, encryptionIv, thumbnailBlurhash, recipientIds = [] }) {
    await this.initTables();

    const id = mediaId || crypto.randomUUID();
    // Default server retention expiry: 48 hours from upload
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await db.query(
      `INSERT INTO media_objects 
       (media_id, chat_id, uploader_id, mime_type, size_bytes, sha256_hash, encryption_iv, thumbnail_blurhash, status, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'UPLOADING', ?)
       ON DUPLICATE KEY UPDATE status = 'UPLOADING'`,
      [id, chatId, uploaderId, mimeType, sizeBytes, sha256Hash, encryptionIv, thumbnailBlurhash, expiresAt]
    );

    // Populate delivery tracking for each recipient
    for (const recipientId of recipientIds) {
      if (recipientId && recipientId !== uploaderId) {
        await db.query(
          `INSERT IGNORE INTO media_deliveries (media_id, recipient_id, download_status) VALUES (?, ?, 'PENDING')`,
          [id, recipientId]
        );
      }
    }

    return id;
  }

  /**
   * Mark media upload as complete & AVAILABLE
   */
  static async markAvailable(mediaId) {
    await db.query(`UPDATE media_objects SET status = 'AVAILABLE' WHERE media_id = ?`, [mediaId]);
  }

  /**
   * Record recipient download ACK & check if all recipients have downloaded
   */
  static async recordDownloadAck(mediaId, recipientId) {
    const now = new Date();
    await db.query(
      `UPDATE media_deliveries SET download_status = 'DOWNLOADED', downloaded_at = ? WHERE media_id = ? AND recipient_id = ?`,
      [now, mediaId, recipientId]
    );

    // Check if any pending deliveries remain
    const [pending] = await db.query(
      `SELECT COUNT(*) as count FROM media_deliveries WHERE media_id = ? AND download_status = 'PENDING'`,
      [mediaId]
    );

    if (pending && pending[0] && pending[0].count === 0) {
      await db.query(`UPDATE media_objects SET status = 'DOWNLOADED' WHERE media_id = ?`, [mediaId]);
      return true; // All downloaded! Ready for cleanup
    }

    return false;
  }

  /**
   * Find expired or fully-downloaded media objects ready for binary cleanup
   */
  static async getEligibleForCleanup() {
    try {
      await this.initTables();
      const [rows] = await db.query(
        `SELECT media_id, chat_id, status, expires_at FROM media_objects 
         WHERE status != 'DELETED' AND (expires_at < NOW() OR status = 'DOWNLOADED')`
      );
      return rows || [];
    } catch {
      return [];
    }
  }

  /**
   * Mark media object as DELETED after binary file purge
   */
  static async markDeleted(mediaId) {
    await db.query(`UPDATE media_objects SET status = 'DELETED' WHERE media_id = ?`, [mediaId]);
  }

  /**
   * Fetch media object metadata by ID
   */
  static async getById(mediaId) {
    await this.initTables();
    const [rows] = await db.query(`SELECT * FROM media_objects WHERE media_id = ?`, [mediaId]);
    return rows && rows.length > 0 ? rows[0] : null;
  }
}

module.exports = MediaModel;
