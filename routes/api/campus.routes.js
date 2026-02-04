const express = require('express');
const router = express.Router();
const campusController = require('../../controllers/campus.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

router.get('/polls', authMiddleware, campusController.getPolls);
router.get('/events', authMiddleware, campusController.getEvents);
router.get('/streams/active', authMiddleware, campusController.getStreams);

module.exports = router;
