const express = require('express');
const router = express.Router();
const momentsController = require('../../controllers/moments.controller');
const { ejsAuthMiddleware } = require('../../middleware/auth.middleware');

router.get('/moments', ejsAuthMiddleware, momentsController.renderMoments);

module.exports = router;
