const db = require('../config/database');
const crypto = require('crypto');

class Message {
    /**
     * Start or get conversation
     */
    static async getOrCreateConversation(currentUserId, partnerId, listingId = null) {
        // Build the query and params
        let query = `
            SELECT chat_id FROM personal_chats 
            WHERE ((participant1_id = ? AND participant2_id = ?)
               OR (participant1_id = ? AND participant2_id = ?))
        `;
        let params = [currentUserId, partnerId, partnerId, currentUserId];

        if (listingId) {
            query += ` AND marketplace_listing_id = ? `;
            params.push(listingId);
        } else {
            query += ` AND marketplace_listing_id IS NULL `;
        }

        const [existing] = await db.query(query, params);

        if (existing && existing.length > 0) {
            return existing[0].chat_id;
        }

        // Create new personal chat
        const chatId = crypto.randomUUID();
        await db.query(`
            INSERT INTO personal_chats (chat_id, participant1_id, participant2_id, marketplace_listing_id)
            VALUES (?, ?, ?, ?)
        `, [chatId, currentUserId, partnerId, listingId]);

        return chatId;
    }

    /**
     * Send message (Direct or Group)
     */
    static async sendMessage({ recipientId, chatId, senderId, content, type = 'text', mediaUrl = null, storyId = null, replyToId = null, marketplaceListingId = null, viewPolicy = 'unlimited', context = 'chat' }) {
        const messageId = crypto.randomUUID();
        let personalChatId = null;
        let groupChatId = null;

        if (recipientId) {
            personalChatId = await this.getOrCreateConversation(senderId, recipientId, marketplaceListingId);
        } else if (chatId) {
            groupChatId = chatId;
        } else {
            throw new Error('Recipient or Chat ID required');
        }

        let viewsAllowed = 1;
        if (viewPolicy === 'twice') viewsAllowed = 2;
        if (viewPolicy === 'unlimited') viewsAllowed = 99999;

        // Auto-infer marketplace context
        if (context === 'chat' && marketplaceListingId) context = 'marketplace';

        // Block Check Enforcement (Point 5)
        if (recipientId) {
            const [blocked] = await db.query(
                'SELECT 1 FROM user_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
                [senderId, recipientId, recipientId, senderId]
            );
            if (blocked.length > 0) {
                throw new Error('You cannot message this user (blocked)');
            }
        }

        const sentAt = new Date();
        try {
            await db.query(`
                INSERT INTO messages (
                    message_id, chat_id, conversation_id, sender_id, content, 
                    type, media_url, reply_to_message_id, marketplace_listing_id, status, sent_at,
                    view_policy, views_allowed, context
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', ?, ?, ?, ?)
            `, [messageId, groupChatId, personalChatId, senderId, content, type, mediaUrl, replyToId, marketplaceListingId, sentAt, viewPolicy, viewsAllowed, context]);

            // Update last_message_time and clear archives/deletions
            if (personalChatId) {
                await db.query(`
                    UPDATE personal_chats 
                    SET last_message_time = ?,
                        is_archived_p1 = 0,
                        is_archived_p2 = 0,
                        is_deleted_p1 = 0,
                        is_deleted_p2 = 0
                    WHERE chat_id = ?
                `, [sentAt, personalChatId]);
            } else if (groupChatId) {
                 await db.query(`
                    UPDATE group_chats 
                    SET last_message_at = ?
                    WHERE chat_id = ?
                `, [sentAt, groupChatId]);
            }

            return messageId;
        } catch (dbError) {
            console.error('[ERROR] Message.sendMessage DB Error:', dbError);
            throw dbError;
        }
    }

