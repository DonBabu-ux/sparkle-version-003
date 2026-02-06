const express = require('express');
const router = express.Router();
const marketplaceController = require('../../controllers/marketplace.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const upload = require('../../utils/fileUpload');

// Health check
router.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'Marketplace API' });
});

// Get listings with filters (NO auth required to view listings)
router.get('/listings', marketplaceController.getListings);

// Get single listing
router.get('/listings/:id', marketplaceController.getListingById);

// Create listing with media upload (REQUIRES auth)
router.post('/listings', authMiddleware, upload.array('media', 10), marketplaceController.createListing);

// Contact seller (creates/gets chat) - REQUIRES auth
router.post('/contact-seller', authMiddleware, marketplaceController.contactSeller);

// Chat endpoints - REQUIRES auth
router.get('/chats', authMiddleware, marketplaceController.getUserChats);
router.get('/chats/:chatId/messages', authMiddleware, marketplaceController.getChatMessages);
router.post('/chats/:chatId/messages', authMiddleware, marketplaceController.sendMessage);

// Lost & Found endpoints
router.get('/lost-found/items', authMiddleware, marketplaceController.getLostFoundItems);
router.post('/lost-found', authMiddleware, marketplaceController.createLostFoundItem);

// Skill offers endpoints
router.get('/skills/offers', authMiddleware, marketplaceController.getSkillOffers);
router.post('/skills/offers', authMiddleware, marketplaceController.createSkillOffer);

// Test route - remove in production
router.get('/test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Marketplace API is working',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
