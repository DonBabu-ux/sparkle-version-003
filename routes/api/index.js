const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');

const userRoutes = require('./user.routes');
const messagesRoutes = require('./messages.routes');
const postsRoutes = require('./posts.routes');
const storiesRoutes = require('./stories.routes');
const momentsRoutes = require('./moments.routes');
const campusRoutes = require('./campus.routes');
const groupsRoutes = require('./groups.routes');
const marketplaceRoutes = require('./marketplace.routes');
const confessionRoutes = require('./confession.routes');
const skillMarketRoutes = require('./skill-market.routes');
const highlightsRoutes = require('./highlights.routes');

const uploadRoutes = require('./upload.routes');
const shareRoutes = require('./share.routes');
const groupChatRoutes = require('./groupChat.routes');
const notificationsRoutes = require('./notifications.routes');
const linkPreviewRoutes = require('./link-preview.routes');

const pool = require('../../config/database');

const { csrfProtection } = require('../../middleware/security.middleware');

router.use('/auth', authRoutes);

// CSRF Token Provider for SPAs
router.get('/csrf-token', csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

// Health Check Endpoint
router.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'success', database: 'connected', timestamp: new Date() });
    } catch (error) {
        res.status(503).json({ status: 'error', database: 'disconnected', error: error.message });
    }
});
router.use('/users', userRoutes);
router.use('/messages', messagesRoutes);
router.use('/groupChat', groupChatRoutes);
router.use('/posts', postsRoutes);
router.use('/stories', storiesRoutes);
router.use('/moments', momentsRoutes);
router.use('/upload', uploadRoutes);
router.use('/share', shareRoutes);
router.use('/notifications', notificationsRoutes);

// Direct comment access for DashboardAPI compatibility
const postController = require('../../controllers/post.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
router.post('/comments/:id/like', authMiddleware, postController.likeComment);

// Mount feature routes directly at the root of /api to match dashboardAPI.js hardcoded paths
router.use('/', campusRoutes);
router.use('/', marketplaceRoutes);
router.use('/marketplace', require('./marketplaceChatRoutes'));
router.use('/groups', groupsRoutes);
router.use('/confessions', confessionRoutes);
router.use('/skill-market', skillMarketRoutes);
router.use('/search', require('./search.routes'));
router.use('/realtime', require('./realtime.routes'));
router.use('/support', require('./support.routes'));
router.use('/link-preview', linkPreviewRoutes);
router.use('/clubs', require('./clubs.routes'));
router.use('/lost-found', require('./lost-found.routes'));
router.use('/analytics', require('./analytics.routes'));
router.use('/highlights', highlightsRoutes);
router.use('/stickers', require('./stickers.routes'));
router.use('/audio', require('./audio.routes'));
router.use('/moderation', require('./moderation.routes'));

module.exports = router;