    /**
     * Get messages for conversation
     */
    static async getMessages(input, userId) {
        // 'input' could be a partnerId (user_id) or a conversationId (chat_id)
        let chatId = input;

        // Try to find if input is already a chat_id
        const [chatExists] = await db.query(`
            SELECT chat_id FROM personal_chats 
            WHERE chat_id = ? AND (participant1_id = ? OR participant2_id = ?)
        `, [input, userId, userId]);

        if (chatExists.length === 0) {
            // Check if it's a group chat_id
            const [groupExists] = await db.query('SELECT chat_id FROM group_chats WHERE chat_id = ?', [input]);
            if (groupExists.length === 0) {
                // Assume it's a partnerId and find/create the conversation
                chatId = await this.getOrCreateConversation(userId, input);
            }
        }
        
        // Re-check chat type for the query
        const [pc] = await db.query('SELECT chat_id FROM personal_chats WHERE chat_id = ?', [chatId]);
        
        let query;
        if (pc.length > 0) {
            // Rest of the query remains the same, but we return the resolved chatId too
            query = `
                SELECT 
                    m.*,
                    u.name as sender_name, 
                    u.username as sender_username, 
                    u.avatar_url as sender_avatar,
                    (SELECT JSON_ARRAYAGG(JSON_OBJECT('emoji', r.emoji, 'user_id', r.user_id)) 
                     FROM message_reactions r WHERE r.message_id = m.message_id) as reactions,
                    rm.content as reply_content,
                    rm.type as reply_type,
                    ml.title as listing_title,
                    ml.price as listing_price,
                    ml.image_url as listing_image
                FROM messages m
                JOIN users u ON m.sender_id = u.user_id
                LEFT JOIN messages rm ON m.reply_to_message_id = rm.message_id
                LEFT JOIN marketplace_listings ml ON m.marketplace_listing_id = ml.listing_id
                WHERE (m.conversation_id = ? OR m.chat_id = ?)
                  AND m.message_id NOT IN (SELECT message_id FROM message_deletions WHERE user_id = ?)
                ORDER BY m.sent_at ASC
            `;
            const [messages] = await db.query(query, [chatId, chatId, userId]);
            // Ensure all dates are returned as ISO strings for client-side UTC parsing
            const normalized = messages.map(m => ({
                ...m,
                sent_at: m.sent_at ? new Date(m.sent_at).toISOString() : null,
                delivered_at: m.delivered_at ? new Date(m.delivered_at).toISOString() : null,
                read_at: m.read_at ? new Date(m.read_at).toISOString() : null
            }));
            return { chatId, messages: normalized };
        } else {
            query = `
                SELECT 
                    m.*,
                    u.name as sender_name, 
                    u.username as sender_username, 
                    u.avatar_url as sender_avatar,
                    (SELECT JSON_ARRAYAGG(JSON_OBJECT('emoji', r.emoji, 'user_id', r.user_id)) 
                     FROM message_reactions r WHERE r.message_id = m.message_id) as reactions,
                    rm.content as reply_content,
                    rm.type as reply_type,
                    ml.title as listing_title,
                    ml.price as listing_price,
                    ml.image_url as listing_image
                FROM messages m
                JOIN users u ON m.sender_id = u.user_id
                LEFT JOIN messages rm ON m.reply_to_message_id = rm.message_id
                LEFT JOIN marketplace_listings ml ON m.marketplace_listing_id = ml.listing_id
                WHERE m.chat_id = ?
                  AND m.message_id NOT IN (SELECT message_id FROM message_deletions WHERE user_id = ?)
                ORDER BY m.sent_at ASC
            `;
            const [messages] = await db.query(query, [chatId, userId]);
            // Ensure all dates are returned as ISO strings for client-side UTC parsing
            const normalized = messages.map(m => ({
                ...m,
                sent_at: m.sent_at ? new Date(m.sent_at).toISOString() : null,
                delivered_at: m.delivered_at ? new Date(m.delivered_at).toISOString() : null,
                read_at: m.read_at ? new Date(m.read_at).toISOString() : null
            }));
            return { chatId, messages: normalized };
        }
    }

