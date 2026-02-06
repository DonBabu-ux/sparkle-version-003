const express = require('express');
const router = express.Router();
const marketplaceController = require('../../controllers/marketplace.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

// Main marketplace page
router.get('/marketplace', marketplaceController.renderMarketplace);

// Lost & Found page
router.get('/lost-found', marketplaceController.renderLostFound);

// Skill Marketplace page
router.get('/skill-market', marketplaceController.renderSkillMarket);

// Single listing page
router.get('/marketplace/listings/:id', marketplaceController.renderListingDetail);

// User's listings page (requires auth)
router.get('/my-listings', authMiddleware, marketplaceController.renderUserListings);

// User's marketplace chats (requires auth)
router.get('/marketplace/chats', authMiddleware, marketplaceController.renderMarketplaceChats);

module.exports = router;
