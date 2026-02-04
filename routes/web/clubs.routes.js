const express = require('express');
const router = express.Router();
const clubsController = require('../../controllers/clubs.controller');
const { ejsAuthMiddleware } = require('../../middleware/auth.middleware');

router.get('/clubs', ejsAuthMiddleware, clubsController.renderClubs);
router.get('/clubs/:id', ejsAuthMiddleware, clubsController.renderClubDetail);

module.exports = router;
