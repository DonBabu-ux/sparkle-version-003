const path = require('path');
const express = require('express');
const router = express.Router();
const clubsController = require(path.join(__dirname, '..', '..', 'controllers', 'clubs.controller');
const { ejsAuthMiddleware } = require(path.join(__dirname, '..', '..', 'middleware', 'auth.middleware');

router.get('/clubs', ejsAuthMiddleware, clubsController.renderClubs);
router.get('/clubs/:id', ejsAuthMiddleware, clubsController.renderClubDetail);

module.exports = router;

