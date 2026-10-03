

'use strict';
// routes/api/boost.routes.js

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth.middleware');
const boostController = require('../../controllers/boost.controller');

router.use(authMiddleware);

router.post('/calculate', boostController.calculateBoost);
router.post('/activate', boostController.activateBoost);
router.get('/active', boostController.getActiveBoost);
router.get('/history', boostController.getBoostHistory);
router.post('/renew', boostController.renewBoost);

module.exports = router;
