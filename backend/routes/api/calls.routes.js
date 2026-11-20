'use strict';
// routes/api/calls.routes.js

const express = require('express');
const router = express.Router();
const callsController = require('../../controllers/calls.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

router.get('/history', authMiddleware, callsController.getCallHistory);
router.get('/ice-servers', authMiddleware, callsController.getIceServers);
router.get('/:callId/offer', authMiddleware, callsController.getCallOffer);
router.post('/:callId/decline', authMiddleware, callsController.declineCall);
router.get('/settings', authMiddleware, callsController.getCallSettings);
router.put('/settings', authMiddleware, callsController.updateCallSettings);

module.exports = router;

