const { Message, GroupChat, GroupMember } = require('../models');
const pool = require('../config/database');
const crypto = require('crypto');

class MessageController {
    /**
     * Get mutual groups between user and a partner
     */
    async getMutualGroups(req, res) {
        try {
            const userId = req.user.user_id || req.user.userId;
            const { partnerId } = req.params;
            const groups = await GroupChat.getMutualGroups(userId, partnerId);
            res.json({ status: 'success', data: groups });
        } catch (error) {
            console.error('getMutualGroups Error:', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    /**
     * Get backend-driven JSON Welcome Cards for official onboarding
     */
    async getWelcomeCards(req, res) {
        try {
            const systemMessageService = require('../services/systemMessage.service');
            const cards = systemMessageService.getWelcomeCards();
            res.json({ status: 'success', data: cards });
        } catch (error) {
            console.error('getWelcomeCards Error:', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    /**
     * Get official chat onboarding status
     */
    async getOfficialChatStatus(req, res) {
        try {
            const userId = req.user.user_id || req.user.userId || req.user.id;
            const [users] = await pool.query(
                'SELECT official_onboarding_status, official_onboarding_completed_at FROM users WHERE user_id = ?',
                [userId]
            );
            const user = users[0] || {};
            const status = user.official_onboarding_status || 'NOT_STARTED';
            const showOnboarding = status !== 'COMPLETED';

            res.json({
                status: 'success',
                data: {
                    showOnboarding,
                    status,
                    completedAt: user.official_onboarding_completed_at || null
                }
            });
        } catch (error) {
            console.error('getOfficialChatStatus Error:', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    /**
     * Advance official chat onboarding state machine (NOT_STARTED -> VIEWED -> COMPLETED)
     */
    async updateOfficialOnboardingStatus(req, res) {
        try {
            const userId = req.user.user_id || req.user.userId || req.user.id;
            const { targetStatus } = req.body; // 'VIEWED' or 'COMPLETED'
            const newStatus = (targetStatus === 'COMPLETED') ? 'COMPLETED' : 'VIEWED';

            const completedAt = newStatus === 'COMPLETED' ? new Date() : null;

            if (newStatus === 'COMPLETED') {
                await pool.query(
                    "UPDATE users SET official_onboarding_status = 'COMPLETED', official_onboarding_completed_at = CURRENT_TIMESTAMP WHERE user_id = ?",
                    [userId]
                );

                // Archive onboarding messages cleanly instead of hard delete
                await pool.query(
                    "UPDATE messages SET is_hidden = 1, hidden_reason = 'onboarding_completed', archive_after_completion = 1 WHERE (sender_id = ? OR recipient_id = ?) AND (message_type = 'onboarding' OR message_type = 'system' OR type = 'system')",
                    [userId, userId]
                );
            } else {
                // Update to VIEWED only if currently NOT_STARTED
                await pool.query(
                    "UPDATE users SET official_onboarding_status = 'VIEWED' WHERE user_id = ? AND official_onboarding_status = 'NOT_STARTED'",
                    [userId]
                );
            }

            // Real-time Socket sync across all devices
            try {
                const { getIO } = require('../socket');
                const io = getIO();
                if (io) {
                    io.to(`user:${userId}`).to(`user_${userId}`).emit('official_onboarding_status_changed', {
                        status: newStatus,
                        showOnboarding: newStatus !== 'COMPLETED',
                        completedAt
                    });
                }
            } catch (err) {
                console.warn('Socket broadcast error in updateOfficialOnboardingStatus:', err.message);
            }

            res.json({
                status: 'success',
                data: {
                    status: newStatus,
                    showOnboarding: newStatus !== 'COMPLETED',
                    completedAt
                }
            });
        } catch (error) {
            console.error('updateOfficialOnboardingStatus Error:', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    /**
     * Replay official chat onboarding (Reset status to VIEWED for tour replaying)
     */
    async replayOfficialOnboarding(req, res) {
        try {
            const userId = req.user.user_id || req.user.userId || req.user.id;
            await pool.query(
                "UPDATE users SET official_onboarding_status = 'VIEWED' WHERE user_id = ?",
                [userId]
            );

            await pool.query(
                "UPDATE messages SET is_hidden = 0, hidden_reason = NULL WHERE (sender_id = ? OR recipient_id = ?) AND archive_after_completion = 1",
                [userId, userId]
            );

            try {
                const { getIO } = require('../socket');
                const io = getIO();
                if (io) {
                    io.to(`user:${userId}`).to(`user_${userId}`).emit('official_onboarding_status_changed', {
                        status: 'VIEWED',
                        showOnboarding: true,
                        completedAt: null
                    });
                }
            } catch (err) {
                console.warn('Socket broadcast error in replayOfficialOnboarding:', err.message);
            }

            res.json({
                status: 'success',
                data: {
                    status: 'VIEWED',
                    showOnboarding: true
                }
            });
        } catch (error) {
            console.error('replayOfficialOnboarding Error:', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    /**
     * Open or create a conversation (Supports DMs, Official accounts, and Self "Saved Messages")
     */
    async openConversation(req, res) {
        try {
            const userId = req.user.user_id || req.user.userId || req.user.id;
            const { partnerId, recipientId, recipient_id, username, listingId } = req.body;
            
            let targetPartnerId = partnerId || recipientId || recipient_id;
            
            if (!targetPartnerId && username) {
                const cleanUser = username.replace(/^@/, '');
                const [users] = await pool.query('SELECT user_id, id FROM users WHERE username = ? OR handle = ?', [cleanUser, cleanUser]);
                if (users && users.length > 0) {
                    targetPartnerId = users[0].user_id || users[0].id;
                }
            }

            if (!targetPartnerId) {
                return res.status(400).json({ status: 'error', error: 'Partner ID or username is required' });
            }

            const isSelf = targetPartnerId === userId;
            const conversationId = await Message.getOrCreateConversation(userId, targetPartnerId, listingId || null);

            res.json({
                status: 'success',
                data: {
                    conversationId,
                    chatId: conversationId,
                    partnerId: targetPartnerId,
                    isSelf,
                    chat_type: isSelf ? 'self' : 'direct'
                }
            });
        } catch (error) {
            console.error('openConversation Error:', error);
            res.status(500).json({ status: 'error', error: error.message || 'Failed to open conversation' });
        }
    }
    /**
     * Get user's conversation list (Direct + Group)
     */
    async getInbox(req, res) {
        try {
            const userId = req.user.user_id || req.user.userId;
            
            // Auto-recreate or ensure system conversation exists
            const systemMessageService = require('../services/systemMessage.service');
            await systemMessageService.ensureSystemConversation(userId);

            const conversations = await Message.getUserConversations(userId);
            const { formatSystemUser, isSystemAccountId } = require('../helpers/systemAccount.helper');
            const mapped = conversations.map(c => {
                const isSys = isSystemAccountId(c.partner_id) || Boolean(c.is_system_account);
                return {
                    ...formatSystemUser(c),
                    is_system: isSys,
                    is_system_account: isSys
                };
            });

            res.json({ status: 'success', data: mapped });
        } catch (error) {
            console.error('getInbox Error:', error);
            res.status(500).json({ status: 'error', error: 'Server error', details: error.message });
        }
    }

    /**
     * Get messages for a specific conversation
     */
    async getConversationMessages(req, res) {
        try {
            const chatId = req.params.chatId || req.params.conversationId || req.params.partnerId;
            const userId = req.user.user_id || req.user.userId;
            
            // If it's a partnerId (UUID format but not a chat_id), we might need to getOrCreate first
            // But usually the client will pass a chatId if they have one.
            // For starting a new chat, startConversation endpoint is used.
            
            const { chatId: resolvedChatId, messages } = await Message.getMessages(chatId, userId);
            res.json({ status: 'success', data: messages, chatId: resolvedChatId });
        } catch (error) {
            const errorMsg = error?.message || error?.sqlMessage || String(error).slice(0, 200) || 'Unknown error';
            console.error('getConversationMessages Error:', errorMsg);
            res.status(500).json({ status: 'error', error: errorMsg });
        }
    }

    /**
     * HTTP fallback for sending messages
     */
    async sendMessage(req, res) {
        try {
            const { content, media_url, type, partnerId, conversationId, chatId, replyToId, attachment } = req.body;
            const userId = req.user.user_id || req.user.userId;

            if (!content && !media_url && !attachment) {
                return res.status(400).json({ status: 'error', error: 'Content, media, or attachment is required' });
            }

            // Serialize generic attachment (story, post, event, profile, marketplace, etc.)
            const metadata = attachment ? JSON.stringify({ attachment }) : null;

            const messageId = await Message.sendMessage({
                recipientId: partnerId || null,
                chatId: chatId || conversationId || null,
                senderId: userId,
                content: content || '',
                type: type || 'text',
                mediaUrl: media_url || null,
                replyToId,
                metadata,
            });

            res.json({ status: 'success', data: { messageId } });
        } catch (error) {
            console.error('[ERROR] sendMessage:', error);
            if (error.code === 'MESSAGE_BLOCKED' || error.isBlocked) {
                return res.status(403).json({
                    status: 'error',
                    code: 'MESSAGE_BLOCKED',
                    error: 'Messaging is blocked in this conversation'
                });
            }
            if (error.code === 'MESSAGE_PERMISSION_DENIED') {
                return res.status(403).json({
                    status: 'error',
                    code: 'MESSAGE_PERMISSION_DENIED',
                    error: error.message
                });
            }
            res.status(500).json({ status: 'error', error: 'Failed to send message', details: error.message });
        }
    }


    /**
     * Enterprise Cursor-based Delta Synchronization
     */
    async cursorSync(req, res) {
        try {
            const userId = req.user.user_id || req.user.userId;
            const lastCursor = Number(req.query.cursor || req.body.cursor || 0);
            const messages = await Message.getCursorDelta(userId, lastCursor);
            res.json({ status: 'success', data: { messages } });
        } catch (error) {
            console.error('cursorSync Error:', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    /**
     * HTTP fallback for Session Delivery ACK
     */
    async ackDelivery(req, res) {
        try {
            const userId = req.user.user_id || req.user.userId;
            const { messageId, sessionId } = req.body;
            if (!messageId) return res.status(400).json({ status: 'error', error: 'messageId required' });
            await Message.markSessionDelivered(messageId, sessionId || 'http-session', userId);
            res.json({ status: 'success' });
        } catch (error) {
            console.error('ackDelivery Error:', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    /**
     * HTTP fallback for Tri-Condition Read ACK
     */
    async ackRead(req, res) {
        try {
            const userId = req.user.user_id || req.user.userId;
            const { chatId, messageIds } = req.body;
            if (!chatId) return res.status(400).json({ status: 'error', error: 'chatId required' });
            await Message.markReadTriCondition(chatId, messageIds, userId);
            res.json({ status: 'success' });
        } catch (error) {
            console.error('ackRead Error:', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    /**
     * Start a new conversation or get existing one
     */
    async startConversation(req, res) {
        try {
            const { partnerId, listingId } = req.body;
            const userId = req.user.user_id || req.user.userId;
            const conversationId = await Message.getOrCreateConversation(userId, partnerId, listingId);
            res.json({ status: 'success', data: { conversationId } });
        } catch (error) {
            res.status(500).json({ status: 'error', error: 'Server error' });
        }

    }

    /**
     * Message management (Delete for me, Delete for everyone, Edit, React)
     */
    async deleteMessage(req, res) {
        try {
            const { messageId } = req.params;
            const { forEveryone, chatId } = req.body;
            const userId = req.user.user_id || req.user.userId;

            // Verify user belongs to the chat before any delete action
            const msg = await Message.getById(messageId);
            if (!msg) {
                return res.status(404).json({ status: 'error', error: 'Message not found' });
            }
            // Determine chat ID (personal or group)
            const chatIdToCheck = msg.chat_id || msg.conversation_id || msg.personal_chat_id;
            const isParticipant = await GroupMember.isParticipant(chatIdToCheck, userId);
            if (!isParticipant) {
                return res.status(403).json({ status: 'error', error: 'User not part of this chat' });
            }
            const timeDiffMins = (Date.now() - new Date(msg.sent_at).getTime()) / 60000;
            let success = false;
            if (forEveryone) {
                if (msg.sender_id === userId) {
                    if (timeDiffMins > 15) {
                        return res.status(403).json({ status: 'error', error: 'Delete window expired (max 15 mins)' });
                    }
                    success = await Message.deleteForEveryone(messageId, userId);
                } else if (chatId) {
                    const isAdmin = await GroupMember.isAdmin(chatId, userId);
                    if (isAdmin) {
                        success = await Message.deleteForEveryone(messageId, userId, true, req.user.username || 'admin');
                    }
                }
                if (success) {
                    return res.json({ status: 'success', message: 'Deleted for everyone' });
                }
                return res.status(403).json({ status: 'error', error: 'Permission denied or delete failed' });
            } else {
                // Delete for me (soft delete)
                await Message.deleteForMe(messageId, userId);
                return res.json({ status: 'success', message: 'Deleted for me' });
            }
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async reactToMessage(req, res) {
        try {
            const { messageId } = req.params;
            const { emoji, remove } = req.body;
            const userId = req.user.user_id || req.user.userId;

            if (!messageId) return res.status(400).json({ status: 'error', error: 'messageId required' });

            let result;
            if (remove) {
                result = await Message.removeReaction(messageId, userId);
            } else {
                if (!emoji) return res.status(400).json({ status: 'error', error: 'emoji required' });
                result = await Message.addReaction(messageId, userId, emoji);
            }
            res.json({ status: 'success', data: result });
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async removeReaction(req, res) {
        try {
            const { messageId } = req.params;
            const userId = req.user.user_id || req.user.userId;
            const result = await Message.removeReaction(messageId, userId);
            res.json({ status: 'success', data: result });
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async starMessage(req, res) {
        try {
            const { messageId } = req.params;
            const userId = req.user.user_id || req.user.userId;
            const result = await Message.starMessage(messageId, userId, true);
            res.json({ status: 'success', data: result });
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async unstarMessage(req, res) {
        try {
            const { messageId } = req.params;
            const userId = req.user.user_id || req.user.userId;
            const result = await Message.starMessage(messageId, userId, false);
            res.json({ status: 'success', data: result });
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async editMessage(req, res) {
        try {
            const { messageId } = req.params;
            const { content } = req.body;
            const userId = req.user.user_id || req.user.userId;

            if (!content || !content.trim()) {
                return res.status(400).json({ status: 'error', error: 'Content is required' });
            }

            const updated = await Message.editMessage(messageId, userId, content.trim());
            if (!updated) {
                return res.status(403).json({ status: 'error', error: 'Cannot edit message (not yours or past 15 min)' });
            }
            res.json({ status: 'success', data: updated });
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async deleteMessageForEveryone(req, res) {
        try {
            const { messageId } = req.params;
            const userId = req.user.user_id || req.user.userId;

            const deleted = await Message.deleteMessageForEveryone(messageId, userId);
            if (!deleted) {
                return res.status(403).json({ status: 'error', error: 'Cannot delete message for everyone (not yours)' });
            }
            res.json({ status: 'success', data: deleted });
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async syncEvents(req, res) {
        try {
            const { chatId, sinceSeq } = req.query;
            const events = await Message.getEventsSinceSeq(chatId, sinceSeq);
            res.json({ status: 'success', data: events });
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async searchMessages(req, res) {
        try {
            const { chatId, q } = req.query;
            const userId = req.user.user_id || req.user.userId;
            const messages = await Message.searchMessages(userId, chatId, q);
            res.json({ status: 'success', data: messages });
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async muteConversation(req, res) {
        try {
            const { chatId } = req.params;
            const { muted } = req.body;
            const userId = req.user.user_id || req.user.userId;
            await Message.muteConversation(userId, chatId, muted !== false);
            res.json({ status: 'success' });
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async markRead(req, res) {
        try {
            const { chatId } = req.params;
            const userId = req.user.user_id || req.user.userId;
            await Message.updateStatus(chatId, userId, 'read');
            res.json({ status: 'success' });
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async markUnread(req, res) {
        try {
            const { chatId } = req.params;
            const userId = req.user.user_id || req.user.userId;
            await Message.updateStatus(chatId, userId, 'unread');
            res.json({ status: 'success' });
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async deleteConversation(req, res) {
        try {
            const { chatId } = req.params;
            const userId = req.user.user_id || req.user.userId;
            await Message.deleteConversation(userId, chatId);

            // Emit real-time event so other tabs/devices sync
            try {
                const { getIO } = require('../socket');
                const io = getIO();
                if (io) {
                    io.to(`user:${userId}`).to(`user_${userId}`).emit('conversation_updated', {
                        chatId, action: 'deleted', userId
                    });
                }
            } catch (err) {}

            res.json({ status: 'success' });
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async getArchivedConversations(req, res) {
        try {
            const userId = req.user.user_id || req.user.userId;
            const conversations = await Message.getUserConversations(userId);
            const { formatSystemUser, isSystemAccountId } = require('../helpers/systemAccount.helper');
            const archived = (conversations || [])
                .filter(c => Number(c.is_archived) === 1)
                .map(c => {
                    const isSys = isSystemAccountId(c.partner_id) || Boolean(c.is_system_account);
                    return {
                        ...formatSystemUser(c),
                        is_system: isSys,
                        is_system_account: isSys
                    };
                });
            res.json({ status: 'success', data: archived, conversations: archived });
        } catch (error) {
            console.error('getArchivedConversations Error:', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async archiveConversation(req, res) {
        try {
            const { chatId } = req.params;
            const userId = req.user.user_id || req.user.userId;
            const archived = req.body.archived !== false && req.body.isArchived !== false;
            await Message.archiveConversation(userId, chatId, archived);

            // Emit real-time event so other tabs/devices sync
            try {
                const { getIO } = require('../socket');
                const io = getIO();
                if (io) {
                    io.to(`user:${userId}`).to(`user_${userId}`).emit('conversation_updated', {
                        chatId, action: archived ? 'archived' : 'unarchived', userId, is_archived: archived
                    });
                }
            } catch (err) {}

            res.json({ status: 'success' });
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async pinConversation(req, res) {
        try {
            const { chatId } = req.params;
            const userId = req.user.user_id || req.user.userId;
            const isPinned = req.body.isPinned !== false;
            await Message.pinConversation(userId, chatId, isPinned);

            try {
                const { getIO } = require('../socket');
                const io = getIO();
                if (io) {
                    io.to(`user:${userId}`).to(`user_${userId}`).emit('conversation_updated', {
                        chatId, action: isPinned ? 'pinned' : 'unpinned', userId, is_pinned: isPinned
                    });
                }
            } catch (err) {}

            res.json({ status: 'success' });
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async favoriteConversation(req, res) {
        try {
            const { chatId } = req.params;
            const userId = req.user.user_id || req.user.userId;
            const isFavorite = req.body.isFavorite !== false;
            await Message.favoriteConversation(userId, chatId, isFavorite);

            try {
                const { getIO } = require('../socket');
                const io = getIO();
                if (io) {
                    io.to(`user:${userId}`).to(`user_${userId}`).emit('conversation_updated', {
                        chatId, action: isFavorite ? 'favorited' : 'unfavorited', userId, is_favorite: isFavorite
                    });
                }
            } catch (err) {}

            res.json({ status: 'success' });
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async priorityConversation(req, res) {
        try {
            const { chatId } = req.params;
            const userId = req.user.user_id || req.user.userId;
            const isPriority = req.body.isPriority !== false;
            await Message.priorityConversation(userId, chatId, isPriority);

            try {
                const { getIO } = require('../socket');
                const io = getIO();
                if (io) {
                    io.to(`user:${userId}`).to(`user_${userId}`).emit('conversation_updated', {
                        chatId, action: isPriority ? 'priority_on' : 'priority_off', userId, is_priority: isPriority
                    });
                }
            } catch (err) {}

            res.json({ status: 'success' });
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async pinMessage(req, res) {
        try {
            const { messageId } = req.params;
            const { chatId } = req.body;
            const userId = req.user.user_id || req.user.userId;

            if (!chatId) {
                return res.status(400).json({ status: 'error', error: 'chatId is required' });
            }

            const [groupExists] = await pool.query('SELECT chat_id FROM group_chats WHERE chat_id = ?', [chatId]);
            if (groupExists.length > 0) {
                const isAdmin = await GroupMember.isAdmin(chatId, userId);
                if (!isAdmin) {
                    return res.status(403).json({ status: 'error', error: 'Only admins can pin messages in group chats' });
                }
            }

            const [pinnedCount] = await pool.query(
                'SELECT COUNT(*) as count FROM messages WHERE (chat_id = ? OR conversation_id = ?) AND pinned = 1',
                [chatId, chatId]
            );
            if (pinnedCount[0].count >= 5) {
                return res.status(400).json({ status: 'error', error: 'Pin limit reached (maximum 5 pinned messages allowed)' });
            }

            const [result] = await pool.query(
                'UPDATE messages SET pinned = 1, pinned_at = NOW(), pinned_by = ? WHERE message_id = ?',
                [userId, messageId]
            );

            if (result.affectedRows > 0) {
                res.json({ status: 'success' });
            } else {
                res.status(404).json({ status: 'error', error: 'Message not found' });
            }
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async unpinMessage(req, res) {
        try {
            const { messageId } = req.params;
            const { chatId } = req.body;
            const userId = req.user.user_id || req.user.userId;

            if (!chatId) {
                return res.status(400).json({ status: 'error', error: 'chatId is required' });
            }

            const [groupExists] = await pool.query('SELECT chat_id FROM group_chats WHERE chat_id = ?', [chatId]);
            if (groupExists.length > 0) {
                const isAdmin = await GroupMember.isAdmin(chatId, userId);
                if (!isAdmin) {
                    return res.status(403).json({ status: 'error', error: 'Only admins can unpin messages in group chats' });
                }
            }

            const [result] = await pool.query(
                'UPDATE messages SET pinned = 0, pinned_at = NULL, pinned_by = NULL WHERE message_id = ?',
                [messageId]
            );

            if (result.affectedRows > 0) {
                res.json({ status: 'success' });
            } else {
                res.status(404).json({ status: 'error', error: 'Message not found' });
            }
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async copyMessage(req, res) {
        try {
            const { messageId } = req.params;
            const viewerUserId = req.user ? (req.user.user_id || req.user.userId || req.user.id) : null;
            const originalMsg = await Message.getById(messageId);
            if (!originalMsg) {
                return res.status(404).json({ status: 'error', error: 'Original message not found' });
            }

            const sourceChatId = originalMsg.chat_id || originalMsg.conversation_id || originalMsg.personal_chat_id;
            
            // Fetch policy owner's privacy settings
            const [privacyRows] = await pool.query(
                'SELECT allow_forward, allow_copy, block_screenshot, blur_screen_recording, privacy_version FROM chat_privacy_settings WHERE chat_id = ? AND user_id = ?',
                [sourceChatId, originalMsg.sender_id || originalMsg.senderId]
            );

            const senderPrivacy = (privacyRows && privacyRows[0]) ? privacyRows[0] : {};
            const permissions = PermissionEngine.computePermissions({
                message: originalMsg,
                senderPrivacy,
                viewerUserId
            });

            if (!permissions.canCopy) {
                return res.status(403).json({
                    status: 'error',
                    code: 'MESSAGE_PERMISSION_DENIED',
                    permission: 'copy',
                    error: 'Copying is disabled by message owner privacy settings'
                });
            }

            res.json({ status: 'success', data: { content: originalMsg.content } });
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async forwardMessage(req, res) {
        try {
            const { messageId } = req.params;
            const { targetChatIds } = req.body;
            const viewerUserId = req.user ? (req.user.user_id || req.user.userId || req.user.id) : null;

            if (!targetChatIds || !Array.isArray(targetChatIds)) {
                return res.status(400).json({ status: 'error', error: 'targetChatIds array is required' });
            }

            const originalMsg = await Message.getById(messageId);
            if (!originalMsg) {
                return res.status(404).json({ status: 'error', error: 'Original message not found' });
            }

            const sourceChatId = originalMsg.chat_id || originalMsg.conversation_id || originalMsg.personal_chat_id;
            
            // Fetch policy owner's privacy settings
            const [privacyRows] = await pool.query(
                'SELECT allow_forward, allow_copy, block_screenshot, blur_screen_recording, privacy_version FROM chat_privacy_settings WHERE chat_id = ? AND user_id = ?',
                [sourceChatId, originalMsg.sender_id || originalMsg.senderId]
            );

            const senderPrivacy = (privacyRows && privacyRows[0]) ? privacyRows[0] : {};
            const permissions = PermissionEngine.computePermissions({
                message: originalMsg,
                senderPrivacy,
                viewerUserId
            });

            if (!permissions.canForward) {
                return res.status(403).json({
                    status: 'error',
                    code: 'MESSAGE_PERMISSION_DENIED',
                    permission: 'forward',
                    error: 'Forwarding is disabled by message owner privacy settings'
                });
            }

            const forwardedMessages = [];
            for (const targetChatId of targetChatIds) {
                const [pc] = await pool.query('SELECT participant1_id, participant2_id FROM personal_chats WHERE chat_id = ?', [targetChatId]);
                
                let recipientId = null;
                if (pc.length > 0) {
                    recipientId = pc[0].participant1_id === userId ? pc[0].participant2_id : pc[0].participant1_id;
                }

                const newMsgId = crypto.randomUUID();
                const sentAt = new Date();
                const personalChatId = pc.length > 0 ? targetChatId : null;
                const groupChatId = pc.length > 0 ? null : targetChatId;

                await pool.query(`
                    INSERT INTO messages (
                        message_id, chat_id, conversation_id, personal_chat_id, 
                        sender_id, recipient_id, content, type, media_url, 
                        status, is_read, sent_at, context,
                        forwarded, forwarded_from
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', 0, ?, 'chat', 1, ?)
                `, [
                    newMsgId, 
                    groupChatId, 
                    personalChatId, 
                    personalChatId, 
                    userId, 
                    recipientId, 
                    originalMsg.content, 
                    originalMsg.type, 
                    originalMsg.media_url, 
                    sentAt, 
                    req.user.username || 'user'
                ]);

                if (personalChatId) {
                    await pool.query('UPDATE personal_chats SET last_message_time = ? WHERE chat_id = ?', [sentAt, personalChatId]);
                } else if (groupChatId) {
                    await pool.query('UPDATE group_chats SET last_message_at = ? WHERE chat_id = ?', [sentAt, groupChatId]);
                }

                forwardedMessages.push({ messageId: newMsgId, chatId: targetChatId });
            }

            res.json({ status: 'success', data: forwardedMessages });
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    // ─── Chat Info: Pinned Messages ────────────────────────────────────────────
    async getChatPinnedMessages(req, res) {
        try {
            const { chatId } = req.params;
            const userId = req.user.user_id || req.user.userId;
            const { q, sort } = req.query;

            const [chatRows] = await pool.query(
                'SELECT chat_id FROM personal_chats WHERE chat_id = ? AND (participant1_id = ? OR participant2_id = ?)',
                [chatId, userId, userId]
            );
            if (!chatRows.length) {
                const [groupRows] = await pool.query('SELECT chat_id FROM group_chats WHERE chat_id = ?', [chatId]);
                if (!groupRows.length) return res.status(403).json({ status: 'error', error: 'Access denied' });
            }

            let query = `
                SELECT 
                    m.message_id, m.sender_id, m.content, m.type, m.media_url, m.metadata,
                    m.sent_at, m.pinned_at, m.pinned_by,
                    u.name AS sender_name, u.avatar_url AS sender_avatar,
                    pb.name AS pinned_by_name
                FROM messages m
                LEFT JOIN users u ON u.user_id = m.sender_id
                LEFT JOIN users pb ON pb.user_id = m.pinned_by
                WHERE (m.chat_id = ? OR m.conversation_id = ? OR m.personal_chat_id = ?)
                  AND m.pinned = 1
                  AND (m.deleted_for_everyone IS NULL OR m.deleted_for_everyone = 0)
            `;
            const params = [chatId, chatId, chatId];

            if (q && q.trim()) {
                query += ` AND m.content LIKE ? `;
                params.push(`%${q.trim()}%`);
            }

            if (sort === 'oldest') {
                query += ` ORDER BY m.pinned_at ASC `;
            } else if (sort === 'me') {
                query += ` AND m.pinned_by = ? ORDER BY m.pinned_at DESC `;
                params.push(userId);
            } else if (sort === 'them') {
                query += ` AND m.pinned_by != ? ORDER BY m.pinned_at DESC `;
                params.push(userId);
            } else {
                query += ` ORDER BY m.pinned_at DESC `;
            }

            const [rows] = await pool.query(query, params);

            res.json({ status: 'success', data: rows });
        } catch (error) {
            console.error('[getChatPinnedMessages]', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    // ─── Chat Info: Media (images + videos) ────────────────────────────────────
    async getChatMedia(req, res) {
        try {
            const { chatId } = req.params;
            const userId = req.user.user_id || req.user.userId;
            const cursor = req.query.cursor || null;
            const limit = Math.min(parseInt(req.query.limit || '30', 10), 60);

            const [chatRows] = await pool.query(
                'SELECT chat_id FROM personal_chats WHERE chat_id = ? AND (participant1_id = ? OR participant2_id = ?)',
                [chatId, userId, userId]
            );
            if (!chatRows.length) {
                const [groupRows] = await pool.query('SELECT chat_id FROM group_chats WHERE chat_id = ?', [chatId]);
                if (!groupRows.length) return res.status(403).json({ status: 'error', error: 'Access denied' });
            }

            const cursorClause = cursor ? 'AND m.sent_at < ?' : '';
            const params = cursor
                ? [chatId, chatId, chatId, cursor, limit + 1]
                : [chatId, chatId, chatId, limit + 1];

            const [rows] = await pool.query(`
                SELECT m.message_id, m.chat_id, m.sender_id, m.type AS media_type, m.media_url, m.content, m.sent_at AS created_at, m.metadata,
                       u.name AS sender_name, u.avatar_url AS sender_avatar
                FROM messages m
                LEFT JOIN users u ON u.user_id = m.sender_id
                WHERE (m.chat_id = ? OR m.conversation_id = ? OR m.personal_chat_id = ?)
                  AND m.type IN ('image','video')
                  AND m.media_url IS NOT NULL
                  AND (m.deleted_for_everyone IS NULL OR m.deleted_for_everyone = 0)
                  ${cursorClause}
                ORDER BY m.sent_at DESC
                LIMIT ?
            `, params);

            const hasMore = rows.length > limit;
            const rawData = hasMore ? rows.slice(0, limit) : rows;
            const nextCursor = hasMore ? rawData[rawData.length - 1].created_at : null;

            const data = rawData.map(item => {
                let meta = {};
                try { if (item.metadata) meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata; } catch(e){}
                return {
                    message_id: item.message_id,
                    chat_id: item.chat_id || chatId,
                    sender_id: item.sender_id,
                    sender_name: item.sender_name,
                    sender_avatar: item.sender_avatar,
                    media_type: item.media_type,
                    thumbnail_url: item.media_url,
                    media_url: item.media_url,
                    created_at: item.created_at,
                    duration: meta.duration || 0,
                    content: item.content
                };
            });

            res.json({ status: 'success', data, nextCursor, hasMore });
        } catch (error) {
            console.error('[getChatMedia]', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    // ─── Chat Info: Files (documents) ─────────────────────────────────────────
    async getChatFiles(req, res) {
        try {
            const { chatId } = req.params;
            const userId = req.user.user_id || req.user.userId;
            const { category, q, sort, cursor } = req.query;
            const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);

            const [chatRows] = await pool.query(
                'SELECT chat_id FROM personal_chats WHERE chat_id = ? AND (participant1_id = ? OR participant2_id = ?)',
                [chatId, userId, userId]
            );
            if (!chatRows.length) {
                const [groupRows] = await pool.query('SELECT chat_id FROM group_chats WHERE chat_id = ?', [chatId]);
                if (!groupRows.length) return res.status(403).json({ status: 'error', error: 'Access denied' });
            }

            let query = `
                SELECT m.message_id, m.type, m.media_url, m.content, m.sent_at, m.sender_id, m.metadata,
                       u.name AS sender_name
                FROM messages m
                LEFT JOIN users u ON u.user_id = m.sender_id
                WHERE (m.chat_id = ? OR m.conversation_id = ? OR m.personal_chat_id = ?)
                  AND m.type = 'document'
                  AND m.media_url IS NOT NULL
                  AND (m.deleted_for_everyone IS NULL OR m.deleted_for_everyone = 0)
            `;
            const params = [chatId, chatId, chatId];

            if (q && q.trim()) {
                query += ` AND (m.content LIKE ? OR m.media_url LIKE ?) `;
                params.push(`%${q.trim()}%`, `%${q.trim()}%`);
            }

            if (cursor) {
                query += ` AND m.sent_at < ? `;
                params.push(cursor);
            }

            if (sort === 'oldest') {
                query += ` ORDER BY m.sent_at ASC `;
            } else {
                query += ` ORDER BY m.sent_at DESC `;
            }

            query += ` LIMIT ? `;
            params.push(limit + 1);

            const [rows] = await pool.query(query, params);

            let data = rows.map(r => {
                let meta = {};
                try { if (r.metadata) meta = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata; } catch(e){}
                const ext = (r.media_url.split('.').pop() || '').toLowerCase();
                let fileCategory = 'Other';
                if (['pdf'].includes(ext)) fileCategory = 'PDF';
                else if (['doc', 'docx'].includes(ext)) fileCategory = 'Word';
                else if (['xls', 'xlsx', 'csv'].includes(ext)) fileCategory = 'Excel';
                else if (['ppt', 'pptx'].includes(ext)) fileCategory = 'PowerPoint';
                else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) fileCategory = 'ZIP';
                else if (['apk'].includes(ext)) fileCategory = 'APK';

                return {
                    message_id: r.message_id,
                    name: r.content || r.media_url.split('/').pop() || 'Document',
                    file_url: r.media_url,
                    size: meta.size || meta.fileSize || '1.5 MB',
                    size_bytes: meta.sizeBytes || 1500000,
                    category: fileCategory,
                    extension: ext,
                    sender_name: r.sender_name,
                    sent_at: r.sent_at
                };
            });

            if (category && category !== 'All') {
                data = data.filter(item => item.category.toLowerCase() === category.toLowerCase());
            }

            if (sort === 'largest') {
                data.sort((a, b) => b.size_bytes - a.size_bytes);
            } else if (sort === 'smallest') {
                data.sort((a, b) => a.size_bytes - b.size_bytes);
            }

            const hasMore = rows.length > limit;
            const finalData = hasMore ? data.slice(0, limit) : data;
            const nextCursor = hasMore ? rows[limit - 1].sent_at : null;

            res.json({ status: 'success', data: finalData, nextCursor, hasMore });
        } catch (error) {
            console.error('[getChatFiles]', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    // ─── Chat Info: Links ──────────────────────────────────────────────────────
    async getChatLinks(req, res) {
        try {
            const { chatId } = req.params;
            const userId = req.user.user_id || req.user.userId;
            const cursor = req.query.cursor || null;
            const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);

            const [chatRows] = await pool.query(
                'SELECT chat_id FROM personal_chats WHERE chat_id = ? AND (participant1_id = ? OR participant2_id = ?)',
                [chatId, userId, userId]
            );
            if (!chatRows.length) {
                const [groupRows] = await pool.query('SELECT chat_id FROM group_chats WHERE chat_id = ?', [chatId]);
                if (!groupRows.length) return res.status(403).json({ status: 'error', error: 'Access denied' });
            }

            const cursorClause = cursor ? 'AND m.sent_at < ?' : '';
            const params = cursor
                ? [chatId, chatId, chatId, cursor, limit + 1]
                : [chatId, chatId, chatId, limit + 1];

            const [rows] = await pool.query(`
                SELECT m.message_id, m.content, m.sent_at, m.sender_id, m.metadata,
                       u.name AS sender_name
                FROM messages m
                LEFT JOIN users u ON u.user_id = m.sender_id
                WHERE (m.chat_id = ? OR m.conversation_id = ? OR m.personal_chat_id = ?)
                  AND m.type = 'text'
                  AND m.content REGEXP 'https?://'
                  AND (m.deleted_for_everyone IS NULL OR m.deleted_for_everyone = 0)
                  ${cursorClause}
                ORDER BY m.sent_at DESC
                LIMIT ?
            `, params);

            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const data = rows
                .map(row => {
                    const urls = row.content.match(urlRegex) || [];
                    const firstUrl = urls[0];
                    if (!firstUrl) return null;
                    let domain = '';
                    try { domain = new URL(firstUrl).hostname.replace('www.', ''); } catch (e) { domain = firstUrl; }
                    
                    let meta = {};
                    try { if (row.metadata) meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata; } catch(e){}

                    // Compute date category
                    const sentDate = new Date(row.sent_at);
                    const now = new Date();
                    const diffDays = Math.floor((now.getTime() - sentDate.getTime()) / (1000 * 3600 * 24));
                    let dateGroup = 'Older';
                    if (diffDays === 0) dateGroup = 'Today';
                    else if (diffDays === 1) dateGroup = 'Yesterday';
                    else if (diffDays <= 7) dateGroup = 'Last Week';

                    return {
                        message_id: row.message_id,
                        url: firstUrl,
                        domain,
                        title: meta.ogTitle || meta.title || domain,
                        description: meta.ogDescription || meta.description || row.content,
                        image_url: meta.ogImage || meta.image || null,
                        sender_name: row.sender_name,
                        sent_at: row.sent_at,
                        date_group: dateGroup
                    };
                })
                .filter(Boolean);

            const hasMore = rows.length > limit;
            const finalData = hasMore ? data.slice(0, limit) : data;
            const nextCursor = hasMore ? rows[limit - 1].sent_at : null;

            res.json({ status: 'success', data: finalData, nextCursor, hasMore });
        } catch (error) {
            console.error('[getChatLinks]', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    // ─── Chat Info: Voice Notes ────────────────────────────────────────────────
    async getChatVoice(req, res) {
        try {
            const { chatId } = req.params;
            const userId = req.user.user_id || req.user.userId;
            const cursor = req.query.cursor || null;
            const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);

            const [chatRows] = await pool.query(
                'SELECT chat_id FROM personal_chats WHERE chat_id = ? AND (participant1_id = ? OR participant2_id = ?)',
                [chatId, userId, userId]
            );
            if (!chatRows.length) {
                const [groupRows] = await pool.query('SELECT chat_id FROM group_chats WHERE chat_id = ?', [chatId]);
                if (!groupRows.length) return res.status(403).json({ status: 'error', error: 'Access denied' });
            }

            const cursorClause = cursor ? 'AND m.sent_at < ?' : '';
            const params = cursor
                ? [chatId, chatId, chatId, cursor, limit + 1]
                : [chatId, chatId, chatId, limit + 1];

            const [rows] = await pool.query(`
                SELECT m.message_id, m.type, m.media_url, m.sent_at, m.sender_id, m.metadata,
                       u.name AS sender_name, u.avatar_url AS sender_avatar
                FROM messages m
                LEFT JOIN users u ON u.user_id = m.sender_id
                WHERE (m.chat_id = ? OR m.conversation_id = ? OR m.personal_chat_id = ?)
                  AND m.type = 'voice_note'
                  AND m.media_url IS NOT NULL
                  AND (m.deleted_for_everyone IS NULL OR m.deleted_for_everyone = 0)
                  ${cursorClause}
                ORDER BY m.sent_at DESC
                LIMIT ?
            `, params);

            const hasMore = rows.length > limit;
            const rawData = hasMore ? rows.slice(0, limit) : rows;
            const nextCursor = hasMore ? rawData[rawData.length - 1].sent_at : null;

            const data = rawData.map(r => {
                let meta = {};
                try { if (r.metadata) meta = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata; } catch(e){}
                return {
                    message_id: r.message_id,
                    media_url: r.media_url,
                    duration: meta.duration || 14,
                    waveform: meta.waveform || [15, 30, 45, 60, 40, 25, 55, 75, 40, 20],
                    sender_name: r.sender_name,
                    sender_avatar: r.sender_avatar,
                    sent_at: r.sent_at
                };
            });

            res.json({ status: 'success', data, nextCursor, hasMore });
        } catch (error) {
            console.error('[getChatVoice]', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    // ─── Chat Info: Music ──────────────────────────────────────────────────────
    async getChatMusic(req, res) {
        try {
            const { chatId } = req.params;
            const userId = req.user.user_id || req.user.userId;
            const cursor = req.query.cursor || null;
            const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);

            const [chatRows] = await pool.query(
                'SELECT chat_id FROM personal_chats WHERE chat_id = ? AND (participant1_id = ? OR participant2_id = ?)',
                [chatId, userId, userId]
            );
            if (!chatRows.length) {
                const [groupRows] = await pool.query('SELECT chat_id FROM group_chats WHERE chat_id = ?', [chatId]);
                if (!groupRows.length) return res.status(403).json({ status: 'error', error: 'Access denied' });
            }

            const cursorClause = cursor ? 'AND m.sent_at < ?' : '';
            const params = cursor
                ? [chatId, chatId, chatId, cursor, limit + 1]
                : [chatId, chatId, chatId, limit + 1];

            const [rows] = await pool.query(`
                SELECT m.message_id, m.type, m.media_url, m.content, m.sent_at, m.sender_id, m.metadata,
                       u.name AS sender_name
                FROM messages m
                LEFT JOIN users u ON u.user_id = m.sender_id
                WHERE (m.chat_id = ? OR m.conversation_id = ? OR m.personal_chat_id = ?)
                  AND m.type = 'audio'
                  AND (m.deleted_for_everyone IS NULL OR m.deleted_for_everyone = 0)
                  ${cursorClause}
                ORDER BY m.sent_at DESC
                LIMIT ?
            `, params);

            const hasMore = rows.length > limit;
            const rawData = hasMore ? rows.slice(0, limit) : rows;
            const nextCursor = hasMore ? rawData[rawData.length - 1].sent_at : null;

            const data = rawData.map(r => {
                let meta = {};
                try { if (r.metadata) meta = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata; } catch(e){}
                return {
                    message_id: r.message_id,
                    media_url: r.media_url,
                    track_title: meta.title || r.content || 'Sparkle Track',
                    artist: meta.artist || 'Unknown Artist',
                    album_art: meta.albumArt || meta.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150',
                    duration: meta.duration || 180,
                    sender_name: r.sender_name,
                    sent_at: r.sent_at
                };
            });

            res.json({ status: 'success', data, nextCursor, hasMore });
        } catch (error) {
            console.error('[getChatMusic]', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    // ─── Chat Info: Stories ────────────────────────────────────────────────────
    async getChatStories(req, res) {
        try {
            const { chatId } = req.params;
            const userId = req.user.user_id || req.user.userId;
            const cursor = req.query.cursor || null;
            const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);

            const [chatRows] = await pool.query(
                'SELECT chat_id FROM personal_chats WHERE chat_id = ? AND (participant1_id = ? OR participant2_id = ?)',
                [chatId, userId, userId]
            );
            if (!chatRows.length) {
                const [groupRows] = await pool.query('SELECT chat_id FROM group_chats WHERE chat_id = ?', [chatId]);
                if (!groupRows.length) return res.status(403).json({ status: 'error', error: 'Access denied' });
            }

            const cursorClause = cursor ? 'AND m.sent_at < ?' : '';
            const params = cursor
                ? [chatId, chatId, chatId, cursor, limit + 1]
                : [chatId, chatId, chatId, limit + 1];

            const [rows] = await pool.query(`
                SELECT m.message_id, m.type, m.media_url, m.content, m.story_id, m.sent_at, m.sender_id, m.metadata,
                       u.name AS sender_name, u.avatar_url AS sender_avatar
                FROM messages m
                LEFT JOIN users u ON u.user_id = m.sender_id
                WHERE (m.chat_id = ? OR m.conversation_id = ? OR m.personal_chat_id = ?)
                  AND (m.type = 'story_reply' OR m.story_id IS NOT NULL OR (m.metadata LIKE '%"attachment"%' AND m.metadata LIKE '%story%'))
                  AND (m.deleted_for_everyone IS NULL OR m.deleted_for_everyone = 0)
                  ${cursorClause}
                ORDER BY m.sent_at DESC
                LIMIT ?
            `, params);

            const hasMore = rows.length > limit;
            const rawData = hasMore ? rows.slice(0, limit) : rows;
            const nextCursor = hasMore ? rawData[rawData.length - 1].sent_at : null;

            const data = rawData.map(r => {
                let meta = {};
                try { if (r.metadata) meta = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata; } catch(e){}
                const isExpired = (Date.now() - new Date(r.sent_at).getTime()) > (24 * 3600 * 1000);
                return {
                    message_id: r.message_id,
                    story_id: r.story_id || (meta.attachment && meta.attachment.id),
                    thumbnail_url: r.media_url || (meta.attachment && meta.attachment.mediaUrl) || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300',
                    sender_name: r.sender_name,
                    sender_avatar: r.sender_avatar,
                    is_expired: isExpired,
                    sent_at: r.sent_at
                };
            });

            res.json({ status: 'success', data, nextCursor, hasMore });
        } catch (error) {
            console.error('[getChatStories]', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    // ─── Chat Info: Posts ──────────────────────────────────────────────────────
    async getChatPosts(req, res) {
        try {
            const { chatId } = req.params;
            const userId = req.user.user_id || req.user.userId;
            const cursor = req.query.cursor || null;
            const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);

            const [chatRows] = await pool.query(
                'SELECT chat_id FROM personal_chats WHERE chat_id = ? AND (participant1_id = ? OR participant2_id = ?)',
                [chatId, userId, userId]
            );
            if (!chatRows.length) {
                const [groupRows] = await pool.query('SELECT chat_id FROM group_chats WHERE chat_id = ?', [chatId]);
                if (!groupRows.length) return res.status(403).json({ status: 'error', error: 'Access denied' });
            }

            const cursorClause = cursor ? 'AND m.sent_at < ?' : '';
            const params = cursor
                ? [chatId, chatId, chatId, cursor, limit + 1]
                : [chatId, chatId, chatId, limit + 1];

            const [rows] = await pool.query(`
                SELECT m.message_id, m.type, m.media_url, m.content, m.sent_at, m.sender_id, m.metadata,
                       u.name AS sender_name, u.avatar_url AS sender_avatar
                FROM messages m
                LEFT JOIN users u ON u.user_id = m.sender_id
                WHERE (m.chat_id = ? OR m.conversation_id = ? OR m.personal_chat_id = ?)
                  AND (m.type = 'post_share' OR (m.metadata LIKE '%"attachment"%' AND m.metadata LIKE '%post%'))
                  AND (m.deleted_for_everyone IS NULL OR m.deleted_for_everyone = 0)
                  ${cursorClause}
                ORDER BY m.sent_at DESC
                LIMIT ?
            `, params);

            const hasMore = rows.length > limit;
            const rawData = hasMore ? rows.slice(0, limit) : rows;
            const nextCursor = hasMore ? rawData[rawData.length - 1].sent_at : null;

            const data = rawData.map(r => {
                let meta = {};
                try { if (r.metadata) meta = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata; } catch(e){}
                const attachment = meta.attachment || {};
                return {
                    message_id: r.message_id,
                    post_id: attachment.id || r.message_id,
                    preview_text: attachment.content || r.content || 'Sparkle Post',
                    image_url: attachment.imageUrl || r.media_url,
                    likes_count: attachment.likesCount || 24,
                    comments_count: attachment.commentsCount || 5,
                    sender_name: r.sender_name,
                    sender_avatar: r.sender_avatar,
                    sent_at: r.sent_at
                };
            });

            res.json({ status: 'success', data, nextCursor, hasMore });
        } catch (error) {
            console.error('[getChatPosts]', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    // ─── Message Info & Delivery Timeline ─────────────────────────────────────
    async getMessageInfo(req, res) {
        try {
            const { messageId } = req.params;
            const userId = req.user.user_id || req.user.userId;

            const [rows] = await pool.query(`
                SELECT m.message_id, m.chat_id, m.personal_chat_id, m.sender_id, m.recipient_id,
                       m.content, m.type, m.media_url, m.sent_at, m.delivered_at, m.read_at,
                       m.edited, m.edited_at, m.forwarded, m.forwarded_from, m.pinned, m.pinned_at,
                       u.name AS sender_name, u.avatar_url AS sender_avatar
                FROM messages m
                LEFT JOIN users u ON u.user_id = m.sender_id
                WHERE m.message_id = ?
            `, [messageId]);

            if (!rows.length) {
                return res.status(404).json({ status: 'error', error: 'Message not found' });
            }

            const msg = rows[0];

            // Reactions breakdown
            const [reactions] = await pool.query(`
                SELECT mr.emoji, mr.user_id, u.name AS user_name, u.avatar_url
                FROM message_reactions mr
                LEFT JOIN users u ON u.user_id = mr.user_id
                WHERE mr.message_id = ?
            `, [messageId]).catch(() => [[]]);

            // Replies count
            const [replies] = await pool.query(`
                SELECT COUNT(*) as count FROM messages WHERE reply_to_message_id = ?
            `, [messageId]);

            res.json({
                status: 'success',
                data: {
                    message_id: msg.message_id,
                    content: msg.content,
                    type: msg.type,
                    sender_id: msg.sender_id,
                    sender_name: msg.sender_name,
                    sender_avatar: msg.sender_avatar,
                    timeline: {
                        sent_at: msg.sent_at,
                        delivered_at: msg.delivered_at || msg.sent_at,
                        seen_at: msg.read_at,
                        edited_at: msg.edited ? msg.edited_at : null
                    },
                    forwarded: !!msg.forwarded,
                    forwarded_from: msg.forwarded_from,
                    pinned: !!msg.pinned,
                    pinned_at: msg.pinned_at,
                    replies_count: replies[0] ? replies[0].count : 0,
                    reactions: reactions || []
                }
            });
        } catch (error) {
            console.error('[getMessageInfo]', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    // ─── Chat Info: Enhanced Statistics ──────────────────────────────────────
    async getChatStats(req, res) {
        try {
            const { chatId } = req.params;
            const userId = req.user.user_id || req.user.userId;

            const [chatRows] = await pool.query(
                'SELECT chat_id, created_at FROM personal_chats WHERE chat_id = ? AND (participant1_id = ? OR participant2_id = ?)',
                [chatId, userId, userId]
            );
            if (!chatRows.length) {
                const [groupRows] = await pool.query('SELECT chat_id, created_at FROM group_chats WHERE chat_id = ?', [chatId]);
                if (!groupRows.length) return res.status(403).json({ status: 'error', error: 'Access denied' });
            }

            const [stats] = await pool.query(`
                SELECT
                    SUM(CASE WHEN type = 'image' THEN 1 ELSE 0 END) AS photos,
                    SUM(CASE WHEN type = 'video' THEN 1 ELSE 0 END) AS videos,
                    SUM(CASE WHEN type = 'document' THEN 1 ELSE 0 END) AS files,
                    SUM(CASE WHEN type = 'voice_note' THEN 1 ELSE 0 END) AS voice_notes,
                    SUM(CASE WHEN type = 'text' AND content REGEXP 'https?://' THEN 1 ELSE 0 END) AS links,
                    SUM(CASE WHEN type = 'audio' THEN 1 ELSE 0 END) AS music,
                    SUM(CASE WHEN type = 'story_reply' OR story_id IS NOT NULL THEN 1 ELSE 0 END) AS stories,
                    SUM(CASE WHEN type = 'post_share' THEN 1 ELSE 0 END) AS posts,
                    SUM(CASE WHEN pinned = 1 THEN 1 ELSE 0 END) AS pinned,
                    MIN(sent_at) AS first_message_at
                FROM messages
                WHERE (chat_id = ? OR conversation_id = ? OR personal_chat_id = ?)
                  AND (deleted_for_everyone IS NULL OR deleted_for_everyone = 0)
            `, [chatId, chatId, chatId]);

            const statData = stats[0] || {};
            const photos = parseInt(statData.photos || 0, 10);
            const videos = parseInt(statData.videos || 0, 10);
            const files = parseInt(statData.files || 0, 10);
            const voiceNotes = parseInt(statData.voice_notes || 0, 10);
            const links = parseInt(statData.links || 0, 10);
            const music = parseInt(statData.music || 0, 10);
            const stories = parseInt(statData.stories || 0, 10);
            const posts = parseInt(statData.posts || 0, 10);
            const pinned = parseInt(statData.pinned || 0, 10);

            // Calculate most shared type
            const counts = [
                { type: 'Photos', count: photos },
                { type: 'Videos', count: videos },
                { type: 'Voice Notes', count: voiceNotes },
                { type: 'Files', count: files },
                { type: 'Links', count: links },
                { type: 'Music', count: music },
                { type: 'Stories', count: stories },
                { type: 'Posts', count: posts }
            ];
            counts.sort((a, b) => b.count - a.count);
            const mostSharedType = counts[0].count > 0 ? counts[0].type : 'Photos';

            // Calculate most active month
            const [monthly] = await pool.query(`
                SELECT DATE_FORMAT(sent_at, '%M %Y') AS month_name, COUNT(*) AS count
                FROM messages
                WHERE (chat_id = ? OR conversation_id = ? OR personal_chat_id = ?)
                GROUP BY DATE_FORMAT(sent_at, '%Y-%m'), DATE_FORMAT(sent_at, '%M %Y')
                ORDER BY count DESC
                LIMIT 1
            `, [chatId, chatId, chatId]);

            const mostActiveMonth = monthly.length > 0 ? monthly[0].month_name : 'June 2026';
            const startedChatting = statData.first_message_at ? new Date(statData.first_message_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'March 18, 2025';

            res.json({
                status: 'success',
                data: {
                    photos,
                    videos,
                    voice_notes: voiceNotes,
                    files,
                    links,
                    music,
                    stories,
                    posts,
                    pinned,
                    started_chatting: startedChatting,
                    most_active_month: mostActiveMonth,
                    most_shared_type: mostSharedType
                }
            });
        } catch (error) {
            console.error('[getChatStats]', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    // ─── Set Nickname & Emit System Message ─────────────────────────────────────
    async setChatNickname(req, res) {
        try {
            const { chatId } = req.params;
            const { targetUserId, targetName, nickname } = req.body;
            const userId = req.user.user_id || req.user.userId;
            const senderName = req.user.name || req.user.full_name || req.user.username || 'User';

            if (!nickname || !nickname.trim()) {
                return res.status(400).json({ status: 'error', error: 'Nickname is required' });
            }

            const cleanNickname = nickname.trim();
            const isSelf = targetUserId ? (String(targetUserId) === String(userId)) : false;

            const messageContent = isSelf
                ? `You set your nickname to ${cleanNickname}`
                : `You set ${targetName || 'partner'}'s nickname to ${cleanNickname}`;

            const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
            await pool.query(`
                INSERT INTO messages (message_id, chat_id, conversation_id, sender_id, content, type, metadata, sent_at)
                VALUES (?, ?, ?, ?, ?, 'system', ?, NOW())
            `, [
                messageId, chatId, chatId, userId, messageContent,
                JSON.stringify({ system_type: 'nickname_change', target_user_id: targetUserId, target_name: targetName, nickname: cleanNickname, set_by_name: senderName })
            ]);

            const historyEntry = {
                id: 'nick_' + Date.now(),
                chat_id: chatId,
                set_by_id: userId,
                set_by_name: senderName,
                target_user_id: targetUserId,
                target_name: targetName,
                nickname: cleanNickname,
                created_at: new Date().toISOString()
            };

            res.json({
                status: 'success',
                message: 'Nickname updated',
                data: {
                    nickname: cleanNickname,
                    system_message_id: messageId,
                    history_entry: historyEntry
                }
            });
        } catch (error) {
            console.error('[setChatNickname]', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    // ─── Get Chat Nickname History ─────────────────────────────────────────────
    async getChatNicknameHistory(req, res) {
        try {
            const { chatId } = req.params;
            const userId = req.user.user_id || req.user.userId;

            const [rows] = await pool.query(`
                SELECT m.message_id, m.content, m.sent_at, m.sender_id, m.metadata,
                       u.name AS sender_name
                FROM messages m
                LEFT JOIN users u ON u.user_id = m.sender_id
                WHERE (m.chat_id = ? OR m.conversation_id = ? OR m.personal_chat_id = ?)
                  AND m.type = 'system'
                  AND (m.deleted_for_everyone IS NULL OR m.deleted_for_everyone = 0)
                ORDER BY m.sent_at DESC
            `, [chatId, chatId, chatId]);

            const history = rows.map(r => {
                let meta = {};
                try { if (r.metadata) meta = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata; } catch(e){}
                return {
                    id: r.message_id,
                    content: r.content,
                    set_by_name: r.sender_name || meta.set_by_name || 'User',
                    target_name: meta.target_name || 'Partner',
                    nickname: meta.nickname || '',
                    sent_at: r.sent_at
                };
            }).filter(item => item.nickname || (item.content && item.content.includes('nickname')));

            res.json({ status: 'success', data: history });
        } catch (error) {
            console.error('[getChatNicknameHistory]', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }
}

module.exports = new MessageController();