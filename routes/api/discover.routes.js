// routes/api/discover.routes.js
// Discover feed endpoints for the Sparkle app.

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth.middleware');
const discoverService = require('../../services/discover.service');
const logger = require('../../utils/logger');

/**
 * GET /api/discover/feed
 * Returns a weighted discover feed in a single request.
 * Query params: page (default 1), pageSize (default 20)
 */
router.get('/feed', authMiddleware, async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.user_id || null;
        const { page, pageSize } = req.query;

        const result = await discoverService.getFeed(userId, { page, pageSize });

        res.json({
            status: 'success',
            data: result
        });
    } catch (error) {
        logger.error('[Discover] Feed error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to load discover feed'
        });
    }
});

/**
 * GET /api/discover/suggested-users
 * Returns suggested users to follow (cached 60s).
 */
router.get('/suggested-users', authMiddleware, async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.user_id || null;
        const limit = Math.min(50, parseInt(req.query.limit, 10) || 10);

        const users = await discoverService.getSuggestedUsers(userId, limit);

        res.json({
            status: 'success',
            data: { users }
        });
    } catch (error) {
        logger.error('[Discover] Suggested users error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to load suggested users'
        });
    }
});

/**
 * GET /api/discover/trending-creators
 * Returns trending creators (cached 60s).
 */
router.get('/trending-creators', authMiddleware, async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.user_id || null;
        const limit = Math.min(50, parseInt(req.query.limit, 10) || 10);

        const creators = await discoverService.getTrendingCreators(userId, limit);

        res.json({
            status: 'success',
            data: { creators }
        });
    } catch (error) {
        logger.error('[Discover] Trending creators error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to load trending creators'
        });
    }
});

module.exports = router;
