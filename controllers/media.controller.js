/**
 * media.controller.js
 * Sparkle Enterprise Ephemeral Media Delivery v2
 */

const crypto = require('crypto');
const MediaModel = require('../models/media.model');

// Secret key for HMAC signed download tokens (falls back to app default)
const SIGNING_SECRET = process.env.JWT_SECRET || 'sparkle_ephemeral_media_secret_2026';

class MediaController {
  /**
   * Initialize upload session for encrypted media payload
   */
  static async uploadInit(req, res) {
    try {
      const uploaderId = req.user?.id || req.user?.user_id || req.body.uploaderId;
      const { chatId, mimeType, sizeBytes, sha256Hash, encryptionIv, thumbnailBlurhash, recipientIds } = req.body;

      if (!chatId || !sha256Hash || !encryptionIv) {
        return res.status(400).json({ success: false, error: 'Missing required media metadata parameters' });
      }

      const mediaId = crypto.randomUUID();
      await MediaModel.createMediaObject({
        mediaId,
        chatId,
        uploaderId,
        mimeType: mimeType || 'application/octet-stream',
        sizeBytes: sizeBytes || 0,
        sha256Hash,
        encryptionIv,
        thumbnailBlurhash: thumbnailBlurhash || null,
        recipientIds: recipientIds || [],
      });

      return res.json({
        success: true,
        mediaId,
        uploadUrl: `/api/media/upload-payload/${mediaId}`,
      });
    } catch (err) {
      console.error('[MediaController] Upload init error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Complete upload session after binary upload
   */
  static async uploadComplete(req, res) {
    try {
      const { mediaId } = req.body;
      if (!mediaId) return res.status(400).json({ success: false, error: 'mediaId required' });

      await MediaModel.markAvailable(mediaId);
      return res.json({ success: true, mediaId, status: 'AVAILABLE' });
    } catch (err) {
      console.error('[MediaController] Upload complete error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Generate short-lived signed download token (valid 5 minutes)
   */
  static async getDownloadToken(req, res) {
    try {
      const { mediaId } = req.params;
      const userId = req.user?.id || req.user?.user_id || req.query.userId;

      const media = await MediaModel.getById(mediaId);
      if (!media) {
        return res.status(404).json({ success: false, error: 'Media object not found' });
      }

      if (media.status === 'DELETED') {
        return res.status(410).json({
          success: false,
          error: 'Media expired',
          code: 'MEDIA_EXPIRED',
          canRequestRedelivery: true,
        });
      }

      // Generate 5-minute expiring HMAC signed URL token
      const expiresAt = Date.now() + 5 * 60 * 1000;
      const payloadStr = `${mediaId}:${userId}:${expiresAt}`;
      const hmac = crypto.createHmac('sha256', SIGNING_SECRET).update(payloadStr).digest('hex');

      const downloadUrl = `/api/media/stream/${mediaId}?expires=${expiresAt}&token=${hmac}&user=${userId}`;

      return res.json({
        success: true,
        mediaId,
        downloadUrl,
        sha256Hash: media.sha256_hash,
        encryptionIv: media.encryption_iv,
        sizeBytes: media.size_bytes,
        mimeType: media.mime_type,
        expiresAt,
      });
    } catch (err) {
      console.error('[MediaController] Download token error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Verify signed token for file streaming / chunk downloads
   */
  static verifySignedToken(mediaId, userId, expiresAt, token) {
    if (Date.now() > Number(expiresAt)) return false;
    const payloadStr = `${mediaId}:${userId}:${expiresAt}`;
    const expectedHmac = crypto.createHmac('sha256', SIGNING_SECRET).update(payloadStr).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(token || ''), Buffer.from(expectedHmac));
  }

  /**
   * Record recipient download ACK
   */
  static async recordDownloadAck(req, res) {
    try {
      const { mediaId } = req.body;
      const userId = req.user?.id || req.user?.user_id || req.body.userId;

      if (!mediaId || !userId) {
        return res.status(400).json({ success: false, error: 'mediaId and userId required' });
      }

      const allDownloaded = await MediaModel.recordDownloadAck(mediaId, userId);
      return res.json({ success: true, mediaId, allDownloaded });
    } catch (err) {
      console.error('[MediaController] Record download ACK error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Signal Peer-Assisted Re-Delivery request to sender
   */
  static async requestRedelivery(req, res) {
    try {
      const { mediaId } = req.body;
      const requesterId = req.user?.id || req.user?.user_id || req.body.requesterId;

      const media = await MediaModel.getById(mediaId);
      if (!media) return res.status(404).json({ success: false, error: 'Media not found' });

      // Signal original uploader/sender to re-upload ciphertext in background
      return res.json({
        success: true,
        mediaId,
        uploaderId: media.uploader_id,
        chatId: media.chat_id,
        message: 'Redelivery request queued to uploader device',
      });
    } catch (err) {
      console.error('[MediaController] Request redelivery error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = MediaController;
