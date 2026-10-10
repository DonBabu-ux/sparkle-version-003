/**
 * media.routes.js
 * Sparkle Enterprise Ephemeral Media Delivery v2
 */

const express = require('express');
const router = express.Router();
const MediaController = require('../../controllers/media.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

// Upload initialization & completion
router.post('/upload-init', authMiddleware, MediaController.uploadInit);
router.post('/upload-complete', authMiddleware, MediaController.uploadComplete);

// Short-lived (5 min) signed download token
router.get('/download-token/:mediaId', authMiddleware, MediaController.getDownloadToken);

// Download ACK from recipient device
router.post('/ack-download', authMiddleware, MediaController.recordDownloadAck);

// Peer-Assisted Re-Delivery request
router.post('/request-redelivery', authMiddleware, MediaController.requestRedelivery);

module.exports = router;
