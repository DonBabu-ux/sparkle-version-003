const path = require('path');
const express = require('express');
const router = express.Router();
const groupChatController = require(path.join(__dirname, '..', '..', 'controllers', 'groupChat.controller');
const { authMiddleware } = require(path.join(__dirname, '..', '..', 'middleware', 'auth.middleware');
const { upload } = require(path.join(__dirname, '..', '..', 'middleware', 'upload.middleware');

// Chat Management
router.post('/', authMiddleware, upload.single('pfp'), groupChatController.createGroupChat);
router.get('/', authMiddleware, groupChatController.getUserChats);
router.get('/:chatId', authMiddleware, groupChatController.getChatDetails);

// Messages
router.get('/:chatId/messages', authMiddleware, groupChatController.getMessages);

// Membership
router.post('/:chatId/members', authMiddleware, groupChatController.addMembers);

// Group Update
router.put('/:chatId', authMiddleware, upload.single('pfp'), groupChatController.updateGroup);

// TODO: Add other routes as needed (leave, settings, etc.) based on future requirements

module.exports = router;

