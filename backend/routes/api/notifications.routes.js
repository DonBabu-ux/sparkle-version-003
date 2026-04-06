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

// VAPID key
router.get('/vapid-public-key', (req, res) => res.json({ key: process.env.VAPID_PUBLIC_KEY }));

// Subscribe to push notifications
router.post('/subscribe', notificationController.subscribePush);

// Mark all as read
router.put('/read-all', notificationController.markAllAsRead);

// Mark specific notification as read (existing PUT)
router.put('/:notificationId/read', notificationController.markAsRead);

// Additional routes requested 
router.post('/clear', notificationController.clearNotifications);
router.post('/:id/read', (req, res) => {
    req.params.notificationId = req.params.id;
    return notificationController.markAsRead(req, res);
});

module.exports = router;
