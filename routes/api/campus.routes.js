const path = require('path');
const express = require('express');
const router = express.Router();
const campusController = require(path.join(__dirname, '..', '..', 'controllers', 'campus.controller');
const { authMiddleware } = require(path.join(__dirname, '..', '..', 'middleware', 'auth.middleware');

router.get('/polls', authMiddleware, campusController.getPolls);
router.get('/events', authMiddleware, campusController.getEvents);
router.get('/streams/active', authMiddleware, campusController.getStreams);

module.exports = router;

