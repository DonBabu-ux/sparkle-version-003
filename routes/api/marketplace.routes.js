const path = require('path');
const express = require('express');
const router = express.Router();
const marketplaceController = require(path.join(__dirname, '..', '..', 'controllers', 'marketplace.controller'));
const { authMiddleware } = require(path.join(__dirname, '..', '..', 'middleware', 'auth.middleware'));
const { apiRateLimiter } = require(path.join(__dirname, '..', '..', 'middleware', 'security.middleware'));

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
// Lost & Found routes moved to lost-found.routes.js

// Skill Offers (protected)
// Skill Offers routes moved to skill-market.routes.js

// User listings
router.get('/user/listings', authMiddleware, (req, res) => {
    res.redirect('/my-listings');
});

// Safety Features
router.get('/safe-locations', marketplaceController.getSafeMeetupLocations);
router.post('/listings/:id/report', authMiddleware, marketplaceController.reportListing);
router.post('/users/:id/block', authMiddleware, marketplaceController.blockUser);

// Reviews
router.post('/reviews', authMiddleware, marketplaceController.createReview);
router.get('/users/:id/reviews', marketplaceController.getUserReviews);

// Listing Management
router.post('/listings/:id/boost', authMiddleware, marketplaceController.boostListing);
router.post('/listings/:id/mark-sold', authMiddleware, marketplaceController.markAsSold);
router.post('/listings/:id/relist', authMiddleware, marketplaceController.relistItem);

module.exports = router;