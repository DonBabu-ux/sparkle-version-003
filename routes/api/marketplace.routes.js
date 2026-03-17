const express = require('express');
const router = express.Router();
const marketplaceController = require('../../controllers/marketplace.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const upload = require('../../utils/fileUpload');

// ── Listings ─────────────────────────────────────────────────────────────────
// getListings is a plain async function
router.get('/marketplace/listings',              authMiddleware, marketplaceController.getListings);
router.get('/marketplace/listings/recommended',  authMiddleware, marketplaceController.getRecommendations);
router.get('/marketplace/listings/:id',          authMiddleware, marketplaceController.getListingById);

// createListing & updateListing are arrays [validate, handler]
router.post('/marketplace/listings',             authMiddleware, upload.array('media', 5), ...marketplaceController.createListing);
router.put('/marketplace/listings/:id',          authMiddleware, upload.array('media', 5), ...marketplaceController.updateListing);
router.delete('/marketplace/listings/:id',       authMiddleware, marketplaceController.deleteListing);

// ── Listing Actions ───────────────────────────────────────────────────────────
router.post('/marketplace/listings/:id/contact', authMiddleware, marketplaceController.contactSeller);
router.put('/marketplace/listings/:id/sold',     authMiddleware, marketplaceController.markAsSold);

// toggleFavorite is an array [validate, handler]
router.post('/marketplace/listings/:id/favorite', authMiddleware, ...marketplaceController.toggleFavorite);

// reportListing, boostListing are plain functions
router.post('/marketplace/listings/:id/report',  authMiddleware, marketplaceController.reportListing);
router.post('/marketplace/listings/:id/boost',   authMiddleware, marketplaceController.boostListing);

// toggleSellerFavorite & placeOrder are arrays [validate, handler]
router.post('/marketplace/seller/favorite',      authMiddleware, ...marketplaceController.toggleSellerFavorite);
router.post('/marketplace/order',                authMiddleware, ...marketplaceController.placeOrder);

// ── Chats ─────────────────────────────────────────────────────────────────────
router.get('/marketplace/chats',                 authMiddleware, marketplaceController.getUserChats);
router.get('/marketplace/chats/:id/messages',    authMiddleware, marketplaceController.getChatMessages);
// chatId param used differently by controller — keep :chatId alias too
router.post('/marketplace/chats/:chatId/messages', authMiddleware, marketplaceController.sendMessage);

// ── Reviews & Users ───────────────────────────────────────────────────────────
router.post('/marketplace/users/:id/block',      authMiddleware, marketplaceController.blockUser);
router.post('/marketplace/users/:id/review',     authMiddleware, marketplaceController.createReview);
router.get('/marketplace/users/:id/reviews',     authMiddleware, marketplaceController.getUserReviews);

// ── Lost & Found / Skills ─────────────────────────────────────────────────────
router.get('/marketplace/lost-found',            authMiddleware, marketplaceController.getLostFoundItems);
router.post('/marketplace/lost-found',           authMiddleware, ...marketplaceController.createLostFoundItem);
router.get('/marketplace/skills',                authMiddleware, marketplaceController.getSkillOffers);
router.post('/marketplace/skills',               authMiddleware, ...marketplaceController.createSkillOffer);

// ── Misc ──────────────────────────────────────────────────────────────────────
router.get('/marketplace/favorites',             authMiddleware, marketplaceController.getFavorites);
router.get('/marketplace/counts',                authMiddleware, marketplaceController.getCounts);
router.get('/marketplace/safe-locations',        authMiddleware, marketplaceController.getSafeMeetupLocations);

module.exports = router;