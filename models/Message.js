const db = require('../config/database');
const crypto = require('crypto');

class Message {
    // Start or get conversation
    // In this schema, a conversation is just a virtual link between two users.
    // So "conversationId" is conceptually the partner's userId for direct messaging.
    static async getOrCreateConversation(currentUserId, partnerId) {
        // Just verify the partner exists
        const [users] = await db.query('SELECT user_id FROM users WHERE user_id = ?', [partnerId]);
        if (users.length === 0) {
            return null;
        }
        // In the absence of a conversations table, the 'ID' of the conversation 
        // from the perspective of the frontend is the partner's ID.
        return partnerId;
    }

    // Send message (support for Direct and Group)
    static async sendMessage({ recipientId, chatId, senderId, content, type = 'text', mediaUrl = null }) {
        const messageId = crypto.randomUUID();

        console.log(`[DEBUG] Message.sendMessage: model preparing query for ${messageId}`);
        console.log(`[DEBUG] Params:`, { recipientId, chatId, senderId, type });

        // Validation
        if (!chatId && !recipientId) {
            console.error('[ERROR] Message.sendMessage: validation failed');
            throw new Error('Recipient or Chat ID required');
        }

        try {
            await db.query(`
                INSERT INTO messages (
                    message_id, chat_id, recipient_id, sender_id, content, type, media_url, sent_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            `, [messageId, chatId || null, recipientId || null, senderId, content, type, mediaUrl]);

            console.log(`[DEBUG] Message.sendMessage: query executed successfully`);
            return messageId;
        } catch (dbError) {
            console.error('[ERROR] Message.sendMessage DB Error:', dbError);
            throw dbError;
        }
    }

    // Get messages for conversation (Personal)
    static async getMessages(partnerId, currentUserId) {
        const [messages] = await db.query(`
            SELECT 
                m.*,
                u.name as sender_name, 
                u.username as sender_username, 
                u.avatar_url as sender_avatar
            FROM messages m
            JOIN users u ON m.sender_id = u.user_id
            WHERE (m.sender_id = ? AND m.recipient_id = ?)
               OR (m.sender_id = ? AND m.recipient_id = ?)
            ORDER BY m.sent_at ASC
        `, [currentUserId, partnerId, partnerId, currentUserId]);

        return messages;
    }

    // Get messages for Group Chat
    static async getGroupMessages(chatId) {
        const [messages] = await db.query(`
            SELECT 
                m.*,
                u.name as sender_name, 
                u.username as sender_username, 
                u.avatar_url as sender_avatar
            FROM messages m
            JOIN users u ON m.sender_id = u.user_id
            WHERE m.chat_id = ?
            ORDER BY m.sent_at ASC
        `, [chatId]);

        return messages;
    }

    // Get user's conversations (Mixed: Direct + Groups will be handled by merging lists or separate calls)
    // This existing method is for 1-on-1. We will keep it but GroupChat.getUserChats handles groups.
    static async getUserConversations(userId) {
        // ... (Existing logic for direct messages)
        const [rows] = await db.query(`
            SELECT 
                m.content as last_message,
                m.sent_at as last_message_at,
                m.sent_at as last_message_time,
                m.sender_id as last_message_sender_id,
                
                u.user_id as conversation_id,
                u.user_id as partner_id,
                u.name as partner_name,
                u.username as partner_username,
                u.avatar_url as partner_avatar,
                u.is_online
            FROM messages m
            INNER JOIN (
                SELECT 
                    IF(sender_id = ?, recipient_id, sender_id) as partner_id,
                    MAX(sent_at) as max_sent_at
                FROM messages
                WHERE (sender_id = ? OR recipient_id = ?) AND chat_id IS NULL
                GROUP BY partner_id
            ) latest ON (
                IF(m.sender_id = ?, m.recipient_id, m.sender_id) = latest.partner_id 
                AND m.sent_at = latest.max_sent_at
            )
            JOIN users u ON latest.partner_id = u.user_id
            ORDER BY m.sent_at DESC
        `, [userId, userId, userId, userId]);

        return rows;
    }

    static async checkFollowStatus(currentUserId, targetUserId) {
        const [results] = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = ?) as is_following,
                (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = ?) as is_followed_by,
                (SELECT COUNT(*) FROM users WHERE user_id = ?) as user_exists
        `, [currentUserId, targetUserId, targetUserId, currentUserId, targetUserId]);

        if (results[0].user_exists === 0) return { error: 'User not found' };

        return {
            is_following: results[0].is_following > 0,
            is_followed_by: results[0].is_followed_by > 0
        };
    }

    // Soft-delete a message (only by sender)
    static async deleteMessage(messageId, userId) {
        const [result] = await db.query(
            'UPDATE messages SET deleted_at = NOW(), content = "[Message deleted]" WHERE message_id = ? AND sender_id = ?',
            [messageId, userId]
        );
        return result.affectedRows > 0;
    }

    // Edit a message (only by sender, within 15 minutes)
    static async editMessage(messageId, userId, newContent) {
        const [result] = await db.query(
            `UPDATE messages 
             SET content = ?, edited_at = NOW() 
             WHERE message_id = ? AND sender_id = ? 
               AND deleted_at IS NULL
               AND TIMESTAMPDIFF(MINUTE, sent_at, NOW()) <= 15`,
            [newContent, messageId, userId]
        );
        return result.affectedRows > 0;
    }

    // Add or update a reaction to a message
    static async addReaction(messageId, userId, emoji) {
        await db.query(
            `INSERT INTO message_reactions (message_id, user_id, emoji, reacted_at)
             VALUES (?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE emoji = VALUES(emoji), reacted_at = NOW()`,
            [messageId, userId, emoji]
        );
        return true;
    }

    // Remove a reaction
    static async removeReaction(messageId, userId) {
        const [result] = await db.query(
            'DELETE FROM message_reactions WHERE message_id = ? AND user_id = ?',
            [messageId, userId]
        );
        return result.affectedRows > 0;
    }

    // Mark all messages from a partner as read
    static async markMessagesRead(partnerId, currentUserId) {
        const [result] = await db.query(
            `UPDATE messages 
             SET read_at = NOW() 
             WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL AND deleted_at IS NULL`,
            [partnerId, currentUserId]
        );
        return result.affectedRows;
    }

    // Search messages within a 1-on-1 conversation
    static async searchMessages(userId, partnerId, query) {
        const [messages] = await db.query(
            `SELECT m.*, u.name as sender_name, u.username as sender_username, u.avatar_url as sender_avatar
             FROM messages m
             JOIN users u ON m.sender_id = u.user_id
             WHERE ((m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?))
               AND m.content LIKE ?
               AND m.deleted_at IS NULL
             ORDER BY m.sent_at DESC
             LIMIT 50`,
            [userId, partnerId, partnerId, userId, `%${query}%`]
        );
        return messages;
    }

    // Mute or unmute a conversation
    static async muteConversation(userId, partnerId, muted = true) {
        if (muted) {
            await db.query(
                `INSERT INTO muted_conversations (user_id, partner_id, muted_at)
                 VALUES (?, ?, NOW())
                 ON DUPLICATE KEY UPDATE muted_at = NOW()`,
                [userId, partnerId]
            );
        } else {
            await db.query(
                'DELETE FROM muted_conversations WHERE user_id = ? AND partner_id = ?',
                [userId, partnerId]
            );
        }
        return true;
    }

    // Get a single message by ID
    static async getById(messageId) {
        const [rows] = await db.query(
            'SELECT * FROM messages WHERE message_id = ?',
            [messageId]
        );
        return rows[0] || null;
    }
}

module.exports = Message;
