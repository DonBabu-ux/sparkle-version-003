const express = require('express');
const router = express.Router();
const messageController = require('../../controllers/messages.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

router.use(authMiddleware);

// Existing
router.get('/inbox', messageController.getInbox);
router.get('/conversations', messageController.getInbox);       // Frontend alias
router.get('/chat/:partnerId', messageController.getConversationMessages);
router.post('/send', messageController.sendMessage);
router.post('/start', messageController.startConversation);
router.post('/:partnerId', messageController.sendMessage);      // Frontend send alias

// Read receipts
router.post('/read/:partnerId', messageController.markRead);

// Mute / unmute
router.post('/mute/:partnerId', messageController.muteConversation);

// Search
router.get('/search', messageController.searchMessages);

// Per-message actions (must come AFTER named routes to avoid conflicts)
router.delete('/:messageId', messageController.deleteMessage);
router.patch('/:messageId', messageController.editMessage);
router.post('/:messageId/react', messageController.reactToMessage);
router.delete('/:messageId/react', messageController.removeReaction);

// Conversation messages (keep last to avoid swallowing other GET routes)
router.get('/:conversationId', messageController.getConversationMessages);

module.exports = router;
