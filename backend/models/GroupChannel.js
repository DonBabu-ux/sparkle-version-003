// models/GroupChannel.js
// Manages channels that belong to a group_chat.
// Each group chat can have many channels; channels are ordered
// by `position` and may be of different types (TEXT, VOICE, etc.).

const db = require('../config/database');
const crypto = require('crypto');

class GroupChannel {
  // ─────────────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a new channel inside a group chat.
   * @param {Object} params
   * @param {string}  params.chatId       - group_chats.chat_id (required)
   * @param {string}  params.name         - display name  (required)
   * @param {string}  [params.type]       - TEXT | VOICE | ANNOUNCEMENT | MEDIA | POLL
   * @param {string}  [params.icon]       - emoji or icon key
   * @param {number}  [params.position]   - sort order (lower = higher up)
   * @param {string}  [params.createdBy]  - user_id of creator
   * @param {boolean} [params.isDefault]  - visible to all by default?
   * @param {boolean} [params.isReadOnly] - only admins can post?
   * @param {boolean} [params.isArchived] - soft-deleted?
   * @returns {Promise<string>} channelId
   */
  static async create({
    chatId,
    name,
    type = 'TEXT',
    icon = '💬',
    position = 0,
    createdBy = null,
    isDefault = true,
    isReadOnly = false,
    isArchived = false,
  }) {
    const channelId = crypto.randomUUID();
    await db.query(
      `INSERT INTO group_channels
         (channel_id, chat_id, name, type, icon, position, created_by, is_default, is_read_only, is_archived)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        channelId,
        chatId,
        name,
        type,
        icon,
        position,
        createdBy,
        isDefault ? 1 : 0,
        isReadOnly ? 1 : 0,
        isArchived ? 1 : 0,
      ]
    );
    return channelId;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Return a single channel by ID.
   * @param {string} channelId
   */
  static async findById(channelId) {
    const [rows] = await db.query(
      `SELECT * FROM group_channels WHERE channel_id = ? LIMIT 1`,
      [channelId]
    );
    return rows[0] || null;
  }

  /**
   * List all non-archived channels for a group chat, ordered by position.
   * @param {string}  chatId
   * @param {boolean} [includeArchived=false]
   */
  static async listByChatId(chatId, includeArchived = false) {
    const archivedClause = includeArchived ? '' : 'AND is_archived = 0';
    const [rows] = await db.query(
      `SELECT * FROM group_channels
       WHERE chat_id = ? ${archivedClause}
       ORDER BY position ASC, created_at ASC`,
      [chatId]
    );
    return rows;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Patch one or more fields on a channel.
   * Only the keys present in `updates` are modified.
   * @param {string} channelId
   * @param {Object} updates - plain key/value pairs matching column names
   */
  static async update(channelId, updates) {
    const ALLOWED = ['name', 'type', 'icon', 'position', 'is_default', 'is_read_only', 'is_archived'];
    const fields = [];
    const values = [];

    Object.entries(updates).forEach(([key, val]) => {
      if (ALLOWED.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(val);
      }
    });

    if (fields.length === 0) return;
    values.push(channelId);
    await db.query(
      `UPDATE group_channels SET ${fields.join(', ')} WHERE channel_id = ?`,
      values
    );
  }

  /**
   * Reorder channels within a chat.
   * @param {Array<{channelId: string, position: number}>} items
   */
  static async reorder(items) {
    const promises = items.map(({ channelId, position }) =>
      db.query(`UPDATE group_channels SET position = ? WHERE channel_id = ?`, [position, channelId])
    );
    await Promise.all(promises);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Hard-delete a channel (and all its messages via CASCADE).
   * @param {string} channelId
   */
  static async delete(channelId) {
    await db.query(`DELETE FROM group_channels WHERE channel_id = ?`, [channelId]);
  }

  /**
   * Soft-delete: mark channel as archived instead of removing it.
   * @param {string} channelId
   */
  static async archive(channelId) {
    await db.query(
      `UPDATE group_channels SET is_archived = 1 WHERE channel_id = ?`,
      [channelId]
    );
  }
}

module.exports = GroupChannel;
