const express = require('express');
const router = express.Router();
const marketplaceController = require('../../controllers/marketplace.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const upload = require('../../utils/fileUpload');

// Base path in index.js might be `/` or `/marketplace`.
// In index.js we saw `router.use('/', marketplaceRoutes);`
// Which means these routes might need to be prefixed with `/marketplace` or it relies on the root. Wait, index.js has `router.use('/', marketplaceRoutes);` and `router.use('/marketplace', marketplaceRoutes)`? No, it just has `router.use('/', marketplaceRoutes);`.
// But wait, actually, if it's mounted at `/`, then the route here should be `/marketplace`. Let's check other routers.

router.get('/marketplace/listings', authMiddleware, ...marketplaceController.getListings);
router.get('/marketplace/listings/:id', authMiddleware, marketplaceController.getListingById);
router.post('/marketplace/listings', authMiddleware, upload.array('media', 5), marketplaceController.createListing);
router.put('/marketplace/listings/:id', authMiddleware, upload.array('media', 5), marketplaceController.updateListing);
router.delete('/marketplace/listings/:id', authMiddleware, marketplaceController.deleteListing);

// Actions
router.post('/marketplace/listings/:id/contact', authMiddleware, marketplaceController.contactSeller);
router.put('/marketplace/listings/:id/sold', authMiddleware, marketplaceController.markAsSold);
router.post('/marketplace/listings/:id/favorite', authMiddleware, marketplaceController.toggleFavorite);
router.post('/marketplace/listings/:id/report', authMiddleware, marketplaceController.reportListing);
router.post('/marketplace/listings/:id/boost', authMiddleware, marketplaceController.boostListing);

// Chats
router.get('/marketplace/chats', authMiddleware, marketplaceController.getUserChats);
router.get('/marketplace/chats/:id/messages', authMiddleware, marketplaceController.getChatMessages);
router.post('/marketplace/chats/:id/messages', authMiddleware, marketplaceController.sendMessage);

// Reviews & Users
router.post('/marketplace/users/:id/block', authMiddleware, marketplaceController.blockUser);
router.post('/marketplace/users/:id/review', authMiddleware, marketplaceController.createReview);
router.get('/marketplace/users/:id/reviews', authMiddleware, marketplaceController.getUserReviews);

// Misc
router.get('/marketplace/favorites', authMiddleware, marketplaceController.getFavorites);
router.get('/marketplace/counts', authMiddleware, marketplaceController.getCounts);
router.get('/marketplace/unread-chats', authMiddleware, marketplaceController.getUserChats); // Using getUserChats as a placeholder if separate unread count isn't implemented
router.get('/marketplace/safe-locations', authMiddleware, marketplaceController.getSafeMeetupLocations);

module.exports = router;