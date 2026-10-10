const db = require('../config/database');
const crypto = require('crypto');

class Room {
  /**
   * Create a new room.
   * @param {Object} params
   * @param {string} params.creatorId - User ID of the creator.
   * @param {string} params.name - Room display name.
   * @param {string} [params.avatarUrl]
   * @param {string} [params.bannerUrl]
   * @param {string} [params.description]
   * @param {string} [params.campus]
   * @param {string} [params.category]
   * @param {boolean} [params.isPublic]
   * @param {boolean} [params.requiresApproval]
   */
  static async create({
    creatorId,
    name,
    avatarUrl,
    bannerUrl,
    description,
    campus,
    category = 'general',
    isPublic = false,
    requiresApproval = true,
  }) {
    const roomId = crypto.randomUUID();
    await db.query(
      `INSERT INTO rooms (room_id, creator_id, name, avatar_url, banner_url, description, campus, category, is_public, requires_approval) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        roomId,
        creatorId,
        name || null,
        avatarUrl || null,
        bannerUrl || null,
        description || null,
        campus || null,
        category,
        isPublic ? 1 : 0,
        requiresApproval ? 1 : 0,
      ]
    );
    // Auto‑create default #general channel for the room
    const defaultChannelId = crypto.randomUUID();
    await db.query(
      `INSERT INTO room_channels (channel_id, room_id, name, type, is_default, created_by) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [defaultChannelId, roomId, 'general', 'TEXT', 1, creatorId]
    );
    // Add creator as owner member
    const membershipId = crypto.randomUUID();
    await db.query(
      `INSERT INTO room_members (membership_id, room_id, user_id, role) VALUES (?, ?, ?, ?)`,
      [membershipId, roomId, creatorId, 'owner']
    );
    return { roomId, defaultChannelId };
  }

  static async findById(roomId) {
    const [rows] = await db.query(
      `SELECT r.*, u.name AS creator_name FROM rooms r LEFT JOIN users u ON r.creator_id = u.user_id WHERE r.room_id = ?`,
      [roomId]
    );
    return rows[0];
  }

  static async getUserRooms(userId) {
    const [rows] = await db.query(
      `SELECT r.*, rm.role, rm.status FROM rooms r 
       JOIN room_members rm ON r.room_id = rm.room_id 
       WHERE rm.user_id = ? ORDER BY r.updated_at DESC`,
      [userId]
    );
    return rows;
  }

  static async update(roomId, updates) {
    const fields = [];
    const values = [];
    Object.keys(updates).forEach(key => {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    });
    if (fields.length === 0) return;
    values.push(roomId);
    await db.query(`UPDATE rooms SET ${fields.join(', ')} WHERE room_id = ?`, values);
  }

  static async delete(roomId) {
    await db.query('DELETE FROM rooms WHERE room_id = ?', [roomId]);
  }
}

module.exports = Room;
