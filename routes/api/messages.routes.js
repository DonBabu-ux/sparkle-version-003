const express = require('express');
const router = express.Router();
const messageController = require('../../controllers/messages.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

router.use(authMiddleware);

router.get('/inbox', messageController.getInbox);
router.get('/conversations', messageController.getInbox); // Frontend uses this
router.get('/:conversationId', messageController.getConversationMessages);
router.get('/chat/:partnerId', messageController.getConversationMessages); // Alternative
router.post('/send', messageController.sendMessage);
router.post('/start', messageController.startConversation);
router.post('/:partnerId', messageController.sendMessage); // Frontend uses this for sending

module.exports = router;
