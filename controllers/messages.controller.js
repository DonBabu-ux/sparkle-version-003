const Message = require('../models/Message');
const GroupChat = require('../models/GroupChat');

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
     * Get user's conversation list (Direct + Group)
     */
    async getInbox(req, res) {
        try {
            const userId = req.user.user_id || req.user.userId;
            const conversations = await Message.getUserConversations(userId);
            res.json({ status: 'success', data: conversations });
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
            console.error('getConversationMessages Error:', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    /**
     * HTTP fallback for sending messages
     */
    async sendMessage(req, res) {
        try {
            const { content, media_url, type, partnerId, conversationId, chatId, replyToId } = req.body;
            const userId = req.user.user_id || req.user.userId;

            if (!content && !media_url) {
                return res.status(400).json({ status: 'error', error: 'Content or media is required' });
            }

            const messageId = await Message.sendMessage({
                recipientId: partnerId || null,
                chatId: chatId || conversationId || null,
                senderId: userId,
                content,
                type: type || 'text',
                mediaUrl: media_url || null,
                replyToId
            });

            res.json({ status: 'success', data: { messageId } });
        } catch (error) {
            console.error('[ERROR] sendMessage:', error);
            res.status(500).json({ status: 'error', error: 'Failed to send message', details: error.message });
        }
    }

    /**
     * Start a new conversation or get existing one
     */
    async startConversation(req, res) {
        try {
            const { partnerId } = req.body;
            const userId = req.user.user_id || req.user.userId;
            const conversationId = await Message.getOrCreateConversation(userId, partnerId);
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
            const { forEveryone } = req.body;
            const userId = req.user.user_id || req.user.userId;

            if (forEveryone) {
                const success = await Message.deleteForEveryone(messageId, userId);
                return res.json({ status: success ? 'success' : 'error', message: success ? 'Deleted for everyone' : 'Could not delete' });
            } else {
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

            if (remove) {
                await Message.removeReaction(messageId, userId, emoji);
            } else {
                await Message.addReaction(messageId, userId, emoji);
            }
            res.json({ status: 'success' });
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
            res.json({ status: 'success' });
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
}

module.exports = new MessageController();