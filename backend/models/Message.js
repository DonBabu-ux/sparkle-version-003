const db = require('../db'); // adjust path to your DB instance

/**
 * Message model abstraction.
 * Assumes a relational DB with a messages table.
 * Adjust queries for your specific DB (e.g., MongoDB).
 */
class Message {
  static async getById(id) {
    const [rows] = await db.query('SELECT * FROM messages WHERE id = ?', [id]);
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
    const [result] = await db.query(
      `INSERT INTO messages (chat_id, sender_id, content, type, media_url, story_id, reply_to_message_id, marketplace_listing_id, view_policy, context, forward_count, created_at) 
       VALUES (?,?,?,?,?,?,?,?,?,?,0, NOW())`,
      [
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
      ]
    );
    return result.insertId;
  }

  /**
   * Increment forward count atomically and return new count.
   */
  static async incrementForwardCount(messageId) {
    const [result] = await db.query(
      'UPDATE messages SET forward_count = forward_count + 1 WHERE id = ? RETURNING forward_count',
      [messageId]
    );
    // For MySQL, RETURNING is not supported; fallback to separate select.
    if (result.affectedRows === 0) return null;
    const [rows] = await db.query('SELECT forward_count FROM messages WHERE id = ?', [messageId]);
    return rows[0].forward_count;
  }
}

module.exports = Message;
