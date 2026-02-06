const express = require('express');
const router = express.Router();
const marketplaceController = require('../controllers/marketplace.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

// ========== MARKETPLACE WEB ROUTES ==========

// Main marketplace page
router.get('/marketplace', marketplaceController.renderMarketplace);

// Lost & Found page
router.get('/lost-found', marketplaceController.renderLostFound);

// Skill Marketplace page
router.get('/skill-market', marketplaceController.renderSkillMarket);

// Single listing page
router.get('/marketplace/listings/:id', marketplaceController.renderListingDetail);

// User's listings page
router.get('/my-listings', authMiddleware, marketplaceController.renderUserListings);

// User's marketplace chats
router.get('/marketplace/chats', authMiddleware, marketplaceController.renderMarketplaceChats);

// Home page
router.get('/', (req, res) => {
    res.render('dashboard', { 
        title: 'Home',
        user: req.user || req.session?.user
    });
});

module.exports = router;
