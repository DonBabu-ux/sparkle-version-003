const express = require('express');
const router = express.Router();
const messageController = require('../../controllers/messages.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

router.use(authMiddleware);

// Inbox & Conversations
router.get('/inbox', messageController.getInbox);
router.get('/conversations', messageController.getInbox);
router.post('/start', messageController.startConversation);

// Search
router.get('/search', messageController.searchMessages);

// Messaging
router.post('/send', messageController.sendMessage);
router.post('/read/:chatId', messageController.markRead);
router.post('/mute/:chatId', messageController.muteConversation);

// Per-message actions
router.delete('/:messageId', messageController.deleteMessage);
router.patch('/:messageId', messageController.editMessage);
router.post('/:messageId/react', messageController.reactToMessage);

// Conversation messages (Keep these at the end)
router.get('/chat/:chatId', messageController.getConversationMessages);
router.get('/:chatId', messageController.getConversationMessages);

// Backward Compatibility Aliases
router.get('/chat/:partnerId', messageController.getConversationMessages);
router.post('/read/:partnerId', messageController.markRead);
router.post('/mute/:partnerId', messageController.muteConversation);

module.exports = router;
