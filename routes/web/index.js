const express = require('express');
const router = express.Router();

const authWebRoutes = require('./auth.routes');
const feedRoutes = require('./feed.routes');
const profileRoutes = require('./profile.routes');
const campusWebRoutes = require('./campus.routes');
const marketplaceWebRoutes = require('./marketplace.routes');
const messagingWebRoutes = require('./messaging.routes');
const groupsWebRoutes = require('./groups.routes');
const momentsWebRoutes = require('./moments.routes');
const socialRoutes = require('./social.routes');
const confessionWebRoutes = require('./confession.routes');
const dashboardWebRoutes = require('./dashboard.routes');

router.use('/', authWebRoutes);
router.use('/', dashboardWebRoutes);
router.use('/', feedRoutes);
router.use('/', profileRoutes);
router.use('/', campusWebRoutes);
router.use('/', marketplaceWebRoutes);
router.use('/', messagingWebRoutes);
router.use('/', groupsWebRoutes);
router.use('/', momentsWebRoutes);
router.use('/', socialRoutes);
router.use('/', confessionWebRoutes);
router.use('/', require('./skill-market.routes'));
router.use('/', require('./admin.routes'));

module.exports = router;
