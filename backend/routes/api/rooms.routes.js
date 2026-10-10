const express = require('express');
const router = express.Router();
const roomsController = require('../../controllers/rooms.controller');
const roomChannelsController = require('../../controllers/roomChannels.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

// Room Management
router.post('/', authMiddleware, roomsController.createRoom);
router.get('/', authMiddleware, roomsController.listUserRooms);
router.get('/:roomId', authMiddleware, roomsController.getRoom);
router.put('/:roomId', authMiddleware, roomsController.updateRoom);
router.delete('/:roomId', authMiddleware, roomsController.deleteRoom);

// Membership
router.post('/:roomId/join', authMiddleware, roomsController.joinRoom);
router.post('/:roomId/leave', authMiddleware, roomsController.leaveRoom);

// Channel Management
router.get('/:roomId/channels', authMiddleware, roomChannelsController.listChannels);
router.post('/:roomId/channels', authMiddleware, roomChannelsController.createChannel);
router.patch('/:roomId/channels/:channelId', authMiddleware, roomChannelsController.updateChannel);
router.delete('/:roomId/channels/:channelId', authMiddleware, roomChannelsController.deleteChannel);

// Channel Messages
router.get('/channels/:channelId/messages', authMiddleware, roomChannelsController.getMessages);
router.post('/channels/:channelId/messages', authMiddleware, roomChannelsController.sendMessage);

module.exports = router;
