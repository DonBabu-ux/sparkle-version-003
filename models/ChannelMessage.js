const db = require('../config/database');
const crypto = require('crypto');

class ChannelMessage {
  static async create({ channelId, senderId, type = 'text', content = null, mediaUrl = null, mediaType = null, replyToId = null }) {
    const messageId = crypto.randomUUID();
    await db.query(`
      INSERT INTO channel_messages (
        message_id, channel_id, sender_id, type, content, media_url, media_type, reply_to_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [messageId, channelId, senderId, type, content, mediaUrl, mediaType, replyToId]);
    return messageId;
  }

  static async findById(messageId) {
    const [rows] = await db.query('SELECT * FROM channel_messages WHERE message_id = ?', [messageId]);
    return rows[0];
  }

  static async getChannelMessages(channelId, limit = 50, offset = 0) {
    const [rows] = await db.query(`
      SELECT * FROM channel_messages WHERE channel_id = ? ORDER BY sent_at DESC LIMIT ? OFFSET ?
    `, [channelId, limit, offset]);
    return rows;
  }

  static async update(messageId, updates) {
    const fields = [];
    const values = [];
    Object.entries(updates).forEach(([key, val]) => {
      fields.push(`${key} = ?`);
      values.push(val);
    });
    if (fields.length === 0) return;
    values.push(messageId);
    await db.query(`UPDATE channel_messages SET ${fields.join(', ')} WHERE message_id = ?`, values);
  }

  static async delete(messageId) {
    await db.query('DELETE FROM channel_messages WHERE message_id = ?', [messageId]);
  }
}

module.exports = ChannelMessage;
