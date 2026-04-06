const express = require('express');
const router = express.Router();
const groupChatController = require('../../controllers/groupChat.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { upload } = require('../../middleware/upload.middleware');

// Chat Management
router.post('/', authMiddleware, upload.single('pfp'), groupChatController.createGroupChat);
router.get('/', authMiddleware, groupChatController.getUserChats);
router.get('/:chatId', authMiddleware, groupChatController.getChatDetails);
router.put('/:chatId', authMiddleware, upload.single('pfp'), groupChatController.updateGroup);   // group name & icon

// Messages
router.get('/:chatId/messages', authMiddleware, groupChatController.getMessages);
router.post('/:chatId/messages', authMiddleware, groupChatController.sendGroupMessage);           // NEW — send to group chat

// Membership
router.post('/:chatId/members', authMiddleware, groupChatController.addMembers);
router.post('/:chatId/leave', authMiddleware, groupChatController.leaveGroupChat);         // NEW — leave group chat
router.delete('/:chatId/members/:userId', authMiddleware, groupChatController.removeMember);   // ADMIN — remove member
router.patch('/:chatId/members/:userId/role', authMiddleware, groupChatController.updateMemberRole); // ADMIN — promote/demote member

module.exports = router;
