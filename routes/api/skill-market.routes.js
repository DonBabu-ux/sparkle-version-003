const express = require('express');
const router = express.Router();
const skillMarketController = require('../../controllers/skillMarket.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

// Public routes
router.get('/offers', skillMarketController.getOffers);
router.get('/offers/:id', skillMarketController.getOfferById);

// Protected routes
router.post('/offers', authMiddleware, skillMarketController.createOffer);
router.post('/offers/:id/book', authMiddleware, skillMarketController.bookSession);

module.exports = router;
