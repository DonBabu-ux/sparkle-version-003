const express = require('express');
const router = express.Router();
const confessionController = require('../../controllers/confession.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

router.get('/confessions', authMiddleware, confessionController.renderConfessions);

module.exports = router;
