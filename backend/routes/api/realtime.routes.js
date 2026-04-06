const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth.middleware');
const {
    getOnlineFriends,
    getUserPresence,
    getChatHistory,
    markAllAsRead
} = require('../../controllers/realtime.controller');

router.use(authMiddleware);

router.get('/online-friends', getOnlineFriends);
router.get('/presence/:userId', getUserPresence);
router.get('/chat/:chatId/history', getChatHistory);
router.post('/chat/:chatId/read-all', markAllAsRead);

module.exports = router;
