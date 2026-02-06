const express = require('express');
const router = express.Router();

const authWebRoutes = require('./auth.routes');
const feedRoutes = require('./feed.routes');
const profileRoutes = require('./profile.routes');
const campusWebRoutes = require('./campus.routes');
const marketplaceWebRoutes = require('./marketplace.routes');
const messagingWebRoutes = require('./messaging.routes');
const clubsWebRoutes = require('./clubs.routes');
const groupsWebRoutes = require('./groups.routes');
const momentsWebRoutes = require('./moments.routes');
const socialRoutes = require('./social.routes');
const confessionWebRoutes = require('./confession.routes');

router.use('/', authWebRoutes);
router.use('/', feedRoutes);
router.use('/', profileRoutes);
router.use('/', campusWebRoutes);
router.use('/', marketplaceWebRoutes);
router.use('/', messagingWebRoutes);
router.use('/', clubsWebRoutes);
router.use('/', groupsWebRoutes);
router.use('/', momentsWebRoutes);
router.use('/s', socialRoutes);
router.use('/', confessionWebRoutes);

module.exports = router;
