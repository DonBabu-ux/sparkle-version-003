// models/RoomChannel.js
// Model representing a channel within a Room (Sparkle Rooms architecture)
// Provides basic CRUD operations used by the controller layer.

const db = require('../config/database');
const crypto = require('crypto');

/**
 * Columns update() will write.
 *
 * The previous version built the SET clause directly from the caller's keys,
 * which interpolates an arbitrary client-supplied identifier into SQL.
 * Values were bound, so they were safe; the identifier was not. GroupChannel.js
 * and SkillMarket.js already used this allowlist pattern — these had not been
 * converted. Room.update is also called without an ownership check, so an
 * unlisted column such as creator_id could reassign the row's owner.
 */
const UPDATABLE_FIELDS = ['name', 'topic', 'description', 'position', 'is_private'];

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
    // Only columns named in the allowlist. Anything else is skipped rather
    // than interpolated, so a request body cannot add a key or rewrite a
    // column it should not touch.
    for (const key of UPDATABLE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(updates, key)) {
            fields.push(`${key} = ?`);
            values.push(updates[key]);
        }
    }
    if (fields.length === 0) return { status: 'no_fields' };
    values.push(channelId);
    await db.query(`UPDATE room_channels SET ${fields.join(', ')} WHERE channel_id = ?`, values);
    return { status: 'updated', fields: fields.length };
  }

  static async delete(channelId) {
    await db.query(`DELETE FROM room_channels WHERE channel_id = ?`, [channelId]);
  }
}

module.exports = RoomChannel;
