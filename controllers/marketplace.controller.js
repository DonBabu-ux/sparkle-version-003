const Marketplace = require('../models/Marketplace');
const logger = require('../utils/logger');
const crypto = require('crypto');

// Helper for media - prioritizes internal uploads, fallbacks for broken external
const getSafeMediaUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('/uploads/')) return url;
    if (url.includes('fbcdn.net') || url.includes('fbsbx.com')) {
        return 'https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=1000';
    }
    return url;
};

// ========== WEB ROUTES (Rendering) ==========
const renderMarketplace = async (req, res) => {
    try {
        const filters = {
            category: req.query.category || 'all',
            campus: req.session.campus
        };
        
        const listings = await Marketplace.searchListings(filters);
        
        // Sanitize media URLs
        const sanitizedListings = listings.map(listing => {
            const images = (listing.image_urls || []).map(url => getSafeMediaUrl(url));
            return {
                ...listing,
                image_urls: images.length > 0 ? images : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400'],
                image_url: images[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400'
            };
        });
        
        res.render('marketplace', { 
            title: 'Marketplace', 
            initialListings: sanitizedListings || [],
            user: req.user || req.session.user,
            campus: req.session.campus
        });
    } catch (error) {
        logger.error('Render Marketplace Error:', error);
        res.render('marketplace', { 
            title: 'Marketplace', 
            initialListings: [],
            user: req.user || req.session.user,
            campus: req.session.campus
        });
    }
};

const renderLostFound = async (req, res) => {
    try {
        const items = await Marketplace.getLostFoundItems();
        const sanitizedItems = items.map(i => ({ ...i, image_url: getSafeMediaUrl(i.image_url) }));
        res.render('lost-found', { title: 'Lost & Found', initialItems: sanitizedItems || [] });
    } catch (error) {
        logger.error('Render Lost & Found Error:', error);
        res.render('lost-found', { title: 'Lost & Found', initialItems: [] });
    }
};

const renderSkillMarket = async (req, res) => {
    try {
        const offers = await Marketplace.getSkillOffers();
        res.render('skill-market', { title: 'Skill Marketplace', initialOffers: offers || [] });
    } catch (error) {
        logger.error('Render Skill Market Error:', error);
        res.render('skill-market', { title: 'Skill Marketplace', initialOffers: [] });
    }
};

// ========== API ROUTES (JSON) ==========

// --- LISTINGS ---
const getListings = async (req, res) => {
    try {
        const filters = {
            category: req.query.category,
            min_price: req.query.min_price,
            max_price: req.query.max_price,
            campus: req.session.campus || req.query.campus,
            search: req.query.search,
            tags: req.query.tags ? req.query.tags.split(',') : null,
            limit: req.query.limit || 20,
            offset: req.query.offset || 0
        };
        
        const listings = await Marketplace.searchListings(filters);
        
        // Sanitize media URLs
        const sanitizedListings = listings.map(listing => {
            const images = (listing.image_urls || []).map(url => getSafeMediaUrl(url));
            return {
                ...listing,
                image_urls: images.length > 0 ? images : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400'],
                image_url: images[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400'
            };
        });
        
        res.json({ success: true, listings: sanitizedListings });
    } catch (error) {
        logger.error('API Get Listings Error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch listings' });
    }
};

const getListingById = async (req, res) => {
    try {
        const listing = await Marketplace.getListingWithMedia(req.params.id);
        
        if (!listing) {
            return res.status(404).json({ success: false, message: 'Listing not found' });
        }
        
        // Sanitize media URLs
        if (listing.media) {
            listing.media = listing.media.map(media => ({
                ...media,
                media_url: getSafeMediaUrl(media.media_url)
            }));
        }
        
        res.json({ success: true, listing });
    } catch (error) {
        logger.error('Get Listing By ID Error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch listing' });
    }
};

const createListing = async (req, res) => {
    try {
        const sellerId = req.user.user_id || req.user.userId || req.session.userId;
        
        if (!sellerId) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }
        
        const listingData = {
            title: req.body.title,
            description: req.body.description,
            price: parseFloat(req.body.price),
            category: req.body.category,
            condition: req.body.condition || 'good',
            campus: req.body.campus || req.session.campus,
            location: req.body.location,
            tags: req.body.tags ? (Array.isArray(req.body.tags) ? req.body.tags : JSON.parse(req.body.tags)) : []
        };
        
        let listingId;
        
        // Check if we have file uploads
        if (req.files && req.files.length > 0) {
            // Process uploaded files
            const mediaFiles = req.files.map((file, index) => ({
                url: `/uploads/${file.filename}`,
                type: file.mimetype.startsWith('image') ? 'image' : 'video'
            }));
            
            listingId = await Marketplace.createListingWithMedia(sellerId, listingData, mediaFiles);
        } else {
            // Fallback to original method
            listingData.image_url = req.body.image_url;
            listingId = await Marketplace.createListing(sellerId, listingData);
        }
        
        res.status(201).json({ 
            success: true, 
            message: 'Listing created successfully', 
            listing_id: listingId,
            redirect: `/marketplace/listings/${listingId}`
        });
    } catch (error) {
        logger.error('Create Listing Error:', error);
        res.status(500).json({ success: false, error: 'Failed to create listing' });
    }
};

