const path = require('path');
const express = require('express');
const router = express.Router();
const confessionController = require(path.join(__dirname, '..', '..', 'controllers', 'confession.controller');
const { authMiddleware } = require(path.join(__dirname, '..', '..', 'middleware', 'auth.middleware');

router.get('/confessions', authMiddleware, confessionController.renderConfessions);

module.exports = router;

