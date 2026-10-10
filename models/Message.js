const db = require('../config/database');
const crypto = require('crypto');
const PermissionEngine = require('../services/PermissionEngine');
const logger = require('../utils/logger');
const { isSafeMediaUrl } = require('../utils/safeUrl');

class Message {
    /**
     * Get single message by ID
     */
    static async getById(messageId) {
        const [rows] = await db.query(`
            SELECT m.*, 
                   IFNULL(m.conversation_id, m.chat_id) as conversationId,
                   m.sender_id as senderId,
                   m.chat_id as chatId
            FROM messages m 
            WHERE m.message_id = ?
        `, [messageId]);
        if (!rows || rows.length === 0) return null;
        const msg = rows[0];
        return {
            ...msg,
            conversationId: msg.conversationId || msg.chatId,
            senderId: msg.senderId || msg.sender_id,
            conversationType: msg.conversation_id ? 'personal' : 'group',
        };
    }

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
    static async sendMessage({ messageId: clientMsgId = null, recipientId, chatId, senderId, content, type = 'text', mediaUrl = null, storyId = null, replyToId = null, marketplaceListingId = null, viewPolicy = 'unlimited', context = 'chat', metadata = null }) {
        // Stored-XSS guard: media URLs are rendered as clickable hrefs by the
        // client — reject javascript:/data:/etc. at the single write funnel
        // (HTTP + socket) (UI_AUDIT P0 #20).
        if (!isSafeMediaUrl(mediaUrl)) {
            const err = new Error('Invalid media URL');
            err.code = 'INVALID_MEDIA_URL';
            throw err;
        }
        const messageId = clientMsgId || crypto.randomUUID();
        
        // Idempotency check: If messageId already exists, return it directly
        const [existing] = await db.query('SELECT message_id FROM messages WHERE message_id = ?', [messageId]);
        if (existing && existing.length > 0) {
            return messageId;
        }

        let personalChatId = null;
        let groupChatId = null;

        if (chatId) {
            const [personalRows] = await db.query(
                'SELECT chat_id, participant1_id, participant2_id FROM personal_chats WHERE chat_id = ?',
                [chatId]
            );
            if (personalRows.length > 0) {
                personalChatId = chatId;
                const p = personalRows[0];
                if (!recipientId) {
                    recipientId = (p.participant1_id === senderId) ? p.participant2_id : p.participant1_id;
                }
            } else {
                groupChatId = chatId;
            }
        } else if (recipientId) {
            personalChatId = await this.getOrCreateConversation(senderId, recipientId, marketplaceListingId);
        } else {
            throw new Error('Recipient or Chat ID required');
        }

        const activeChatId = personalChatId || groupChatId;

        // Block & System Check Enforcement
        if (recipientId) {
            const { isSystemAccountId } = require('../helpers/systemAccount.helper');
            if (isSystemAccountId(recipientId) && !isSystemAccountId(senderId)) {
                throw new Error('Official Sparkle Account does not accept incoming messages.');
            }

            const [blocked] = await db.query(
                'SELECT 1 FROM user_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
                [senderId, recipientId, recipientId, senderId]
            );
            if (blocked.length > 0) {
                const blockedErr = new Error('You cannot message this user (blocked)');
                blockedErr.code = 'MESSAGE_BLOCKED';
                blockedErr.isBlocked = true;
                throw blockedErr;
            }
        }

        // Calculate payload hash for integrity
        const payloadStr = `${senderId}:${content || ''}:${mediaUrl || ''}:${type}`;
        const payloadHash = crypto.createHash('sha256').update(payloadStr).digest('hex');

        // Atomic server_sequence increment
        await db.query(`
            INSERT INTO chat_sequences (chat_id, last_sequence) VALUES (?, 1)
            ON DUPLICATE KEY UPDATE last_sequence = last_sequence + 1
        `, [activeChatId]);
        const [seqRow] = await db.query('SELECT last_sequence FROM chat_sequences WHERE chat_id = ?', [activeChatId]);
        const serverSequence = seqRow[0]?.last_sequence || 1;

        const sentAt = new Date();
        let validReplyToId = replyToId || null;
        if (validReplyToId) {
            try {
                const [checkRows] = await db.query('SELECT message_id FROM messages WHERE message_id = ? LIMIT 1', [validReplyToId]);
                if (!checkRows || checkRows.length === 0) {
                    logger.warn(`[Message] replyToId "${validReplyToId}" not found in DB, setting to null to avoid FK error`);
                    validReplyToId = null;
                }
            } catch (chkErr) {
                validReplyToId = null;
            }
        }

        // Calculate disappearing expiration if active for this chat
        let expiresAt = null;
        try {
            const table = personalChatId ? 'personal_chats' : 'group_chats';
            const [dRows] = await db.query(`SELECT disappearing_duration FROM ${table} WHERE chat_id = ?`, [activeChatId]);
            const disappearingDuration = dRows && dRows[0] ? (parseInt(dRows[0].disappearing_duration, 10) || 0) : 0;
            if (disappearingDuration > 0) {
                expiresAt = new Date(sentAt.getTime() + disappearingDuration * 1000);
            }
        } catch (e) {
            console.warn('[Message.sendMessage] Error checking disappearing duration:', e.message);
        }

        try {
            await db.query(`
                INSERT INTO messages (
                    message_id, client_message_id, chat_id, conversation_id, personal_chat_id, 
                    sender_id, recipient_id, content, type, media_url, 
                    story_id, reply_to_message_id, status, is_read, sent_at, expires_at, context, metadata,
                    server_sequence, payload_hash, version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', 0, ?, ?, ?, ?, ?, ?, 1)
            `, [
                messageId, 
                clientMsgId || messageId,
                groupChatId, 
                personalChatId, 
                personalChatId, 
                senderId, 
                recipientId || null, 
                content, 
                type, 
                mediaUrl, 
                storyId,
                validReplyToId, 
                sentAt, 
                expiresAt,
                context,
                metadata,
                serverSequence,
                payloadHash
            ]);

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

            // Enqueue delivery tasks into delivery_queue for recipient sessions (non-blocking)
            if (recipientId) {
                setImmediate(async () => {
                    try {
                        const SessionService = require('../services/session.service');
                        const DeliveryQueueWorker = require('../workers/deliveryQueueWorker');
                        const sessions = await SessionService.getActiveSessions(recipientId);
                        for (const session of sessions) {
                            await DeliveryQueueWorker.enqueue({
                                messageId,
                                recipientId,
                                sessionId: session.session_id
                            });
                        }
                    } catch (queueErr) {
                        logger.warn('[Message] Non-blocking delivery queue enqueue error:', queueErr.message);
                    }
                });
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
                // Not a chat the user participates in: input may still be a partner user id.
                // Foreign chat ids or garbage uuids must404 instead of crashing on FK insert.
                const [asChat] = await db.query('SELECT chat_id FROM personal_chats WHERE chat_id = ?', [input]);
                const [asUser] = await db.query('SELECT user_id FROM users WHERE user_id = ?', [input]);
                if (asChat.length > 0 || asUser.length === 0) {
                    const err = new Error('Conversation not found');
                    err.statusCode = 404;
                    throw err;
                }
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
                    ru.name as reply_sender_name,
                    ml.title as listing_title,
                    ml.price as listing_price,
                    ml.image_url as listing_image
                FROM messages m
                JOIN users u ON m.sender_id = u.user_id
                LEFT JOIN messages rm ON m.reply_to_message_id = rm.message_id
                LEFT JOIN users ru ON rm.sender_id = ru.user_id
                LEFT JOIN marketplace_listings ml ON m.marketplace_listing_id = ml.listing_id
                WHERE (m.conversation_id = ? OR m.chat_id = ?)
                  AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
                  AND m.message_id NOT IN (SELECT message_id FROM message_deletions WHERE user_id = ?)
                  AND m.message_id NOT IN (SELECT message_id FROM message_hidden WHERE user_id = ?)
                ORDER BY m.sent_at ASC
            `;
            const [messages] = await db.query(query, [chatId, chatId, userId, userId]);
            
            // Query chat privacy settings for all participants
            const [privacyRows] = await db.query(
                'SELECT user_id, allow_forward, allow_copy, block_screenshot, blur_screen_recording, privacy_version FROM chat_privacy_settings WHERE chat_id = ?',
                [chatId]
            );
            const privacyMap = new Map();
            (privacyRows || []).forEach(r => privacyMap.set(r.user_id, r));

            // Ensure all dates are returned as ISO strings and permissions computed by PermissionEngine
            const normalized = messages.map(m => {
                const senderPrivacy = privacyMap.get(m.sender_id) || {};
                const permissions = PermissionEngine.computePermissions({
                    message: m,
                    senderPrivacy,
                    viewerUserId: userId
                });
                return {
                    ...m,
                    sent_at: (m.sent_at && !isNaN(new Date(m.sent_at).getTime())) ? new Date(m.sent_at).toISOString() : null,
                    read_at: (m.read_at && !isNaN(new Date(m.read_at).getTime())) ? new Date(m.read_at).toISOString() : null,
                    expires_at: (m.expires_at && !isNaN(new Date(m.expires_at).getTime())) ? new Date(m.expires_at).toISOString() : null,
                    expiresAt: (m.expires_at && !isNaN(new Date(m.expires_at).getTime())) ? new Date(m.expires_at).toISOString() : null,
                    reactions: typeof m.reactions === 'string' ? JSON.parse(m.reactions) : m.reactions,
                    permissions
                };
            });
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
                    ru.name as reply_sender_name,
                    ml.title as listing_title,
                    ml.price as listing_price,
                    ml.image_url as listing_image
                FROM messages m
                JOIN users u ON m.sender_id = u.user_id
                LEFT JOIN messages rm ON m.reply_to_message_id = rm.message_id
                LEFT JOIN users ru ON rm.sender_id = ru.user_id
                LEFT JOIN marketplace_listings ml ON m.marketplace_listing_id = ml.listing_id
                WHERE m.chat_id = ?
                  AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
                  AND m.message_id NOT IN (SELECT message_id FROM message_deletions WHERE user_id = ?)
                  AND m.message_id NOT IN (SELECT message_id FROM message_hidden WHERE user_id = ?)
                ORDER BY m.sent_at ASC
            `;
            const [messages] = await db.query(query, [chatId, userId]);
            
            const [privacyRows] = await db.query(
                'SELECT user_id, allow_forward, allow_copy, block_screenshot, blur_screen_recording, privacy_version FROM chat_privacy_settings WHERE chat_id = ?',
                [chatId]
            );
            const privacyMap = new Map();
            (privacyRows || []).forEach(r => privacyMap.set(r.user_id, r));

            const normalized = messages.map(m => {
                const senderPrivacy = privacyMap.get(m.sender_id) || {};
                const permissions = PermissionEngine.computePermissions({
                    message: m,
                    senderPrivacy,
                    viewerUserId: userId
                });
                return {
                    ...m,
                    sent_at: (m.sent_at && !isNaN(new Date(m.sent_at).getTime())) ? new Date(m.sent_at).toISOString() : null,
                    read_at: (m.read_at && !isNaN(new Date(m.read_at).getTime())) ? new Date(m.read_at).toISOString() : null,
                    expires_at: (m.expires_at && !isNaN(new Date(m.expires_at).getTime())) ? new Date(m.expires_at).toISOString() : null,
                    expiresAt: (m.expires_at && !isNaN(new Date(m.expires_at).getTime())) ? new Date(m.expires_at).toISOString() : null,
                    reactions: typeof m.reactions === 'string' ? JSON.parse(m.reactions) : m.reactions,
                    permissions
                };
            });
            return { chatId, messages: normalized };
        }
    }

    /**
     * Get user's active conversations (Personal + Group)
     */
    static async getUserConversations(userId) {
        const runQuery = async () => {
            return await db.query(`
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
                    COALESCE(ur.unread_count, 0) as unread_count,
                    CASE WHEN pc.participant1_id = ? THEN pc.is_pinned_p1 ELSE pc.is_pinned_p2 END as is_pinned,
                    CASE WHEN pc.participant1_id = ? THEN pc.is_favorite_p1 ELSE pc.is_favorite_p2 END as is_favorite,
                    CASE WHEN pc.participant1_id = ? THEN pc.is_priority_p1 ELSE pc.is_priority_p2 END as is_priority,
                    CASE WHEN pc.participant1_id = ? THEN pc.is_muted_p1 ELSE pc.is_muted_p2 END as is_muted,
                    IF(pc.participant1_id = ?, pc.is_archived_p1, pc.is_archived_p2) as is_archived,
                    2 as member_count,
                    pc.marketplace_listing_id,
                    pc.disappearing_duration,
                    ml.title as listing_title,
                    'member' as role,
                    0 as only_admins_send,
                    'members' as edit_info
                FROM personal_chats pc
                LEFT JOIN (
                    SELECT COALESCE(conversation_id, personal_chat_id) AS cid, COUNT(*) AS unread_count
                    FROM messages
                    WHERE sender_id != ? AND status != 'read' AND is_read = 0
                      AND (conversation_id IS NOT NULL OR personal_chat_id IS NOT NULL)
                    GROUP BY cid
                ) ur ON ur.cid = pc.chat_id
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
                    0 as is_favorite,
                    0 as is_priority,
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
        `, [userId, userId, userId, userId, userId, userId, userId, userId, userId, userId]);
        };

        // Blocks lookup runs in parallel with the main UNION query (independent,
        // non-fatal on error) — saves one full round-trip on this hot path.
        const blocksPromise = (async () => {
            try {
                const [myBlocks, blocksOfMe] = await Promise.all([
                    db.query('SELECT blocked_id FROM user_blocks WHERE blocker_id = ?', [userId]),
                    db.query('SELECT blocker_id FROM user_blocks WHERE blocked_id = ?', [userId]),
                ]);
                return [
                    new Set(((myBlocks && myBlocks[0]) || []).map(b => String(b.blocked_id))),
                    new Set(((blocksOfMe && blocksOfMe[0]) || []).map(b => String(b.blocker_id))),
                ];
            } catch (bErr) {
                // Non-fatal fallback
                logger.warn(`getUserConversations: user_blocks lookup failed for user ${userId} (blocked status omitted)`, bErr?.message || bErr);
                return [new Set(), new Set()];
            }
        })();

        let rows;
        try {
            [rows] = await runQuery();
        } catch (e) {
            if (e.code === 'ER_BAD_FIELD_ERROR' || e.errno === 1054) {
                const pcMigrationCols = [
                    'is_deleted_p1 TINYINT(1) DEFAULT 0',
                    'is_deleted_p2 TINYINT(1) DEFAULT 0',
                    'is_pinned_p1 TINYINT(1) DEFAULT 0',
                    'is_pinned_p2 TINYINT(1) DEFAULT 0',
                    'is_favorite_p1 TINYINT(1) DEFAULT 0',
                    'is_favorite_p2 TINYINT(1) DEFAULT 0',
                    'is_priority_p1 TINYINT(1) DEFAULT 0',
                    'is_priority_p2 TINYINT(1) DEFAULT 0',
                    'is_muted_p1 TINYINT(1) DEFAULT 0',
                    'is_muted_p2 TINYINT(1) DEFAULT 0',
                    'is_archived_p1 TINYINT(1) DEFAULT 0',
                    'is_archived_p2 TINYINT(1) DEFAULT 0',
                    'disappearing_duration INT DEFAULT 0'
                ];
                for (const colDef of pcMigrationCols) {
                    await db.query(`ALTER TABLE personal_chats ADD COLUMN ${colDef}`).catch(() => {});
                }
                [rows] = await runQuery();
            } else {
                throw e;
            }
        }

        let blockedByMeSet, blockedMeSet;
        [blockedByMeSet, blockedMeSet] = await blocksPromise;

        const { formatSystemUser, isSystemAccount } = require('../helpers/systemAccount.helper');
        return rows.map(conv => {
            const formatted = formatSystemUser(conv);
            const pid = conv.partner_id ? String(conv.partner_id) : null;
            const isBlockedByMe = pid ? blockedByMeSet.has(pid) : false;
            const amIBlocked = pid ? blockedMeSet.has(pid) : false;
            const isBlocked = isBlockedByMe || amIBlocked;
            const isSys = Boolean(formatted.is_system_account || isSystemAccount(conv) || conv.is_system);

            return {
                ...conv,
                ...formatted,
                is_blocked: isBlocked,
                is_blocked_by_me: isBlockedByMe,
                am_i_blocked: amIBlocked,
                conversation_status: isBlocked ? 'blocked' : 'active',
                can_send_messages: !isBlocked,
                // Ensure display-name fields are always strings (never numeric 0 from SQL DEFAULT 0 columns)
                partner_name: isBlocked ? 'Sparkle User' : String(conv.partner_name || conv.partner_username || 'Sparkle User'),
                partner_username: isBlocked ? '' : String(conv.partner_username || ''),
                partner_avatar: isBlocked ? null : conv.partner_avatar,
                is_online: (isBlocked || isSys) ? false : Boolean(conv.is_online),
                last_message_sender_id: conv.last_message_sender_id ? String(conv.last_message_sender_id) : null,
                last_message_status: conv.last_message_status || 'sent',
                // Convert all TINYINT(1) DEFAULT 0 columns to proper booleans
                is_pinned: Boolean(conv.is_pinned),
                is_favorite: Boolean(conv.is_favorite),
                is_priority: Boolean(conv.is_priority),
                is_muted: Boolean(conv.is_muted),
                is_archived: Boolean(conv.is_archived),
                // Ensure numeric fields are numbers, not strings
                unread_count: Number(conv.unread_count) || 0,
                member_count: Number(conv.member_count) || 0,
                only_admins_send: Boolean(conv.only_admins_send),
                disappearing_duration: Number(conv.disappearing_duration) || 0,
                last_message_at: (conv.last_message_at && !isNaN(new Date(conv.last_message_at).getTime())) ? new Date(conv.last_message_at).toISOString() : null,
                last_seen_at: (isBlocked || isSys) ? null : ((conv.last_seen_at && !isNaN(new Date(conv.last_seen_at).getTime())) ? new Date(conv.last_seen_at).toISOString() : null)
            };
        });
    }

    /**
     * Mark messages as delivered/read
     */
    static async updateStatus(chatId, userId, status) {
        try {
            if (status === 'read') {
                await db.query(`
                    UPDATE messages 
                    SET status = 'read', 
                        is_read = 1,
                        read_at = IF(read_at IS NULL, NOW(), read_at),
                        delivered = 1,
                        delivered_at = IF(delivered_at IS NULL, NOW(), delivered_at)
                    WHERE (conversation_id = ? OR personal_chat_id = ? OR chat_id = ?) 
                      AND sender_id != ? 
                      AND status != 'read'
                `, [chatId, chatId, chatId, userId]);
            } else if (status === 'delivered') {
                await db.query(`
                    UPDATE messages 
                    SET status = 'delivered',
                        delivered = 1,
                        delivered_at = IF(delivered_at IS NULL, NOW(), delivered_at)
                    WHERE (conversation_id = ? OR personal_chat_id = ? OR chat_id = ?) 
                      AND sender_id != ? 
                      AND status = 'sent'
                `, [chatId, chatId, chatId, userId]);
            } else if (status === 'unread') {
                await db.query(`
                    UPDATE messages 
                    SET status = 'delivered', 
                        is_read = 0,
                        read_at = NULL
                    WHERE (conversation_id = ? OR personal_chat_id = ? OR chat_id = ?) 
                      AND sender_id != ? 
                    ORDER BY sent_at DESC LIMIT 1
                `, [chatId, chatId, chatId, userId]);
            }
        } catch (error) {
            console.error('[ERROR] Message.updateStatus DB Error:', error);
            throw error;
        }
    }

    /**
     * Soft delete for user (Delete for me)
     */

    /**
    * Hide a message for a specific user (soft hide)
    */
    /**
     * Delete for me (soft delete for a specific user)
     */
    static async deleteForMe(messageId, userId, operationId = null) {
        const deletionId = crypto.randomUUID();
        await db.query(`
            INSERT IGNORE INTO message_deletions (deletion_id, message_id, user_id, operation_id)
            VALUES (?, ?, ?, ?)
        `, [deletionId, messageId, userId, operationId]);
        return true;
    }

    /**
     * Delete multiple messages for me (bulk soft delete)
     * Preserves report/evidence records if conversation is reported.
     */
    static async deleteForMeBulk(messageIds, userId, operationId = null) {
        if (!Array.isArray(messageIds) || messageIds.length === 0) return true;
        const values = messageIds.map(msgId => [crypto.randomUUID(), msgId, userId, operationId]);
        await db.query(`
            INSERT IGNORE INTO message_deletions (deletion_id, message_id, user_id, operation_id)
            VALUES ?
        `, [values]);
        return true;
    }


    /**
     * Delete for everyone (strictly server-authoritative)
     */
    static async deleteForEveryone(messageId, userId, operationId = null, isAdminOverride = false, adminUsername = '') {
        const [existing] = await db.query(
            'SELECT sender_id, is_deleted_for_everyone, sent_at FROM messages WHERE message_id = ?',
            [messageId]
        );
        if (!existing || existing.length === 0) {
            return false;
        }

        const msg = existing[0];
        // Idempotency check: If message is already deleted for everyone, return true immediately
        if (msg.is_deleted_for_everyone === 1) {
            return true;
        }

        // Authorization check: User must be sender or admin
        if (!isAdminOverride && String(msg.sender_id) !== String(userId)) {
            throw new Error('UNAUTHORIZED_DELETE');
        }

        // 15-minute deletion window check (if not admin)
        if (!isAdminOverride) {
            const messageTime = new Date(msg.sent_at || msg.created_at || Date.now()).getTime();
            if (Date.now() - messageTime > 15 * 60 * 1000) {
                throw new Error('DELETE_WINDOW_EXPIRED');
            }
        }

        let content = 'This message was deleted';
        if (isAdminOverride && adminUsername) {
            content = `This message was deleted by admin ${adminUsername}`;
        }

        let result;
        try {
            const query = isAdminOverride 
                ? `UPDATE messages SET is_deleted_for_everyone = 1, content = ?, type = 'text', media_url = NULL, story_id = NULL, delete_operation_id = ? WHERE message_id = ?`
                : `UPDATE messages SET is_deleted_for_everyone = 1, content = ?, type = 'text', media_url = NULL, story_id = NULL, delete_operation_id = ? WHERE message_id = ? AND sender_id = ? AND is_deleted_for_everyone = 0`;
            const params = isAdminOverride ? [content, operationId, messageId] : [content, operationId, messageId, userId];
            [result] = await db.query(query, params);
        } catch (e) {
            const query = isAdminOverride 
                ? `UPDATE messages SET is_deleted_for_everyone = 1, content = ?, type = 'text', media_url = NULL, story_id = NULL WHERE message_id = ?`
                : `UPDATE messages SET is_deleted_for_everyone = 1, content = ?, type = 'text', media_url = NULL, story_id = NULL WHERE message_id = ? AND sender_id = ? AND is_deleted_for_everyone = 0`;
            const params = isAdminOverride ? [content, messageId] : [content, messageId, userId];
            [result] = await db.query(query, params);
        }
        return result.affectedRows > 0 || true;
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
     * Edit a message (only by sender, within 5 minutes)
     */
    static async editMessage(messageId, userId, newContent) {
        const [result] = await db.query(
            `UPDATE messages 
             SET content = ?, edited_at = NOW(), edited = 1 
             WHERE message_id = ? AND sender_id = ? 
               AND is_deleted_for_everyone = 0
               AND TIMESTAMPDIFF(MINUTE, sent_at, NOW()) <= 5`,
            [newContent, messageId, userId]
        );
        return result.affectedRows > 0;
    }

    /**
     * Search messages within a conversation
     */
    static async getChatMessages(chatId) {
        const [rows] = await db.query(`
            SELECT m.*, 
                   u.name as sender_name, u.username as sender_username, u.avatar_url as sender_avatar,
                   rm.content as reply_content, rm.type as reply_type
            FROM messages m
            JOIN users u ON m.sender_id = u.user_id
            LEFT JOIN messages rm ON m.reply_to_message_id = rm.message_id
            WHERE (m.chat_id = ? OR m.conversation_id = ? OR m.personal_chat_id = ?)
            AND m.is_deleted_for_everyone = 0
            ORDER BY m.sent_at ASC
        `, [chatId, chatId, chatId]);
        return rows;
    }

    /**
     * Messages for a group chat — group messages live in the messages table,
     * addressed by chat_id, same shape as direct messages.
     */
    static async getGroupMessages(chatId) {
        return this.getChatMessages(chatId);
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

        try {
            await db.query(`UPDATE personal_chats SET ${column} = ? WHERE chat_id = ?`, [muted ? 1 : 0, chatId]);
        } catch (e) {
            if (e.code === 'ER_BAD_FIELD_ERROR') {
                await db.query(`ALTER TABLE personal_chats ADD COLUMN is_muted_p1 TINYINT(1) DEFAULT 0, ADD COLUMN is_muted_p2 TINYINT(1) DEFAULT 0`).catch(() => {});
                await db.query(`UPDATE personal_chats SET ${column} = ? WHERE chat_id = ?`, [muted ? 1 : 0, chatId]);
            } else throw e;
        }
        return true;
    }

    /**
     * Archive or unarchive a conversation
     */
    static async archiveConversation(userId, chatId, archived = true) {
        const [chat] = await db.query('SELECT participant1_id, participant2_id FROM personal_chats WHERE chat_id = ?', [chatId]);
        if (chat.length === 0) return false;

        const isP1 = String(chat[0].participant1_id) === String(userId);
        const column = isP1 ? 'is_archived_p1' : 'is_archived_p2';

        try {
            await db.query(`UPDATE personal_chats SET ${column} = ? WHERE chat_id = ?`, [archived ? 1 : 0, chatId]);
        } catch (e) {
            if (e.code === 'ER_BAD_FIELD_ERROR') {
                await db.query(`ALTER TABLE personal_chats ADD COLUMN is_archived_p1 TINYINT(1) DEFAULT 0, ADD COLUMN is_archived_p2 TINYINT(1) DEFAULT 0`).catch(() => {});
                await db.query(`UPDATE personal_chats SET ${column} = ? WHERE chat_id = ?`, [archived ? 1 : 0, chatId]);
            } else throw e;
        }
        return true;
    }

    /**
     * Pin or unpin a conversation for a user
     */
    static async pinConversation(userId, chatId, pinned = true) {
        const [chat] = await db.query('SELECT participant1_id, participant2_id FROM personal_chats WHERE chat_id = ?', [chatId]);
        if (chat.length === 0) return false;

        const isP1 = String(chat[0].participant1_id) === String(userId);
        const column = isP1 ? 'is_pinned_p1' : 'is_pinned_p2';

        try {
            await db.query(`UPDATE personal_chats SET ${column} = ? WHERE chat_id = ?`, [pinned ? 1 : 0, chatId]);
        } catch (e) {
            if (e.code === 'ER_BAD_FIELD_ERROR') {
                await db.query(`ALTER TABLE personal_chats ADD COLUMN is_pinned_p1 TINYINT(1) DEFAULT 0, ADD COLUMN is_pinned_p2 TINYINT(1) DEFAULT 0`).catch(() => {});
                await db.query(`UPDATE personal_chats SET ${column} = ? WHERE chat_id = ?`, [pinned ? 1 : 0, chatId]);
            } else throw e;
        }
        return true;
    }

    /**
     * Favorite or unfavorite a conversation for a user
     */
    static async favoriteConversation(userId, chatId, favorite = true) {
        const [chat] = await db.query('SELECT participant1_id, participant2_id FROM personal_chats WHERE chat_id = ?', [chatId]);
        if (chat.length === 0) return false;

        const isP1 = String(chat[0].participant1_id) === String(userId);
        const column = isP1 ? 'is_favorite_p1' : 'is_favorite_p2';

        // Safe migration: add column if missing
        try {
            await db.query(`UPDATE personal_chats SET ${column} = ? WHERE chat_id = ?`, [favorite ? 1 : 0, chatId]);
        } catch (e) {
            if (e.code === 'ER_BAD_FIELD_ERROR') {
                await db.query(`ALTER TABLE personal_chats ADD COLUMN is_favorite_p1 TINYINT(1) DEFAULT 0, ADD COLUMN is_favorite_p2 TINYINT(1) DEFAULT 0`).catch(() => {});
                await db.query(`UPDATE personal_chats SET ${column} = ? WHERE chat_id = ?`, [favorite ? 1 : 0, chatId]);
            } else throw e;
        }
        return true;
    }

    /**
     * Set or unset priority for a conversation for a user
     */
    static async priorityConversation(userId, chatId, priority = true) {
        const [chat] = await db.query('SELECT participant1_id, participant2_id FROM personal_chats WHERE chat_id = ?', [chatId]);
        if (chat.length === 0) return false;

        const isP1 = String(chat[0].participant1_id) === String(userId);
        const column = isP1 ? 'is_priority_p1' : 'is_priority_p2';

        // Safe migration: add column if missing
        try {
            await db.query(`UPDATE personal_chats SET ${column} = ? WHERE chat_id = ?`, [priority ? 1 : 0, chatId]);
        } catch (e) {
            if (e.code === 'ER_BAD_FIELD_ERROR') {
                await db.query(`ALTER TABLE personal_chats ADD COLUMN is_priority_p1 TINYINT(1) DEFAULT 0, ADD COLUMN is_priority_p2 TINYINT(1) DEFAULT 0`).catch(() => {});
                await db.query(`UPDATE personal_chats SET ${column} = ? WHERE chat_id = ?`, [priority ? 1 : 0, chatId]);
            } else throw e;
        }
        return true;
    }

    /**
     * Soft delete a conversation (clears history for a user)
     */
    static async deleteConversation(userId, chatId) {
        const { isSystemAccount } = require('../helpers/systemAccount.helper');
        const [chat] = await db.query(
            `SELECT pc.*, u1.account_type as u1_type, u2.account_type as u2_type 
             FROM personal_chats pc 
             LEFT JOIN users u1 ON pc.participant1_id = u1.user_id
             LEFT JOIN users u2 ON pc.participant2_id = u2.user_id
             WHERE pc.chat_id = ?`,
            [chatId]
        );
        if (chat.length > 0 && (chat[0].conversation_type === 'system' || chat[0].u1_type === 'system' || chat[0].u2_type === 'system' || isSystemAccount(chat[0].participant1_id) || isSystemAccount(chat[0].participant2_id))) {
            throw new Error('Official Sparkle conversations cannot be deleted.');
        }

        if (chat.length > 0) {
            const isP1 = String(chat[0].participant1_id) === String(userId);
            const isP2 = String(chat[0].participant2_id) === String(userId);
            if (isP1) {
                await db.query('UPDATE personal_chats SET is_deleted_p1 = 1 WHERE chat_id = ?', [chatId]);
            } else if (isP2) {
                await db.query('UPDATE personal_chats SET is_deleted_p2 = 1 WHERE chat_id = ?', [chatId]);
            }
        }

        // Clear all messages for this user by inserting into message_deletions
        const [messages] = await db.query('SELECT message_id FROM messages WHERE (conversation_id = ? OR chat_id = ?)', [chatId, chatId]);
        if (messages.length > 0) {
            const values = messages.map(m => `(UUID(), '${m.message_id}', '${userId}')`).join(',');
            await db.query(`INSERT IGNORE INTO message_deletions (deletion_id, message_id, user_id) VALUES ${values}`);
        }
        return true;
    }

    /**
    * Increment forward count for a message (used for forwarding analytics)
    */
    static async incrementForwardCount(messageId) {
        await db.query(`UPDATE messages SET forward_count = IFNULL(forward_count, 0) + 1 WHERE message_id = ?`, [messageId]);
        return true;
    }

    // Existing helpers
    static async getById(messageId) {
        const [rows] = await db.query('SELECT * FROM messages WHERE message_id = ?', [messageId]);
        return rows[0] || null;
    }

    /**
     * Enterprise Cursor Delta Sync: fetch messages for user where server_sequence > lastCursor
     */
    static async getCursorDelta(userId, lastCursor = 0) {
        const cursor = Number(lastCursor) || 0;
        const [messages] = await db.query(`
            SELECT x.*, u.name as sender_name, u.username as sender_username, u.avatar_url as sender_avatar
            FROM (
                SELECT m.* FROM messages m
                WHERE m.recipient_id = ? AND m.sender_id != ? AND m.server_sequence > ?
                UNION ALL
                SELECT m.* FROM messages m
                WHERE m.sender_id = ? AND m.server_sequence > ?
                UNION ALL
                SELECT m.* FROM messages m
                WHERE m.chat_id IN (
                    SELECT chat_id FROM group_chat_members WHERE user_id = ? AND status = 'active'
                ) AND m.recipient_id != ? AND m.sender_id != ? AND m.server_sequence > ?
            ) x
            JOIN users u ON x.sender_id = u.user_id
            ORDER BY x.server_sequence ASC
            LIMIT 200
        `, [userId, userId, cursor, userId, cursor, userId, userId, userId, cursor]);

        if (!messages || messages.length === 0) return [];

        const chatIds = [...new Set(messages.map(m => m.chat_id || m.conversation_id).filter(Boolean))];
        const privacyMap = new Map();
        if (chatIds.length > 0) {
            const [privacyRows] = await db.query(
                'SELECT chat_id, user_id, allow_forward, allow_copy, block_screenshot, blur_screen_recording, privacy_version FROM chat_privacy_settings WHERE chat_id IN (?)',
                [chatIds]
            );
            (privacyRows || []).forEach(r => privacyMap.set(`${r.chat_id}:${r.user_id}`, r));
        }

        return messages.map(m => {
            const chatId = m.chat_id || m.conversation_id;
            const senderPrivacy = privacyMap.get(`${chatId}:${m.sender_id}`) || {};
            const permissions = PermissionEngine.computePermissions({
                message: m,
                senderPrivacy,
                viewerUserId: userId
            });
            return {
                ...m,
                permissions
            };
        });
    }

    /**
     * Session-aware Delivery ACK: Mark message delivered when recipient session ACKs receipt
     */
    /**
     * Session-aware Delivery ACK: Mark message delivered when recipient session ACKs receipt
     */
    static async markSessionDelivered(messageId, sessionId, recipientUserId) {
        await db.query(`
            UPDATE messages 
            SET delivered_at = COALESCE(delivered_at, UTC_TIMESTAMP()), status = IF(status = 'read' OR read_at IS NOT NULL, 'read', 'delivered')
            WHERE message_id = ? AND (recipient_id = ? OR recipient_id IS NULL)
        `, [messageId, recipientUserId]);

        const DeliveryQueueWorker = require('../workers/deliveryQueueWorker');
        await DeliveryQueueWorker.acknowledgeDelivery(messageId, sessionId);
    }

    /**
     * Check if a user has read receipts enabled (per-chat override or global default)
     */
    static async areReadReceiptsEnabled(userId, chatId) {
        try {
            if (chatId) {
                const [chatSettings] = await db.query(
                    'SELECT read_receipts_enabled FROM chat_privacy_settings WHERE chat_id = ? AND user_id = ? LIMIT 1',
                    [chatId, userId]
                );
                if (chatSettings && chatSettings.length > 0 && chatSettings[0].read_receipts_enabled !== null && chatSettings[0].read_receipts_enabled !== undefined) {
                    return chatSettings[0].read_receipts_enabled !== 0;
                }
            }
            const [userSettings] = await db.query(
                'SELECT default_read_receipts FROM users WHERE user_id = ? LIMIT 1',
                [userId]
            );
            if (userSettings && userSettings.length > 0 && userSettings[0].default_read_receipts !== null && userSettings[0].default_read_receipts !== undefined) {
                return userSettings[0].default_read_receipts !== 0;
            }
            return true;
        } catch (err) {
            logger.error(`areReadReceiptsEnabled error for user ${userId}:`, err?.message || err);
            return true;
        }
    }

    /**
     * Tri-Condition Read Receipt: Mark message read when recipient views message
     * Respects reader's privacy setting:
     * - If read receipts are disabled: marks is_read = 1 (clears recipient's unread counter internally)
     *   without modifying publicly visible `status = 'read'` or `read_at`, and returns readReceiptsEnabled: false.
     * - If read receipts are enabled: marks is_read = 1, status = 'read', read_at = UTC_TIMESTAMP(), and returns readReceiptsEnabled: true.
     */
    static async markReadTriCondition(chatId, messageIds, recipientUserId) {
        const readReceiptsEnabled = await this.areReadReceiptsEnabled(recipientUserId, chatId);

        if (!Array.isArray(messageIds) || messageIds.length === 0) {
            if (readReceiptsEnabled) {
                await db.query(`
                    UPDATE messages
                    SET read_at = COALESCE(read_at, UTC_TIMESTAMP()), delivered_at = COALESCE(delivered_at, UTC_TIMESTAMP()), status = 'read', is_read = 1
                    WHERE (conversation_id = ? OR chat_id = ?) AND sender_id != ? AND read_at IS NULL
                `, [chatId, chatId, recipientUserId]);
            } else {
                // Internal unread tracking only: clear recipient's unread indicator
                await db.query(`
                    UPDATE messages
                    SET is_read = 1
                    WHERE (conversation_id = ? OR chat_id = ?) AND sender_id != ? AND is_read = 0
                `, [chatId, chatId, recipientUserId]);
            }
            return { readReceiptsEnabled };
        }

        const placeholders = messageIds.map(() => '?').join(',');
        if (readReceiptsEnabled) {
            await db.query(`
                UPDATE messages
                SET read_at = COALESCE(read_at, UTC_TIMESTAMP()), delivered_at = COALESCE(delivered_at, UTC_TIMESTAMP()), status = 'read', is_read = 1
                WHERE message_id IN (${placeholders}) AND sender_id != ?
            `, [...messageIds, recipientUserId]);
        } else {
            await db.query(`
                UPDATE messages
                SET is_read = 1
                WHERE message_id IN (${placeholders}) AND sender_id != ?
            `, [...messageIds, recipientUserId]);
        }
        return { readReceiptsEnabled };
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

    /**
     * Reaction Management (Server-Authoritative, Unique per user per message)
     */
    static async addReaction(messageId, userId, emoji) {
        const [msg] = await db.query('SELECT conversation_id, chat_id FROM messages WHERE message_id = ?', [messageId]);
        if (!msg || !msg.length) {
            logger.warn(`[Message] addReaction: message ${messageId} not found in DB, ignoring reaction`);
            return { action: 'ignored', messageId };
        }
        const chatId = msg[0].conversation_id || msg[0].chat_id;

        await db.query(`
            INSERT INTO chat_sequences (chat_id, last_sequence) VALUES (?, 1)
            ON DUPLICATE KEY UPDATE last_sequence = last_sequence + 1
        `, [chatId]);
        const [currSeq] = await db.query('SELECT last_sequence FROM chat_sequences WHERE chat_id = ?', [chatId]);
        const sequenceNo = currSeq[0]?.last_sequence || 1;

        const reactionId = crypto.randomUUID();
        await db.query(`
            INSERT INTO message_reactions (reaction_id, message_id, user_id, emoji)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE emoji = VALUES(emoji), updated_at = NOW()
        `, [reactionId, messageId, userId, emoji]);

        const eventId = crypto.randomUUID();
        const payload = JSON.stringify({ messageId, userId, emoji, chatId });
        await db.query(`
            INSERT INTO interaction_events (event_id, chat_id, message_id, event_type, payload, sequence_no)
            VALUES (?, ?, ?, 'reaction_added', ?, ?)
        `, [eventId, chatId, messageId, payload, sequenceNo]);

        return { eventId, sequenceNo, chatId, messageId, userId, emoji };
    }

    static async removeReaction(messageId, userId) {
        const [msg] = await db.query('SELECT conversation_id, chat_id FROM messages WHERE message_id = ?', [messageId]);
        if (!msg.length) throw new Error('Message not found');
        const chatId = msg[0].conversation_id || msg[0].chat_id;

        await db.query('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ?', [messageId, userId]);

        await db.query(`
            INSERT INTO chat_sequences (chat_id, last_sequence) VALUES (?, 1)
            ON DUPLICATE KEY UPDATE last_sequence = last_sequence + 1
        `, [chatId]);
        const [currSeq] = await db.query('SELECT last_sequence FROM chat_sequences WHERE chat_id = ?', [chatId]);
        const sequenceNo = currSeq[0]?.last_sequence || 1;

        const eventId = crypto.randomUUID();
        const payload = JSON.stringify({ messageId, userId, chatId });
        await db.query(`
            INSERT INTO interaction_events (event_id, chat_id, message_id, event_type, payload, sequence_no)
            VALUES (?, ?, ?, 'reaction_removed', ?, ?)
        `, [eventId, chatId, messageId, payload, sequenceNo]);

        return { eventId, sequenceNo, chatId, messageId, userId };
    }

    /**
     * Star Message
     */
    static async starMessage(messageId, userId, starred = true) {
        const [msg] = await db.query('SELECT conversation_id, chat_id FROM messages WHERE message_id = ?', [messageId]);
        if (!msg.length) throw new Error('Message not found');
        const chatId = msg[0].conversation_id || msg[0].chat_id;

        const eventId = crypto.randomUUID();
        let eventType = 'message_starred';

        if (starred) {
            const starId = crypto.randomUUID();
            await db.query(`
                INSERT IGNORE INTO message_stars (star_id, message_id, user_id) VALUES (?, ?, ?)
            `, [starId, messageId, userId]);
        } else {
            eventType = 'message_unstarred';
            await db.query(`DELETE FROM message_stars WHERE message_id = ? AND user_id = ?`, [messageId, userId]);
        }

        await db.query(`
            INSERT INTO chat_sequences (chat_id, last_sequence) VALUES (?, 1)
            ON DUPLICATE KEY UPDATE last_sequence = last_sequence + 1
        `, [chatId]);
        const [currSeq] = await db.query('SELECT last_sequence FROM chat_sequences WHERE chat_id = ?', [chatId]);
        const sequenceNo = currSeq[0]?.last_sequence || 1;

        const payload = JSON.stringify({ messageId, userId, starred, chatId });
        await db.query(`
            INSERT INTO interaction_events (event_id, chat_id, message_id, event_type, payload, sequence_no)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [eventId, chatId, messageId, eventType, payload, sequenceNo]);

        return { eventId, sequenceNo, chatId, messageId, userId, starred };
    }

    /**
     * Bookmark Message
     */
    static async bookmarkMessage(messageId, userId, bookmarked = true) {
        const [msg] = await db.query('SELECT conversation_id, chat_id FROM messages WHERE message_id = ?', [messageId]);
        if (!msg.length) throw new Error('Message not found');
        const chatId = msg[0].conversation_id || msg[0].chat_id;

        if (bookmarked) {
            const bookmarkId = crypto.randomUUID();
            await db.query(`INSERT IGNORE INTO message_bookmarks (bookmark_id, message_id, user_id) VALUES (?, ?, ?)`, [bookmarkId, messageId, userId]);
        } else {
            await db.query(`DELETE FROM message_bookmarks WHERE message_id = ? AND user_id = ?`, [messageId, userId]);
        }

        return { messageId, userId, bookmarked, chatId };
    }

    /**
     * Pin / Unpin Message
     */
    static async pinMessage(messageId, userId, pinned = true) {
        const [msg] = await db.query('SELECT conversation_id, chat_id FROM messages WHERE message_id = ?', [messageId]);
        if (!msg.length) throw new Error('Message not found');
        const chatId = msg[0].conversation_id || msg[0].chat_id;

        const eventId = crypto.randomUUID();
        let eventType = 'message_pinned';

        if (pinned) {
            const pinId = crypto.randomUUID();
            await db.query(`
                INSERT INTO message_pins (pin_id, chat_id, message_id, pinned_by)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE pinned_by = VALUES(pinned_by), pinned_at = NOW()
            `, [pinId, chatId, messageId, userId]);
        } else {
            eventType = 'message_unpinned';
            await db.query(`DELETE FROM message_pins WHERE message_id = ?`, [messageId]);
        }

        await db.query(`
            INSERT INTO chat_sequences (chat_id, last_sequence) VALUES (?, 1)
            ON DUPLICATE KEY UPDATE last_sequence = last_sequence + 1
        `, [chatId]);
        const [currSeq] = await db.query('SELECT last_sequence FROM chat_sequences WHERE chat_id = ?', [chatId]);
        const sequenceNo = currSeq[0]?.last_sequence || 1;

        const payload = JSON.stringify({ messageId, userId, pinned, chatId });
        await db.query(`
            INSERT INTO interaction_events (event_id, chat_id, message_id, event_type, payload, sequence_no)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [eventId, chatId, messageId, eventType, payload, sequenceNo]);

        return { eventId, sequenceNo, chatId, messageId, userId, pinned };
    }

    /**
     * Edit Message Text
     */
    static async editMessage(messageId, userId, newContent) {
        const [rows] = await db.query('SELECT sender_id, sent_at, conversation_id, chat_id, is_deleted_for_everyone FROM messages WHERE message_id = ?', [messageId]);
        if (!rows.length) return null;
        const msg = rows[0];
        const chatId = msg.conversation_id || msg.chat_id;

        if (msg.sender_id !== userId || msg.is_deleted_for_everyone) return null;

        const timeDiffMins = (Date.now() - new Date(msg.sent_at).getTime()) / 60000;
        if (timeDiffMins > 15) return null; // 15 min limit

        await db.query(`
            INSERT INTO chat_sequences (chat_id, last_sequence) VALUES (?, 1)
            ON DUPLICATE KEY UPDATE last_sequence = last_sequence + 1
        `, [chatId]);
        const [currSeq] = await db.query('SELECT last_sequence FROM chat_sequences WHERE chat_id = ?', [chatId]);
        const sequenceNo = currSeq[0]?.last_sequence || 1;

        await db.query(`
            UPDATE messages 
            SET content = ?, is_edited = 1, edited_at = NOW(), server_sequence = ?
            WHERE message_id = ?
        `, [newContent, sequenceNo, messageId]);

        const eventId = crypto.randomUUID();
        const payload = JSON.stringify({ messageId, userId, content: newContent, chatId, edited_at: new Date().toISOString() });
        await db.query(`
            INSERT INTO interaction_events (event_id, chat_id, message_id, event_type, payload, sequence_no)
            VALUES (?, ?, ?, 'message_edited', ?, ?)
        `, [eventId, chatId, messageId, payload, sequenceNo]);

        return { eventId, sequenceNo, chatId, messageId, content: newContent };
    }

    /**
     * Delete Message For Everyone
     */
    static async deleteMessageForEveryone(messageId, userId) {
        const [rows] = await db.query('SELECT sender_id, sent_at, conversation_id, chat_id FROM messages WHERE message_id = ?', [messageId]);
        if (!rows.length) return null;
        const msg = rows[0];
        const chatId = msg.conversation_id || msg.chat_id;

        if (msg.sender_id !== userId) return null;

        await db.query(`
            INSERT INTO chat_sequences (chat_id, last_sequence) VALUES (?, 1)
            ON DUPLICATE KEY UPDATE last_sequence = last_sequence + 1
        `, [chatId]);
        const [currSeq] = await db.query('SELECT last_sequence FROM chat_sequences WHERE chat_id = ?', [chatId]);
        const sequenceNo = currSeq[0]?.last_sequence || 1;

        await db.query(`
            UPDATE messages 
            SET is_deleted_for_everyone = 1, deleted_at = NOW(), content = '[This message was deleted]', media_url = NULL, server_sequence = ?
            WHERE message_id = ?
        `, [sequenceNo, messageId]);

        const eventId = crypto.randomUUID();
        const payload = JSON.stringify({ messageId, userId, chatId, deleted_at: new Date().toISOString() });
        await db.query(`
            INSERT INTO interaction_events (event_id, chat_id, message_id, event_type, payload, sequence_no)
            VALUES (?, ?, ?, 'message_deleted', ?, ?)
        `, [eventId, chatId, messageId, payload, sequenceNo]);

        return { eventId, sequenceNo, chatId, messageId };
    }

    /**
     * Delta Sync Events by sequence number
     */
    static async getEventsSinceSeq(chatId, sinceSeq = 0) {
        const [events] = await db.query(`
            SELECT * FROM interaction_events
            WHERE chat_id = ? AND sequence_no > ?
            ORDER BY sequence_no ASC
            LIMIT 500
        `, [chatId, Number(sinceSeq) || 0]);
        return events;
    }
}

module.exports = Message;
