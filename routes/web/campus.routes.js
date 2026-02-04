const express = require('express');
const router = express.Router();
const campusController = require('../../controllers/campus.controller');
const { ejsAuthMiddleware } = require('../../middleware/auth.middleware');

router.get('/polls', ejsAuthMiddleware, campusController.renderPolls);
router.get('/polls/:id', ejsAuthMiddleware, campusController.renderPollDetail);
router.get('/events', ejsAuthMiddleware, campusController.renderEvents);
router.get('/streams', ejsAuthMiddleware, campusController.renderStreams);

module.exports = router;
