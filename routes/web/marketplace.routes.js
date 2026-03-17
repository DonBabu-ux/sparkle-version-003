const express = require('express');
const router = express.Router();
const marketplaceController = require('../../controllers/marketplace.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { csrfProtection } = require('../../middleware/security.middleware');

// Apply CSRF protection to all routes
router.use(csrfProtection);

// Main marketplace page (public)
router.get('/marketplace', marketplaceController.renderMarketplace);

// Single listing page (public)
router.get('/marketplace/listings/:id', marketplaceController.renderListingDetail);

// User's listings page (requires auth)
router.get('/marketplace/my-shop', authMiddleware, marketplaceController.renderUserListings);

// Create listing page (requires auth)
router.get('/marketplace/sell', authMiddleware, marketplaceController.renderSell);

// Track orders page (requires auth)
router.get('/marketplace/orders', authMiddleware, marketplaceController.renderOrders);

// Old compatibility routes
router.get('/my-listings', authMiddleware, (req, res) => res.redirect('/marketplace/my-shop'));
router.get('/create-listing', authMiddleware, (req, res) => res.redirect('/marketplace/sell'));

module.exports = router;