    /**
     * Get user's active conversations (Personal + Group)
     */
    static async getUserConversations(userId) {
        // This is a complex query to combine personal and group chats with latest messages
        const [rows] = await db.query(`
            SELECT * FROM (
                -- Personal Chats
                SELECT 
                    pc.chat_id,
                    'personal' as chat_type,
                    u.user_id as partner_id,
                    u.name as partner_name,
                    u.username as partner_username,
                    u.avatar_url as partner_avatar,
                    u.is_online,
                    u.last_seen_at,
                    m.content as last_message,
                    m.type as last_message_type,
                    m.sent_at as last_message_at,
                    m.sender_id as last_message_sender_id,
                    m.status as last_message_status,
                    (SELECT COUNT(*) FROM messages m2 
                     WHERE m2.conversation_id = pc.chat_id 
                     AND m2.sender_id != ? AND m2.status != 'read') as unread_count,
                    IF(pc.participant1_id = ?, pc.is_pinned_p1, pc.is_pinned_p2) as is_pinned,
                    IF(pc.participant1_id = ?, pc.is_muted_p1, pc.is_muted_p2) as is_muted,
                    IF(pc.participant1_id = ?, pc.is_archived_p1, pc.is_archived_p2) as is_archived,
                    2 as member_count,
                    pc.marketplace_listing_id,
                    pc.disappearing_duration,
                    ml.title as listing_title,
                    'member' as role,
                    0 as only_admins_send,
                    'members' as edit_info
                FROM personal_chats pc
                JOIN users u ON (u.user_id = IF(pc.participant1_id = ?, pc.participant2_id, pc.participant1_id))
                LEFT JOIN marketplace_listings ml ON pc.marketplace_listing_id = ml.listing_id
                LEFT JOIN messages m ON m.message_id = (
                    SELECT message_id FROM messages 
                    WHERE conversation_id = pc.chat_id 
                    ORDER BY sent_at DESC LIMIT 1
                )
                WHERE (pc.participant1_id = ? AND pc.is_deleted_p1 = 0) 
                   OR (pc.participant2_id = ? AND pc.is_deleted_p2 = 0)

                UNION ALL

                -- Group Chats
                SELECT 
                    gc.chat_id,
                    'group' as chat_type,
                    NULL as partner_id,
                    gc.name as partner_name,
                    NULL as partner_username,
                    gc.photo_url as partner_avatar,
                    0 as is_online,
                    NULL as last_seen_at,
                    m.content as last_message,
                    m.type as last_message_type,
                    m.sent_at as last_message_at,
                    m.sender_id as last_message_sender_id,
                    m.status as last_message_status,
                    0 as unread_count, 
                    0 as is_pinned,
                    0 as is_muted,
                    0 as is_archived,
                    (SELECT COUNT(*) FROM group_chat_members WHERE chat_id = gc.chat_id AND status != 'left') as member_count,
                    NULL as marketplace_listing_id,
                    0 as disappearing_duration,
                    NULL as listing_title,
                    gcm.role,
                    gc.only_admins_send,
                    gc.only_admins_edit as edit_info
                FROM group_chats gc
                JOIN group_chat_members gcm ON gc.chat_id = gcm.chat_id
                LEFT JOIN messages m ON m.message_id = (
                    SELECT message_id FROM messages 
                    WHERE chat_id = gc.chat_id 
                    ORDER BY sent_at DESC LIMIT 1
                )
                WHERE gcm.user_id = ? AND gcm.status = 'active'
            ) as conversations
            ORDER BY is_pinned DESC, last_message_at DESC
        `, [userId, userId, userId, userId, userId, userId, userId, userId]);

        return rows.map(conv => ({
            ...conv,
            last_message_at: conv.last_message_at ? new Date(conv.last_message_at).toISOString() : null,
            last_seen_at: conv.last_seen_at ? new Date(conv.last_seen_at).toISOString() : null
        }));
    }

    /**
     * Mark messages as delivered/read
     */
    static async updateStatus(chatId, userId, status) {
        // userId is the one who IS NOT the sender
        await db.query(`
            UPDATE messages 
            SET status = ?, read_at = IF(? = 'read', NOW(), read_at)
            WHERE (conversation_id = ? OR chat_id = ?) 
              AND sender_id != ? 
              AND status != 'read'
        `, [status, status, chatId, chatId, userId]);
        return true;
    }

    /**
     * Soft delete for user (Delete for me)
     */
    static async deleteForMe(messageId, userId) {
        const deletionId = crypto.randomUUID();
        await db.query(`
            INSERT IGNORE INTO message_deletions (deletion_id, message_id, user_id)
            VALUES (?, ?, ?)
        `, [deletionId, messageId, userId]);
        return true;
    }

    /**
     * Delete for everyone
     */
    static async deleteForEveryone(messageId, userId, isAdminOverride = false, adminUsername = '') {
        let content = '[Message deleted]';
        if (isAdminOverride && adminUsername) {
            content = `[Message deleted by admin ${adminUsername}]`;
        }

        const query = isAdminOverride 
            ? `UPDATE messages SET is_deleted_for_everyone = 1, content = ? WHERE message_id = ?`
            : `UPDATE messages SET is_deleted_for_everyone = 1, content = ? WHERE message_id = ? AND sender_id = ?`;
        
        const params = isAdminOverride ? [content, messageId] : [content, messageId, userId];
        const [result] = await db.query(query, params);
        return result.affectedRows > 0;
    }

    /**
     * Add/Update Reaction
     */
    static async addReaction(messageId, userId, emoji) {
        const reactionId = crypto.randomUUID();
        await db.query(`
            INSERT INTO message_reactions (reaction_id, message_id, user_id, emoji)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE emoji = VALUES(emoji)
        `, [reactionId, messageId, userId, emoji]);
        return true;
    }

