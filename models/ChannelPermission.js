const db = require('../config/database');
const crypto = require('crypto');

class ChannelPermission {
  static async create({ channelId, role, permissions }) {
    const { canSend = 1, canAttach = 1, canReact = 1, canPin = 0, canManage = 0, canInvite = 0, canMentionAll = 0 } = permissions || {};
    await db.query(`
      INSERT INTO channel_permissions (
        permission_id, channel_id, role, can_send, can_attach, can_react, can_pin, can_manage, can_invite, can_mention_all
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      crypto.randomUUID(),
      channelId,
      role,
      canSend,
      canAttach,
      canReact,
      canPin,
      canManage,
      canInvite,
      canMentionAll
    ]);
  }

  static async getByChannelAndRole(channelId, role) {
    const [rows] = await db.query(`SELECT * FROM channel_permissions WHERE channel_id = ? AND role = ?`, [channelId, role]);
    return rows[0];
  }

  static async update(channelId, role, updates) {
    const fields = [];
    const values = [];
    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = ?`);
      values.push(value);
    });
    if (fields.length === 0) return;
    values.push(channelId, role);
    await db.query(`UPDATE channel_permissions SET ${fields.join(', ')} WHERE channel_id = ? AND role = ?`, values);
  }
}

module.exports = ChannelPermission;
