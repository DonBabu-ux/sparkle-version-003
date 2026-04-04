const express = require('express');
const router = express.Router();
const campusController = require('../../controllers/campus.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

// ---- Polls ----
router.get('/polls', campusController.getPolls);                                                // Browse (supports ?campus= filter)
router.post('/polls', authMiddleware, campusController.createPoll);                             // Create poll (with duration via expires_at)
router.post('/polls/:id/vote', authMiddleware, campusController.votePoll);                      // Vote
router.get('/polls/:id/results', campusController.getPollResults);                              // View results
router.get('/polls/:id/share', campusController.sharePoll);                                     // NEW — share poll link

// ---- Events ----
router.get('/events', campusController.getEvents);                                              // Browse events
router.post('/events', authMiddleware, campusController.createEvent);                           // Create event
router.post('/events/:id/rsvp', authMiddleware, campusController.rsvpEvent);                   // RSVP
router.get('/events/:id/attendees', authMiddleware, campusController.getEventAttendees);        // NEW — view attendees
router.get('/events/:id/share', campusController.shareEvent);                                   // NEW — share event link
router.get('/events/:id/qr', authMiddleware, campusController.generateEventQR);                 // Generate QR
router.post('/events/checkin', authMiddleware, campusController.checkInEvent);                  // Check-In user

// ---- Streams (Live Text Updates) ----
router.get('/streams', campusController.getStreams);                                            // Browse live streams
router.get('/streams/active', campusController.getStreams);                                     // DashboardAPI Alias
router.post('/streams', authMiddleware, campusController.createStream);                         // NEW — create live stream
router.post('/streams/start', authMiddleware, campusController.createStream);                  // DashboardAPI Alias
router.post('/streams/:id/updates', authMiddleware, campusController.postStreamUpdate);         // NEW — post update to stream
router.post('/streams/:id/follow', authMiddleware, campusController.followStream);              // NEW — follow stream for updates
router.post('/streams/:id/join', authMiddleware, campusController.followStream);                // DashboardAPI Alias
router.post('/streams/:id/end', authMiddleware, campusController.endStream);                     // NEW

module.exports = router;
