const express = require('express');
const router = express.Router();
const marketplaceController = require('../controllers/marketplacecontroller');
const { authMiddleware } = require('../middleware/auth.middleware');
const { csrfProtection } = require('../middleware/security.middleware');

// Apply CSRF protection to all routes
router.use(csrfProtection);

// Main marketplace page (public)
router.get('/marketplace', marketplaceController.renderMarketplace);

// Single listing page (public)
router.get('/marketplace/listings/:id', marketplaceController.renderListingDetail);

// User's listings page (requires auth)
router.get('/my-listings', authMiddleware, marketplaceController.renderUserListings);

// Create listing page (requires auth)
router.get('/create-listing', authMiddleware, (req, res) => {
    res.render('marketplace/create-listing', {
        title: 'Create Listing',
        user: req.session.user,
        csrfToken: req.csrfToken()
    });
});

// Edit listing page (requires auth)
router.get('/edit-listing/:id', authMiddleware, (req, res) => {
    res.render('marketplace/edit-listing', {
        title: 'Edit Listing',
        user: req.session.user,
        listingId: req.params.id,
        csrfToken: req.csrfToken()
    });
});

module.exports = router;