const express = require('express');
const router = express.Router();
const locationController = require('../../controllers/location.controller');
const { optionalAuthMiddleware } = require('../../middleware/auth.middleware');

// POST /api/location/resolve
// Supports both GPS and IP-based resolution
// Publicly accessible to allow guest discovery
router.post('/resolve', optionalAuthMiddleware, locationController.resolveLocation);

module.exports = router;
