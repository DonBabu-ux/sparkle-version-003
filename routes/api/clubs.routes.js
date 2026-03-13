const express = require('express');
const router = express.Router();
const clubsController = require('../../controllers/clubs.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { upload } = require('../../middleware/upload.middleware');

// Existing
router.get('/', authMiddleware, clubsController.getClubs);
router.post('/', authMiddleware, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), clubsController.createClub);
router.get('/category/:category', clubsController.getClubsByCategory);                           // NEW — category filter
router.get('/:id', authMiddleware, clubsController.getClubById);
router.put('/:id', authMiddleware, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), clubsController.updateClub);
router.get('/:id/members', authMiddleware, clubsController.getMembers);
router.get('/:id/leadership', clubsController.getLeadership);                                    // NEW — leadership team
router.post('/:id/join', authMiddleware, clubsController.joinClub);
router.post('/:id/leave', authMiddleware, clubsController.leaveClub);

// Announcements (pinned posts)
router.get('/:id/announcements', clubsController.getAnnouncements);                              // NEW
router.post('/:id/announcements', authMiddleware, clubsController.createAnnouncement);            // NEW

// Events & RSVP
router.post('/:id/events/:eventId/rsvp', authMiddleware, clubsController.rsvpEvent);             // NEW

module.exports = router;
