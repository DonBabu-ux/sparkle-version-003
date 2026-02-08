const path = require('path');
const express = require('express');
const router = express.Router();
const momentsController = require(path.join(__dirname, '..', '..', 'controllers', 'moments.controller');
const { ejsAuthMiddleware } = require(path.join(__dirname, '..', '..', 'middleware', 'auth.middleware');

router.get('/moments', ejsAuthMiddleware, momentsController.renderMoments);

module.exports = router;

