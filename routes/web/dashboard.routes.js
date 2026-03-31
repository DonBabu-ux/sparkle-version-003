const express = require('express');
const router = express.Router();
const dashboardController = require('../../controllers/dashboard.controller');
const professionalController = require('../../controllers/professional.controller');
const { ejsAuthMiddleware } = require('../../middleware/auth.middleware');
const { upload } = require('../../middleware/upload.middleware');

// All dashboard routes require authentication
router.use(ejsAuthMiddleware);

// ============ MAIN DASHBOARD PAGE ============
router.get('/', dashboardController.renderDashboard.bind(dashboardController));
router.get('/dashboard', dashboardController.renderDashboard.bind(dashboardController));
router.get('/dashboard/professional', professionalController.renderProfessionalDashboard.bind(professionalController));

// ============ API ENDPOINTS FOR DYNAMIC UPDATES ============
router.get('/api/dashboard/stories', dashboardController.getStoriesAPI.bind(dashboardController));
router.get('/api/dashboard/feed', dashboardController.getFeedAPI.bind(dashboardController));
router.get('/api/dashboard/notifications', dashboardController.getNotificationsAPI.bind(dashboardController));

// ============ INTERACTION ENDPOINTS (Now handled by API routes) ============
// Handled by c:\Users\ADMIN\Documents\prooooojects\sparkle-version-003\routes\api\posts.routes.js

// ============ CONTENT CREATION ============
router.post('/api/posts', upload.single('media'), dashboardController.createPost.bind(dashboardController));
router.post('/api/stories', upload.single('media'), dashboardController.createStory.bind(dashboardController));

// ============ NOTIFICATIONS ============
router.put('/api/notifications/:notificationId/read', dashboardController.markNotificationRead.bind(dashboardController));
router.put('/api/notifications/read-all', dashboardController.markAllNotificationsRead.bind(dashboardController));

module.exports = router;
