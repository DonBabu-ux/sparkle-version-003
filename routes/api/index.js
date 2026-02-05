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
const clubsRoutes = require('./clubs.routes');

const uploadRoutes = require('./upload.routes');
const shareRoutes = require('./share.routes');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/messages', messagesRoutes);
router.use('/posts', postsRoutes);
router.use('/stories', storiesRoutes);
router.use('/moments', momentsRoutes);
router.use('/upload', uploadRoutes);
router.use('/share', shareRoutes);

// Mount feature routes directly at the root of /api to match dashboardAPI.js hardcoded paths
router.use('/', campusRoutes);
router.use('/', marketplaceRoutes);
router.use('/groups', groupsRoutes);
router.use('/confessions', confessionRoutes);
router.use('/clubs', clubsRoutes);

module.exports = router;
