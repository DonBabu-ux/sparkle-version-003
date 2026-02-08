const path = require('path');
const express = require('express');
const router = express.Router();
const campusController = require(path.join(__dirname, '..', '..', 'controllers', 'campus.controller');
const { ejsAuthMiddleware } = require(path.join(__dirname, '..', '..', 'middleware', 'auth.middleware');

router.get('/polls', ejsAuthMiddleware, campusController.renderPolls);
router.get('/polls/:id', ejsAuthMiddleware, campusController.renderPollDetail);
router.get('/events', ejsAuthMiddleware, campusController.renderEvents);
router.get('/streams', ejsAuthMiddleware, campusController.renderStreams);

module.exports = router;

