const express = require('express');
const router = express.Router();
const locationController = require('../../controllers/location.controller');
const { authMiddleware, optionalAuthMiddleware } = require('../../middleware/auth.middleware');

// Public / Optional Auth routes
router.post('/resolve', optionalAuthMiddleware, locationController.resolveLocation);
router.all('/nearby', optionalAuthMiddleware, locationController.getNearbyLocations);

// Authenticated Live Location routes
router.post('/live/start', authMiddleware, locationController.startLiveLocation);
router.post('/live/update', authMiddleware, locationController.updateLiveLocation);
router.post('/live/stop', authMiddleware, locationController.stopLiveLocation);
router.post('/live/stop/:liveLocationId', authMiddleware, locationController.stopLiveLocation);
router.get('/live/:liveLocationId', authMiddleware, locationController.getLiveLocationSession);

module.exports = router;
