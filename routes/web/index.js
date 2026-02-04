const express = require('express');
const router = express.Router();

const authWebRoutes = require('./auth.routes');
const feedRoutes = require('./feed.routes');
const profileRoutes = require('./profile.routes');
const momentsRoutes = require('./moments.routes');
const messagingRoutes = require('./messaging.routes');
const campusRoutes = require('./campus.routes');
const groupsRoutes = require('./groups.routes');
const clubsRoutes = require('./clubs.routes');
const marketplaceRoutes = require('./marketplace.routes');
const socialRoutes = require('./social.routes');
const confessionWebRoutes = require('./confession.routes');

router.use('/', authWebRoutes);
router.use('/', feedRoutes);
router.use('/', profileRoutes);
router.use('/', momentsRoutes);
router.use('/', messagingRoutes);
router.use('/', campusRoutes);
router.use('/', groupsRoutes);
router.use('/', clubsRoutes);
router.use('/', marketplaceRoutes);
router.use('/', socialRoutes);
router.use('/', confessionWebRoutes);

module.exports = router;
