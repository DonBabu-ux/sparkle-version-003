const db = require('../config/database');
const crypto = require('crypto');

class GroupChat {
    static async create({ creatorId, name, photoUrl, description, privacy, isPrivate, settings }) {
        const chatId = crypto.randomUUID();
        const { allowMedia, allowVoice, allowVideo, allowReactions, onlyAdminsSend, onlyAdminsEdit } = settings || {};

        await db.query(`
            INSERT INTO group_chats (
                chat_id, creator_id, name, photo_url, description, privacy, is_private, 
                allow_media, allow_voice_notes, allow_video_calls, allow_reactions,
                only_admins_send, only_admins_edit
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            chatId, creatorId, name || null, photoUrl || null, description || null, privacy || 'open', isPrivate !== false,
            allowMedia !== false, allowVoice !== false, allowVideo !== false, allowReactions !== false,
            onlyAdminsSend ? 1 : 0, onlyAdminsEdit ? 1 : 0
        ]);

        return chatId;
    }

    static async findById(chatId) {
        const [rows] = await db.query(`
            SELECT gc.*, u.name as creator_name
            FROM group_chats gc
            LEFT JOIN users u ON gc.creator_id = u.user_id
            WHERE gc.chat_id = ?
        `, [chatId]);
        return rows[0];
    }

    static async getUserChats(userId) {
        const [rows] = await db.query(`
            SELECT gc.*, gcm.role, gcm.status, 
                   (SELECT content FROM messages WHERE chat_id = gc.chat_id ORDER BY sent_at DESC LIMIT 1) as last_message_content,
                   (SELECT type FROM messages WHERE chat_id = gc.chat_id ORDER BY sent_at DESC LIMIT 1) as last_message_type
            FROM group_chats gc
            JOIN group_chat_members gcm ON gc.chat_id = gcm.chat_id
            WHERE gcm.user_id = ? AND gcm.status != 'left'
            ORDER BY gc.last_message_at DESC
        `, [userId]);
        return rows;
    }

    static async update(chatId, updates) {
        const fields = [];
        const values = [];

        Object.keys(updates).forEach(key => {
            fields.push(`${key} = ?`);
            values.push(updates[key]);
        });

        if (fields.length === 0) return;

        values.push(chatId);
        await db.query(`UPDATE group_chats SET ${fields.join(', ')} WHERE chat_id = ?`, values);
    }

    static async updateLastMessage(chatId) {
        await db.query(`UPDATE group_chats SET last_message_at = NOW() WHERE chat_id = ?`, [chatId]);
    }

    static async delete(chatId) {
        await db.query('DELETE FROM group_chats WHERE chat_id = ?', [chatId]);
    }

    static async getMutualGroups(userId1, userId2) {
        const [rows] = await db.query(`
            SELECT gc.*
            FROM group_chats gc
            JOIN group_chat_members gcm1 ON gc.chat_id = gcm1.chat_id
            JOIN group_chat_members gcm2 ON gc.chat_id = gcm2.chat_id
            WHERE gcm1.user_id = ? 
              AND gcm2.user_id = ?
              AND gcm1.status != 'left'
              AND gcm2.status != 'left'
        `, [userId1, userId2]);
        return rows;
    }
}

module.exports = GroupChat;