// --- CHAT & MESSAGING ---
const contactSeller = async (req, res) => {
    try {
        const buyerId = req.user.user_id || req.user.userId || req.session.userId;
        const { sellerId, listingId } = req.body;
        
        if (!buyerId) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }
        
        if (buyerId === sellerId) {
            return res.status(400).json({ success: false, error: 'Cannot contact yourself' });
        }
        
        const chat = await Marketplace.getOrCreateChat(buyerId, sellerId, listingId);
        
        res.json({ 
            success: true, 
            chatId: chat.chat_id,
            redirect: `/messages?chat=${chat.chat_id}`
        });
    } catch (error) {
        logger.error('Contact Seller Error:', error);
        res.status(500).json({ success: false, error: 'Failed to contact seller' });
    }
};

const getUserChats = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId || req.session.userId;
        const chats = await Marketplace.getUserChats(userId);
        res.json({ success: true, chats });
    } catch (error) {
        logger.error('Get User Chats Error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch chats' });
    }
};

const getChatMessages = async (req, res) => {
    try {
        const messages = await Marketplace.getChatMessages(req.params.chatId);
        res.json({ success: true, messages });
    } catch (error) {
        logger.error('Get Chat Messages Error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch messages' });
    }
};

const sendMessage = async (req, res) => {
    try {
        const senderId = req.user.user_id || req.user.userId || req.session.userId;
        const messageId = await Marketplace.sendMessage(
            req.params.chatId,
            senderId,
            req.body.content
        );
        res.json({ success: true, messageId });
    } catch (error) {
        logger.error('Send Message Error:', error);
        res.status(500).json({ success: false, error: 'Failed to send message' });
    }
};

// --- LOST & FOUND (Keep existing) ---
const getLostFoundItems = async (req, res) => {
    try {
        const items = await Marketplace.getLostFoundItems(req.query);
        const sanitizedItems = items.map(i => ({ ...i, image_url: getSafeMediaUrl(i.image_url) }));
        res.json({ success: true, items: sanitizedItems });
    } catch (error) {
        logger.error('API Get Lost & Found Error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch items' });
    }
};

const createLostFoundItem = async (req, res) => {
    try {
        const reporterId = req.user.user_id || req.user.userId || req.session.userId;
        const itemId = await Marketplace.createLostFoundItem(reporterId, req.body);
        res.status(201).json({ success: true, message: 'Item reported successfully', item_id: itemId });
    } catch (error) {
        logger.error('Create Lost & Found Item Error:', error);
        res.status(500).json({ success: false, error: 'Failed to create item' });
    }
};

// --- SKILL OFFERS (Keep existing) ---
const getSkillOffers = async (req, res) => {
    try {
        const offers = await Marketplace.getSkillOffers(req.query);
        res.json({ success: true, offers });
    } catch (error) {
        logger.error('API Get Skill Offers Error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch skill offers' });
    }
};

const createSkillOffer = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId || req.session.userId;
        const offerId = await Marketplace.createSkillOffer(userId, req.body);
        res.status(201).json({ success: true, message: 'Skill offer created successfully', offer_id: offerId });
    } catch (error) {
        logger.error('Create Skill Offer Error:', error);
        res.status(500).json({ success: false, error: 'Failed to create skill offer' });
    }
};

// ========== HELPER FUNCTIONS ==========
const uploadMedia = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }
        
        const fileUrl = `/uploads/${req.file.filename}`;
        res.json({ 
            success: true, 
            url: fileUrl,
            type: req.file.mimetype.startsWith('image') ? 'image' : 'video'
        });
    } catch (error) {
        logger.error('Upload Media Error:', error);
        res.status(500).json({ success: false, error: 'Failed to upload file' });
    }
};

module.exports = {
    // Web Routes
    renderMarketplace,
    renderLostFound,
    renderSkillMarket,
    
    // Listing Routes
    getListings,
    getListingById,
    createListing,
    
    // Chat Routes
    contactSeller,
    getUserChats,
    getChatMessages,
    sendMessage,
    
    // Lost & Found Routes
    getLostFoundItems,
    createLostFoundItem,
    
    // Skill Routes
    getSkillOffers,
    createSkillOffer,
    
    // Utility
    uploadMedia
};
