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
const UPDATABLE_FIELDS = ['name', 'description', 'avatar_url', 'group_type', 'is_private'];

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
    values.push(chatId);
    await db.query(`UPDATE group_chats SET ${fields.join(', ')} WHERE chat_id = ?`, values);
    return { status: 'updated', fields: fields.length };
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
