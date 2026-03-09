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
            const { content } = req.body;
            const partnerId = req.params.partnerId || req.body.partnerId || req.body.conversationId;
            const userId = (req.user && (req.user.user_id || req.user.userId)) || null;

            if (!userId) {
                return res.status(401).json({ status: 'error', error: 'Authentication required' });
            }

            console.log(`[DEBUG] Sending message from ${userId} to ${partnerId}`);

            const messageId = await Message.sendMessage({
                recipientId: partnerId,
                senderId: userId,
                content
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
}

module.exports = new MessageController();
