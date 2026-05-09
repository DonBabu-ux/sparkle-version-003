const express = require('express');
const router = express.Router();
const skillMarketController = require('../../controllers/skillMarket.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

// Public routes
router.get('/offers', skillMarketController.getOffers);                                         // Browse + filter by category (?category=tutoring)
router.get('/offers/:id', skillMarketController.getOfferById);                                  // View single offer
router.get('/offers/:id/reviews', skillMarketController.getOfferReviews);                       // View reviews for an offer

// Protected routes
router.post('/offers', authMiddleware, skillMarketController.createOffer);                       // Create offer
router.put('/offers/:id', authMiddleware, skillMarketController.updateOffer);                    // NEW — edit offer
router.delete('/offers/:id', authMiddleware, skillMarketController.deleteOffer);                 // NEW — delete offer
router.post('/offers/:id/book', authMiddleware, skillMarketController.bookSession);              // Book session / contact provider
router.get('/bookings/client', authMiddleware, skillMarketController.getClientBookings);             // Get my requests
router.get('/bookings/provider', authMiddleware, skillMarketController.getProviderBookings);         // Get requests for my skills
router.post('/bookings/:id/status', authMiddleware, skillMarketController.updateBookingStatus);      // Accept/decline booking
router.post('/bookings/:id/rate', authMiddleware, skillMarketController.rateExchange);               // Rate exchange after session

module.exports = router;
