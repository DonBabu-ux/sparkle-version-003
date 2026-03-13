const Message = require('../models/Message');

class MessageController {
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

    async getConversationMessages(req, res) {
        try {
            const partnerId = req.params.conversationId || req.params.partnerId;
            const userId = req.user.user_id || req.user.userId;
            const messages = await Message.getMessages(partnerId, userId);
            res.json({ status: 'success', data: messages });
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async sendMessage(req, res) {
        try {
            const { content, media_url, type } = req.body;
            const partnerId = req.params.partnerId || req.body.partnerId || req.body.conversationId;
            const userId = (req.user && (req.user.user_id || req.user.userId)) || null;

            if (!userId) {
                return res.status(401).json({ status: 'error', error: 'Authentication required' });
            }

            console.log(`[DEBUG] Sending message from ${userId} to ${partnerId}`);

            const messageId = await Message.sendMessage({
                recipientId: partnerId,
                senderId: userId,
                content,
                type: type || 'text',
                mediaUrl: media_url || null
            });

            res.json({ status: 'success', data: { messageId, recipientId: partnerId } });
        } catch (error) {
            console.error('[ERROR] sendMessage:', error);
            res.status(500).json({ status: 'error', error: 'Failed to send message', details: error.message });
        }
    }

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

    // ============ NEW ENDPOINTS ============

    // DELETE /api/messages/:messageId — soft delete a message (sender only)
    async deleteMessage(req, res) {
        try {
            const { messageId } = req.params;
            const userId = req.user.user_id || req.user.userId;
            const deleted = await Message.deleteMessage(messageId, userId);
            if (!deleted) {
                return res.status(403).json({ status: 'error', error: 'Cannot delete this message' });
            }
            res.json({ status: 'success', message: 'Message deleted' });
        } catch (error) {
            console.error('deleteMessage Error:', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    // PATCH /api/messages/:messageId — edit message (sender only, within 15 min)
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
                return res.status(403).json({ status: 'error', error: 'Cannot edit this message (not yours, deleted, or past 15 min limit)' });
            }
            res.json({ status: 'success', message: 'Message updated' });
        } catch (error) {
            console.error('editMessage Error:', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    // POST /api/messages/:messageId/react — add emoji reaction
    async reactToMessage(req, res) {
        try {
            const { messageId } = req.params;
            const { emoji } = req.body;
            const userId = req.user.user_id || req.user.userId;

            if (!emoji) {
                return res.status(400).json({ status: 'error', error: 'Emoji is required' });
            }

            await Message.addReaction(messageId, userId, emoji);
            res.json({ status: 'success', message: 'Reaction added' });
        } catch (error) {
            console.error('reactToMessage Error:', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    // DELETE /api/messages/:messageId/react — remove emoji reaction
    async removeReaction(req, res) {
        try {
            const { messageId } = req.params;
            const userId = req.user.user_id || req.user.userId;
            await Message.removeReaction(messageId, userId);
            res.json({ status: 'success', message: 'Reaction removed' });
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    // POST /api/messages/read/:partnerId — mark all messages from partner as read
    async markRead(req, res) {
        try {
            const { partnerId } = req.params;
            const userId = req.user.user_id || req.user.userId;
            const count = await Message.markMessagesRead(partnerId, userId);
            res.json({ status: 'success', data: { marked: count } });
        } catch (error) {
            console.error('markRead Error:', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    // GET /api/messages/search?partnerId=X&q=hello — search within conversation
    async searchMessages(req, res) {
        try {
            const { partnerId, q } = req.query;
            const userId = req.user.user_id || req.user.userId;

            if (!partnerId || !q) {
                return res.status(400).json({ status: 'error', error: 'partnerId and q are required' });
            }

            const messages = await Message.searchMessages(userId, partnerId, q);
            res.json({ status: 'success', data: messages });
        } catch (error) {
            console.error('searchMessages Error:', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    // POST /api/messages/mute/:partnerId — mute/unmute a conversation
    async muteConversation(req, res) {
        try {
            const { partnerId } = req.params;
            const { muted } = req.body; // true or false
            const userId = req.user.user_id || req.user.userId;
            await Message.muteConversation(userId, partnerId, muted !== false);
            res.json({ status: 'success', message: muted !== false ? 'Conversation muted' : 'Conversation unmuted' });
        } catch (error) {
            console.error('muteConversation Error:', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }
}

module.exports = new MessageController();
