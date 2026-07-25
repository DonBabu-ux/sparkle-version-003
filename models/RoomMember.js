const db = require('../config/database');
const crypto = require('crypto');

class RoomMember {
  /**
   * Add a user to a room with a role.
   */
  static async add({ roomId, userId, role = 'member', invitedBy = null }) {
    const membershipId = crypto.randomUUID();
    await db.query(
      `INSERT INTO room_members (membership_id, room_id, user_id, role, invited_by) VALUES (?, ?, ?, ?, ?)`,
      [membershipId, roomId, userId, role, invitedBy]
    );
    return membershipId;
  }

  /** Remove a member from a room */
  static async remove(roomId, userId) {
    await db.query(
      `DELETE FROM room_members WHERE room_id = ? AND user_id = ?`,
      [roomId, userId]
    );
  }

  /** Update a member's role */
  static async updateRole(roomId, userId, role) {
    await db.query(
      `UPDATE room_members SET role = ?, status = 'active' WHERE room_id = ? AND user_id = ?`,
      [role, roomId, userId]
    );
  }

  /** Get members of a room */
  static async list(roomId) {
    const [rows] = await db.query(
      `SELECT rm.*, u.name, u.avatar_url FROM room_members rm JOIN users u ON rm.user_id = u.user_id WHERE rm.room_id = ?`,
      [roomId]
    );
    return rows;
  }
}

module.exports = RoomMember;
