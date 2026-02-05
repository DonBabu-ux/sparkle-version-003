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

        // Validation
        if (!chatId && !recipientId) throw new Error('Recipient or Chat ID required');

        await db.query(`
            INSERT INTO messages (
                message_id, chat_id, recipient_id, sender_id, content, type, media_url, sent_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        `, [messageId, chatId || null, recipientId || null, senderId, content, type, mediaUrl]);

        return messageId;
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
}

module.exports = Message;
