const express = require('express');
const router = express.Router();

// Root controller has ALL standard message methods (getInbox, sendMessage, etc.)
const messageController = require('../../controllers/messages.controller');
// Backend permission-aware controller for new permission endpoints
const permissionController = require('../../controllers/permission.controller');

const { authMiddleware } = require('../../middleware/auth.middleware');

router.use(authMiddleware);

// Inbox & Conversations
router.get('/inbox', messageController.getInbox);
router.get('/conversations', messageController.getInbox);
router.get('/welcome-cards', messageController.getWelcomeCards);
router.post('/open', messageController.openConversation);
router.post('/start', messageController.openConversation);
router.post('/chat', messageController.openConversation);
router.get('/mutual-groups/:partnerId', messageController.getMutualGroups);

// Search
router.get('/search', messageController.searchMessages);
router.get('/chat/:chatId/search', messageController.searchMessages);

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
router.delete('/:messageId/delete-for-me', messageController.deleteMessage);
router.delete('/:messageId/delete-for-all', messageController.deleteMessageForEveryone);
router.patch('/:messageId', messageController.editMessage);
router.put('/:messageId/edit', messageController.editMessage);
router.post('/:messageId/react', messageController.reactToMessage);
router.delete('/:messageId/react', messageController.removeReaction);
router.post('/:messageId/star', messageController.starMessage);
router.delete('/:messageId/star', messageController.unstarMessage);
router.post('/:messageId/pin', messageController.pinMessage);
router.post('/:messageId/unpin', messageController.unpinMessage);
router.delete('/:messageId/pin', messageController.unpinMessage);
router.post('/:messageId/forward', messageController.forwardMessage);
router.post('/chat/:chatId/messages/:messageId/copy', messageController.copyMessage);
router.post('/chat/:chatId/messages/:messageId/forward', messageController.forwardMessage);
router.post('/:chatId/messages/:messageId/copy', messageController.copyMessage);
router.post('/:chatId/messages/:messageId/forward', messageController.forwardMessage);
router.get('/:messageId/info', messageController.getMessageInfo);
router.get('/sync/events', messageController.syncEvents);

// Message permissions (used by frontend action modal)
router.get('/:messageId/permissions', permissionController.getMessagePermissions);
router.get('/:chatId/privacy', permissionController.getPrivacySettings);
router.patch('/:chatId/privacy', permissionController.updatePrivacySettings);
router.post('/:chatId/capture-attempt', permissionController.recordCaptureAttempt);

// Chat Shared Content Explorer & Info Endpoints
router.get('/chat/:chatId/pinned', messageController.getChatPinnedMessages);
router.get('/chat/:chatId/media', messageController.getChatMedia);
router.get('/chat/:chatId/files', messageController.getChatFiles);
router.get('/chat/:chatId/links', messageController.getChatLinks);
router.get('/chat/:chatId/voice', messageController.getChatVoice);
router.get('/chat/:chatId/music', messageController.getChatMusic);
router.get('/chat/:chatId/stories', messageController.getChatStories);
router.get('/chat/:chatId/posts', messageController.getChatPosts);
router.get('/chat/:chatId/stats', messageController.getChatStats);
router.post('/chat/:chatId/nickname', messageController.setChatNickname);
router.get('/chat/:chatId/nickname-history', messageController.getChatNicknameHistory);

// Conversation messages (Keep these at the end to avoid route conflicts)
router.get('/chat/:chatId', messageController.getConversationMessages);
router.get('/:chatId', messageController.getConversationMessages);

module.exports = router;
