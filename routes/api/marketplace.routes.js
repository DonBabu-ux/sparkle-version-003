const express = require('express');
const router = express.Router();
const marketplaceController = require('../controllers/marketplace.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const upload = require('../utils/fileUpload');

// Test route - REMOVE THIS LATER
router.get('/test', (req, res) => {
    res.json({ success: true, message: 'Marketplace API is working' });
});

// Health check
router.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'Marketplace API' });
});

// Get listings with filters
router.get('/listings', marketplaceController.getListings);

// Get single listing
router.get('/listings/:id', marketplaceController.getListingById);

// Create listing with media upload
router.post('/listings', authMiddleware, upload.array('media', 10), marketplaceController.createListing);

// Contact seller (creates/gets chat)
router.post('/contact-seller', authMiddleware, marketplaceController.contactSeller);

// Chat endpoints
router.get('/chats', authMiddleware, marketplaceController.getUserChats);
router.get('/chats/:chatId/messages', authMiddleware, marketplaceController.getChatMessages);
router.post('/chats/:chatId/messages', authMiddleware, marketplaceController.sendMessage);

// Other marketplace routes
router.get('/lost-found/items', authMiddleware, marketplaceController.getLostFoundItems);
router.get('/skills/offers', authMiddleware, marketplaceController.getSkillOffers);
router.post('/lost-found', authMiddleware, marketplaceController.createLostFound);
router.post('/skills/offers', authMiddleware, marketplaceController.createSkillOffer);

module.exports = router;
