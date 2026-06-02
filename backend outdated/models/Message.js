const db = require('../../config/database'); // adjust path to your DB instance
const crypto = require('crypto');

/**
 * Message model abstraction.
 * Assumes a relational DB with a messages table.
 * Adjust queries for your specific DB (e.g., MongoDB).
 */
class Message {
  static async getById(id) {
    const [rows] = await db.query('SELECT * FROM messages WHERE message_id = ?', [id]);
    return rows[0] || null;
  }

  static async sendMessage(payload) {
    const {
      chatId,
      senderId,
      content,
      type,
      mediaUrl,
      storyId,
      replyToId,
      marketplaceListingId,
      viewPolicy,
      context,
    } = payload;

    const messageId = crypto.randomUUID();

    // Fetch sender's custom privacy settings for this chat
    let allowForward = 1;
    let allowCopy = 1;
    let blockScreenshot = 0;
    let blurScreenRecording = 1;
    let notifyScreenshotAttempts = 1;

    try {
      const [rows] = await db.query(
        'SELECT allow_forward, allow_copy, block_screenshot, blur_screen_recording, notify_screenshot_attempts FROM chat_privacy_settings WHERE chat_id = ? AND user_id = ?',
        [chatId, senderId]
      );
      if (rows && rows.length > 0) {
        allowForward = rows[0].allow_forward;
        allowCopy = rows[0].allow_copy;
        blockScreenshot = rows[0].block_screenshot;
        blurScreenRecording = rows[0].blur_screen_recording;
        notifyScreenshotAttempts = rows[0].notify_screenshot_attempts;
      }
    } catch (err) {
      console.error('Error fetching chat privacy settings for message snapshot:', err);
    }

    await db.query(
      `INSERT INTO messages (message_id, chat_id, sender_id, content, type, media_url, story_id, reply_to_message_id, marketplace_listing_id, view_policy, context, forward_count, allow_forward, allow_copy, block_screenshot, blur_screen_recording, notify_screenshot_attempts, created_at) 
       VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?,?, NOW())`,
      [
        messageId,
        chatId,
        senderId,
        content,
        type,
        mediaUrl,
        storyId,
        replyToId,
        marketplaceListingId,
        viewPolicy,
        context,
        allowForward,
        allowCopy,
        blockScreenshot,
        blurScreenRecording,
        notifyScreenshotAttempts,
      ]
    );
    return messageId;
  }

  // Increment forward count atomically and return new count.
  static async incrementForwardCount(messageId) {
    // Update forward count
    const [result] = await db.query('UPDATE messages SET forward_count = forward_count + 1 WHERE message_id = ?', [messageId]);
    if (result.affectedRows === 0) return null;
    const [rows] = await db.query('SELECT forward_count FROM messages WHERE message_id = ?', [messageId]);
    return rows[0].forward_count;
  }

  // Update permissions for a message (store JSON object)
  static async updatePermissions(messageId, permissions) {
    const [result] = await db.query('UPDATE messages SET permissions = ? WHERE message_id = ?', [JSON.stringify(permissions), messageId]);
    return result.affectedRows > 0;
  }

  // Toggle reaction (return updated reactions object)
  static async toggleReaction(messageId, userId, reaction) {
    const [rows] = await db.query('SELECT reactions FROM messages WHERE message_id = ?', [messageId]);
    let reactions = rows[0].reactions ? JSON.parse(rows[0].reactions) : {};
    if (!reactions[reaction]) reactions[reaction] = [];
    const idx = reactions[reaction].indexOf(userId);
    if (idx === -1) reactions[reaction].push(userId);
    else reactions[reaction].splice(idx, 1);
    const [result] = await db.query('UPDATE messages SET reactions = ? WHERE message_id = ?', [JSON.stringify(reactions), messageId]);
    return result.affectedRows > 0 ? reactions : null;
  }

  // Add deleted for a specific user (soft delete)
  static async addDeletedFor(messageId, userId) {
    const [result] = await db.query('UPDATE messages SET deleted_for = JSON_ARRAY_APPEND(COALESCE(deleted_for, JSON_ARRAY()), ?, ?) WHERE message_id = ?', ["$", userId, messageId]);
    return result.affectedRows > 0;
  }

  // Mark as deleted for all (hard delete)
  static async markAsDeletedForAll(messageId) {
    const [result] = await db.query('DELETE FROM messages WHERE message_id = ?', [messageId]);
    return result.affectedRows > 0;
  }

  // Edit content (wrapper for editMessage)
  static async editContent(messageId, { text, media }) {
    const [result] = await db.query('UPDATE messages SET content = ?, edited = TRUE WHERE message_id = ?', [text || media, messageId]);
    // Return updated info, for simplicity just timestamp
    const [rows] = await db.query('SELECT edited_at FROM messages WHERE message_id = ?', [messageId]);
    return { editedAt: rows[0].edited_at };
  }

  // Existing editMessage method (kept for compatibility)
  static async editMessage(messageId, newContent) {
    const [result] = await db.query('UPDATE messages SET content = ?, edited = TRUE WHERE message_id = ?', [newContent, messageId]);
    return result.affectedRows > 0;
  }
}

module.exports = Message;

