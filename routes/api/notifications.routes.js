const express = require('express');
const router = express.Router();
const notificationController = require('../../controllers/notification.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

// All notification routes require authentication
router.use(authMiddleware);

// Get user's notifications
router.get('/', notificationController.getNotifications);

// Get unread notification count
router.get('/unread-count', notificationController.getUnreadCount);

// Mark all as read
router.put('/read-all', notificationController.markAllAsRead);

// Mark specific notification as read
router.put('/:notificationId/read', notificationController.markAsRead);

module.exports = router;