    /**
     * Remove Reaction
     */
    static async removeReaction(messageId, userId, emoji) {
        await db.query(`
            DELETE FROM message_reactions 
            WHERE message_id = ? AND user_id = ? AND emoji = ?
        `, [messageId, userId, emoji]);
        return true;
    }

    /**
     * Edit a message (only by sender, within 15 minutes)
     */
    static async editMessage(messageId, userId, newContent) {
        const [result] = await db.query(
            `UPDATE messages 
             SET content = ?, edited_at = NOW() 
             WHERE message_id = ? AND sender_id = ? 
               AND is_deleted_for_everyone = 0
               AND TIMESTAMPDIFF(MINUTE, sent_at, NOW()) <= 15`,
            [newContent, messageId, userId]
        );
        return result.affectedRows > 0;
    }

    /**
     * Search messages within a conversation
     */
    static async searchMessages(userId, chatId, query) {
        const [messages] = await db.query(
            `SELECT m.*, u.name as sender_name, u.username as sender_username, u.avatar_url as sender_avatar
             FROM messages m
             JOIN users u ON m.sender_id = u.user_id
             WHERE (m.conversation_id = ? OR m.chat_id = ?)
               AND m.content LIKE ?
               AND m.message_id NOT IN (SELECT message_id FROM message_deletions WHERE user_id = ?)
               AND m.is_deleted_for_everyone = 0
             ORDER BY m.sent_at DESC
             LIMIT 50`,
            [chatId, chatId, `%${query}%`, userId]
        );
        return messages;
    }

    /**
     * Mute or unmute a conversation
     */
    static async muteConversation(userId, chatId, muted = true) {
        const [chat] = await db.query('SELECT participant1_id, participant2_id FROM personal_chats WHERE chat_id = ?', [chatId]);
        if (chat.length === 0) return false;

        const isP1 = chat[0].participant1_id === userId;
        const column = isP1 ? 'is_muted_p1' : 'is_muted_p2';

        await db.query(`UPDATE personal_chats SET ${column} = ? WHERE chat_id = ?`, [muted ? 1 : 0, chatId]);
        return true;
    }

    /**
     * Archive or unarchive a conversation
     */
    static async archiveConversation(userId, chatId, archived = true) {
        const [chat] = await db.query('SELECT participant1_id, participant2_id FROM personal_chats WHERE chat_id = ?', [chatId]);
        if (chat.length === 0) return false;

        const isP1 = chat[0].participant1_id === userId;
        const column = isP1 ? 'is_archived_p1' : 'is_archived_p2';

        await db.query(`UPDATE personal_chats SET ${column} = ? WHERE chat_id = ?`, [archived ? 1 : 0, chatId]);
        return true;
    }

    /**
     * Soft delete a conversation (clears history for a user)
     */
    static async deleteConversation(userId, chatId) {
        // Clear all messages for this user by inserting into message_deletions
        const [messages] = await db.query('SELECT message_id FROM messages WHERE (conversation_id = ? OR chat_id = ?)', [chatId, chatId]);
        if (messages.length > 0) {
            const values = messages.map(m => `(UUID(), '${m.message_id}', '${userId}')`).join(',');
            await db.query(`INSERT IGNORE INTO message_deletions (deletion_id, message_id, user_id) VALUES ${values}`);
        }
        return true;
    }

    // Existing helpers
    static async getById(messageId) {
        const [rows] = await db.query('SELECT * FROM messages WHERE message_id = ?', [messageId]);
        return rows[0] || null;
    }

    /**
     * Process Message View (for View Once / Twice)
     */
    static async processMessageView(messageId) {
        const msg = await this.getById(messageId);
        if (!msg) return null;

        if (msg.view_policy !== 'unlimited') {
            const newViews = msg.views_used + 1;
            if (newViews >= msg.views_allowed) {
                // Hard delete or softly delete content
                await db.query(`
                    UPDATE messages 
                    SET is_deleted_for_everyone = 1, content = '[Media Expired]', media_url = NULL 
                    WHERE message_id = ?
                `, [messageId]);
                return { action: 'deleted', messageId, chatId: msg.conversation_id || msg.chat_id };
            } else {
                await db.query('UPDATE messages SET views_used = ? WHERE message_id = ?', [newViews, messageId]);
                return { action: 'updated', viewsUsed: newViews, messageId };
            }
        }
        return { action: 'ignored' };
    }
}

module.exports = Message;
