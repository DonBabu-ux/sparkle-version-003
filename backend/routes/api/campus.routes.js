const express = require('express');
const router = express.Router();
const campusController = require('../../controllers/campus.controller');
const { authMiddleware, optionalAuthMiddleware } = require('../../middleware/auth.middleware');

// ---- Polls ----
router.get('/polls', optionalAuthMiddleware, campusController.getPolls);                                                // Browse (supports ?campus= filter)
router.post('/polls', authMiddleware, campusController.createPoll);                             // Create poll (with duration via expires_at)
router.post('/polls/:id/vote', authMiddleware, campusController.votePoll);                      // Vote
router.get('/polls/:id/results', optionalAuthMiddleware, campusController.getPollResults);                              // View results
router.post('/polls/:id/invite', authMiddleware, campusController.inviteToPoll);                    // NEW - Invite others
router.get('/polls/:id/share', campusController.sharePoll);                                     // NEW — share poll link
router.post('/polls/:id/predict', authMiddleware, campusController.predictPollWinner);              // NEW — predict winner
router.post('/polls/:id/interaction', authMiddleware, campusController.trackPollInteraction);      // NEW — track skips/shares

// ---- Events ----
router.get('/events', campusController.getEvents);                                              // Browse events
router.post('/events', authMiddleware, campusController.createEvent);                           // Create event
router.post('/events/:id/rsvp', authMiddleware, campusController.rsvpEvent);                   // RSVP
router.get('/events/:id/attendees', authMiddleware, campusController.getEventAttendees);        // NEW — view attendees
router.get('/events/:id/share', campusController.shareEvent);                                   // NEW — share event link
router.get('/events/:id/qr', authMiddleware, campusController.generateEventQR);                 // Generate QR
router.post('/events/checkin', authMiddleware, campusController.checkInEvent);                  // Check-In user
router.delete('/events/:id', authMiddleware, campusController.deleteEvent);                    // Admin/Creator Delete
router.patch('/events/:id/status', authMiddleware, campusController.updateEventStatus);         // Admin/Creator Update Status
router.post('/events/rsvp/approve', authMiddleware, campusController.approveRSVP);              // Admin/Creator Approve/Reject
router.patch('/events/:id', authMiddleware, campusController.updateEvent);                      // NEW - Edit event
router.get('/events/:id/analytics', authMiddleware, campusController.getEventAnalytics);        // NEW - View stats
router.post('/events/:id/notify', authMiddleware, campusController.notifyAttendees);           // NEW - Send announcement

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
