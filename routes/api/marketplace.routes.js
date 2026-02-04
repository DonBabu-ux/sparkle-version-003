const express = require('express');
const router = express.Router();
const marketplaceController = require('../../controllers/marketplace.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

router.get('/listings', authMiddleware, marketplaceController.getListings);
router.get('/lost-found/items', authMiddleware, marketplaceController.getLostFoundItems);
router.get('/skills/offers', authMiddleware, marketplaceController.getSkillOffers);

module.exports = router;
