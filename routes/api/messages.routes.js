const express = require('express');
const router = express.Router();

// Root controller has ALL standard message methods (getInbox, sendMessage, etc.)
const messageController = require('../../controllers/messages.controller');
// Backend permission-aware controller for new permission endpoints
const permissionController = require('../../backend/controllers/message.controller');
// Dedicated forward controller with full forwarding logic
const forwardController = require('../../backend/controllers/forward.controller');
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

// Per-message actions (using root controller which has full DB + pool integration)
router.delete('/:messageId', messageController.deleteMessage);
router.patch('/:messageId', messageController.editMessage);
router.post('/:messageId/react', messageController.reactToMessage);
router.post('/:messageId/pin', messageController.pinMessage);
router.post('/:messageId/unpin', messageController.unpinMessage);
router.post('/:messageId/forward', messageController.forwardMessage);

// Message permissions (used by frontend action modal)
router.get('/:messageId/permissions', permissionController.getMessagePermissions);
router.patch('/:chatId/privacy', permissionController.updatePrivacySettings);


// Conversation messages (Keep these at the end to avoid route conflicts)
router.get('/chat/:chatId', messageController.getConversationMessages);
router.get('/:chatId', messageController.getConversationMessages);

module.exports = router;
