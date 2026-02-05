const db = require('../config/database');
const crypto = require('crypto');

class GroupMember {
    static async add({ chatId, userId, role = 'member', status = 'active' }) {
        const membershipId = crypto.randomUUID();
        await db.query(`
            INSERT INTO group_chat_members (membership_id, chat_id, user_id, role, status)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE status = VALUES(status), role = VALUES(role)
        `, [membershipId, chatId, userId, role, status]);
        return membershipId;
    }

    static async addMany(members) {
        if (!members || members.length === 0) return;

        // This supports batch insert, but for simplicity/safety with mixed existing users we might loop or robust query
        // For now, simple loop is safer for UUID generation per row if needed, or constructed query
        for (const member of members) {
            await this.add(member);
        }
    }

    static async find(chatId, userId) {
        const [rows] = await db.query(
            'SELECT * FROM group_chat_members WHERE chat_id = ? AND user_id = ?',
            [chatId, userId]
        );
        return rows[0];
    }

    static async getMembers(chatId) {
        const [rows] = await db.query(`
            SELECT gcm.*, u.name, u.username, u.avatar_url, u.is_online, u.last_seen_at
            FROM group_chat_members gcm
            JOIN users u ON gcm.user_id = u.user_id
            WHERE gcm.chat_id = ? AND gcm.status != 'left'
        `, [chatId]);
        return rows;
    }

    static async updateStatus(chatId, userId, status) {
        await db.query(
            'UPDATE group_chat_members SET status = ? WHERE chat_id = ? AND user_id = ?',
            [status, chatId, userId]
        );
    }

    static async remove(chatId, userId) {
        await db.query(
            'DELETE FROM group_chat_members WHERE chat_id = ? AND user_id = ?',
            [chatId, userId]
        );
    }

    static async isAdmin(chatId, userId) {
        const member = await this.find(chatId, userId);
        return member && (member.role === 'admin' || member.role === 'creator');
    }
}

module.exports = GroupMember;
