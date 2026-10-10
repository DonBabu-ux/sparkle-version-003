const express = require('express');
const router = express.Router();
const analyticsController = require('../../controllers/analytics.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

router.get('/creator', authMiddleware, analyticsController.getCreatorStats);

module.exports = router;
