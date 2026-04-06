const express = require('express');
const router = express.Router();
const messageController = require('../../controllers/messages.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

router.use(authMiddleware);

// Inbox & Conversations
router.get('/inbox', messageController.getInbox);
router.get('/conversations', messageController.getInbox);
router.post('/start', messageController.startConversation);
router.get('/mutual-groups/:partnerId', messageController.getMutualGroups);

// Search
router.get('/search', messageController.searchMessages);

// Messaging/Chat Actions
router.post('/send', messageController.sendMessage);
router.post('/', messageController.sendMessage); // DashboardAPI Alias
router.post('/read/:chatId', messageController.markRead);
router.post('/mute/:chatId', messageController.muteConversation);
router.post('/chat/:chatId/archive', messageController.archiveConversation);
router.post('/chat/:chatId/mute', messageController.muteConversation);
router.delete('/chat/:chatId', messageController.deleteConversation);

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
