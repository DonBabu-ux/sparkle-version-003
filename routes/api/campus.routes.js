const express = require('express');
const router = express.Router();
const campusController = require('../../controllers/campus.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

router.get('/polls', campusController.getPolls);
router.get('/events', campusController.getEvents);
router.post('/events', authMiddleware, campusController.createEvent);
router.post('/events/:id/rsvp', authMiddleware, campusController.rsvpEvent);
router.get('/streams', campusController.getStreams);

// Poll Routes
router.post('/polls', authMiddleware, campusController.createPoll);
router.post('/polls/:id/vote', authMiddleware, campusController.votePoll);
router.get('/polls/:id/results', campusController.getPollResults);

module.exports = router;
