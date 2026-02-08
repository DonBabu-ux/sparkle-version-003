const path = require('path');
const express = require('express');
const router = express.Router();
const clubsController = require(path.join(__dirname, '..', '..', 'controllers', 'clubs.controller');
const { authMiddleware } = require(path.join(__dirname, '..', '..', 'middleware', 'auth.middleware');
const { upload } = require(path.join(__dirname, '..', '..', 'middleware', 'upload.middleware');

router.get('/', authMiddleware, clubsController.getClubs);
router.post('/', authMiddleware, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), clubsController.createClub);
router.get('/:id', authMiddleware, clubsController.getClubById);
router.put('/:id', authMiddleware, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), clubsController.updateClub);
router.get('/:id/members', authMiddleware, clubsController.getMembers);
router.post('/:id/join', authMiddleware, clubsController.joinClub);
router.post('/:id/leave', authMiddleware, clubsController.leaveClub);

module.exports = router;

