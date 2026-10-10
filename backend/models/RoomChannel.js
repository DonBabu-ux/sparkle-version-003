// models/RoomChannel.js
// Model representing a channel within a Room (Sparkle Rooms architecture)
// Provides basic CRUD operations used by the controller layer.

const db = require('../config/database');
const crypto = require('crypto');

class RoomChannel {
  /**
   * Create a new channel within a room.
   * @param {Object} params - Channel properties.
   *   - roomId: string (required)
   *   - name: string (required)
   *   - description?: string
   *   - icon?: string (emoji or icon name)
   *   - type?: string (defaults to 'TEXT')
   *   - position?: number
   *   - isDefault?: boolean
   *   - isReadOnly?: boolean
   *   - isArchived?: boolean
   *   - isNsfw?: boolean
   *   - slowModeSecs?: number
   *   - createdBy?: string (user id)
   */
  static async create({
    roomId,
    name,
    description = null,
    icon = '💬',
    type = 'TEXT',
    position = 0,
    isDefault = false,
    isReadOnly = false,
    isArchived = false,
    isNsfw = false,
    slowModeSecs = 0,
    createdBy = null,
  }) {
    const channelId = crypto.randomUUID();
    await db.query(`
      INSERT INTO room_channels (
        channel_id, room_id, name, description, icon, type, position, is_default, is_read_only, is_archived, is_nsfw, slow_mode_secs, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      channelId,
      roomId,
      name,
      description,
      icon,
      type,
      position,
      isDefault ? 1 : 0,
      isReadOnly ? 1 : 0,
      isArchived ? 1 : 0,
      isNsfw ? 1 : 0,
      slowModeSecs,
      createdBy,
    ]);
    return channelId;
  }

  static async findById(channelId) {
    const [rows] = await db.query(`SELECT * FROM room_channels WHERE channel_id = ?`, [channelId]);
    return rows[0];
  }

  static async listByRoom(roomId) {
    const [rows] = await db.query(`SELECT * FROM room_channels WHERE room_id = ? ORDER BY position ASC`, [roomId]);
    return rows;
  }

  static async update(channelId, updates) {
    const fields = [];
    const values = [];
    Object.entries(updates).forEach(([key, val]) => {
      fields.push(`${key} = ?`);
      values.push(val);
    });
    if (fields.length === 0) return;
    values.push(channelId);
    await db.query(`UPDATE room_channels SET ${fields.join(', ')} WHERE channel_id = ?`, values);
  }

  static async delete(channelId) {
    await db.query(`DELETE FROM room_channels WHERE channel_id = ?`, [channelId]);
  }
}

module.exports = RoomChannel;
