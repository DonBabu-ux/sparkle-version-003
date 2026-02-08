const express = require('express');
const router = express.Router();
const marketplaceController = require('../controllers/marketplace.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const { apiRateLimiter } = require('../middleware/security.middleware');

// Apply rate limiting to all marketplace API routes
router.use(apiRateLimiter);

// Health check
router.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'Marketplace API',
        timestamp: new Date().toISOString()
    });
});

// Public endpoints (no auth required)
router.get('/listings', marketplaceController.getListings);
router.get('/listings/:id', marketplaceController.getListingById);
router.get('/lost-found', marketplaceController.getLostFoundItems);
router.get('/skill-offers', marketplaceController.getSkillOffers);

// Protected endpoints (require authentication)
router.post('/listings', authMiddleware, marketplaceController.createListing);
router.put('/listings/:listingId', authMiddleware, marketplaceController.updateListing);
router.delete('/listings/:listingId', authMiddleware, marketplaceController.deleteListing);
router.post('/contact-seller', authMiddleware, marketplaceController.contactSeller);
router.post('/favorites/toggle', authMiddleware, marketplaceController.toggleFavorite);
router.get('/favorites', authMiddleware, marketplaceController.getFavorites);
router.get('/counts', authMiddleware, marketplaceController.getCounts);

// Chat endpoints
router.get('/chats', authMiddleware, marketplaceController.getUserChats);
router.get('/chats/:chatId/messages', authMiddleware, marketplaceController.getChatMessages);
router.post('/chats/:chatId/messages', authMiddleware, marketplaceController.sendMessage);

// Lost & Found (protected)
router.post('/lost-found', authMiddleware, marketplaceController.createLostFoundItem);

// Skill Offers (protected)
router.post('/skill-offers', authMiddleware, marketplaceController.createSkillOffer);

// User listings
router.get('/user/listings', authMiddleware, (req, res) => {
    res.redirect('/my-listings');
});

module.exports = router;