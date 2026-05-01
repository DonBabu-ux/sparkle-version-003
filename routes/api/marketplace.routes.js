const express = require('express');
const router = express.Router();
const marketplaceController = require('../../controllers/marketplace.controller');
const locationController = require('../../controllers/location.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { upload, marketplaceUpload } = require('../../utils/fileUpload');
const { feedRateLimiter, mutationRateLimiter } = require('../../middleware/security.middleware');

// ── Listings ──────────────────────────────────────────────────────────────────
router.get('/marketplace/listings',              authMiddleware, feedRateLimiter, marketplaceController.getListings);
router.get('/marketplace/categories',            authMiddleware, feedRateLimiter, marketplaceController.getCategories);
router.get('/marketplace/trending',              authMiddleware, feedRateLimiter, marketplaceController.getTrending);
// User's listings page (requires auth)
router.get('/marketplace/my-shop', authMiddleware, marketplaceController.renderUserListings);
router.get('/marketplace/wishlist', authMiddleware, marketplaceController.renderWishlist);
router.get('/marketplace/orders', authMiddleware, marketplaceController.renderOrders);
router.get('/marketplace/listings/recommended',  authMiddleware, feedRateLimiter, marketplaceController.getRecommendations);
router.get('/marketplace/listings/:id',          authMiddleware, marketplaceController.getListingById);
router.post('/marketplace/listings',             authMiddleware, mutationRateLimiter, marketplaceUpload.array('media', 20), ...marketplaceController.createListing);
router.put('/marketplace/listings/:id',          authMiddleware, mutationRateLimiter, marketplaceUpload.array('media', 20), ...marketplaceController.updateListing);
router.delete('/marketplace/listings/:id',       authMiddleware, mutationRateLimiter, marketplaceController.deleteListing);

// ── Listing Actions ───────────────────────────────────────────────────────────
router.post('/marketplace/listings/:id/contact', authMiddleware, mutationRateLimiter, ...marketplaceController.contactSeller);
router.put('/marketplace/listings/:id/sold',     authMiddleware, mutationRateLimiter, marketplaceController.markAsSold);
router.post('/marketplace/listings/:id/favorite',authMiddleware, mutationRateLimiter, ...marketplaceController.toggleFavorite);
router.post('/marketplace/listings/:id/wishlist',authMiddleware, mutationRateLimiter, marketplaceController.toggleWishlist);
router.post('/marketplace/listings/:id/view',    authMiddleware, marketplaceController.recordView);
router.post('/marketplace/listings/:id/share',   authMiddleware, marketplaceController.recordShare);
router.post('/marketplace/listings/:id/report',  authMiddleware, mutationRateLimiter, marketplaceController.reportListing);
router.post('/marketplace/listings/:id/boost',   authMiddleware, mutationRateLimiter, ...marketplaceController.boostListing);
router.post('/marketplace/listings/:id/relist',  authMiddleware, mutationRateLimiter, marketplaceController.relistItem);

// ── Seller Actions ────────────────────────────────────────────────────────────
router.post('/marketplace/seller/favorite',      authMiddleware, ...marketplaceController.toggleSellerFavorite);

// ── Orders ────────────────────────────────────────────────────────────────────
router.post('/marketplace/order',                            authMiddleware, ...marketplaceController.placeOrder);
router.get('/marketplace/orders',                            authMiddleware, marketplaceController.getOrders);
router.get('/marketplace/orders/:orderId',                   authMiddleware, marketplaceController.getOrderById);
router.patch('/marketplace/orders/:orderId/status',          authMiddleware, ...marketplaceController.updateOrderStatus);
router.post('/marketplace/orders/:orderId/confirm-meetup',   authMiddleware, marketplaceController.confirmMeetup);

// ── Chats ─────────────────────────────────────────────────────────────────────
router.get('/marketplace/chats',                   authMiddleware, marketplaceController.getUserChats);
router.get('/marketplace/chats/:id/messages',      authMiddleware, marketplaceController.getChatMessages);
router.post('/marketplace/chats/:chatId/messages', authMiddleware, marketplaceController.sendMessage);

// ── Reviews & Users ───────────────────────────────────────────────────────────
router.post('/marketplace/users/:id/block',        authMiddleware, ...marketplaceController.blockUser);
router.post('/marketplace/users/:id/review',       authMiddleware, ...marketplaceController.createReview);
router.post('/marketplace/reviews',                authMiddleware, ...marketplaceController.createReview);
router.get('/marketplace/users/:id/reviews',       authMiddleware, marketplaceController.getUserReviews);

// ── Lost & Found / Skills ─────────────────────────────────────────────────────
router.get('/marketplace/lost-found',              authMiddleware, marketplaceController.getLostFoundItems);
router.post('/marketplace/lost-found',             authMiddleware, ...marketplaceController.createLostFoundItem);
router.get('/marketplace/skills',                  authMiddleware, marketplaceController.getSkillOffers);
router.post('/marketplace/skills',                 authMiddleware, ...marketplaceController.createSkillOffer);

// ── Misc ──────────────────────────────────────────────────────────────────────
router.get('/marketplace/favorites',               authMiddleware, marketplaceController.getFavorites);
router.get('/marketplace/counts',                  authMiddleware, marketplaceController.getCounts);
router.get('/marketplace/safe-locations',          authMiddleware, marketplaceController.getSafeMeetupLocations);
router.post('/location/resolve',                   authMiddleware, locationController.resolveLocation);

module.exports = router;