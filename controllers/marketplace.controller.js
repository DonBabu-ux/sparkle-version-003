const Marketplace = require('../models/Marketplace');
const logger = require('../utils/logger');

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
        console.log('Rendering marketplace page...');
        
        // Try to get listings but don't fail if it errors
        let listings = [];
        try {
            const filters = {
                category: req.query.category || 'all',
                campus: req.session?.campus || 'main_campus'
            };
            listings = await Marketplace.getListings(filters);
        } catch (dbError) {
            console.warn('Could not load listings from DB, using empty array:', dbError.message);
            listings = [];
        }
        
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
            user: req.user || req.session?.user,
            campus: req.session?.campus || 'main_campus'
        });
    } catch (error) {
        console.error('Render Marketplace Error:', error);
        // Render page even with error
        res.render('marketplace', { 
            title: 'Marketplace', 
            initialListings: [],
            user: req.user || req.session?.user,
            campus: req.session?.campus || 'main_campus'
        });
    }
};

const renderLostFound = async (req, res) => {
    try {
        const items = await Marketplace.getLostFoundItems();
        const sanitizedItems = items.map(i => ({ ...i, image_url: getSafeMediaUrl(i.image_url) }));
        res.render('lost-found', { title: 'Lost & Found', initialItems: sanitizedItems || [] });
    } catch (error) {
        console.error('Render Lost & Found Error:', error);
        res.render('lost-found', { title: 'Lost & Found', initialItems: [] });
    }
};

const renderSkillMarket = async (req, res) => {
    try {
        const offers = await Marketplace.getSkillOffers();
        res.render('skill-market', { title: 'Skill Marketplace', initialOffers: offers || [] });
    } catch (error) {
        console.error('Render Skill Market Error:', error);
        res.render('skill-market', { title: 'Skill Marketplace', initialOffers: [] });
    }
};

// ========== API ROUTES (JSON) ==========

// Get listings with error handling
const getListings = async (req, res) => {
    try {
        console.log('GET /api/marketplace/listings called');
        
        const filters = {
            category: req.query.category || 'all',
            min_price: req.query.min_price,
            max_price: req.query.max_price,
            campus: req.session?.campus || req.query.campus || 'main_campus',
            search: req.query.search,
            tags: req.query.tags ? req.query.tags.split(',') : null,
            limit: req.query.limit || 20,
            offset: req.query.offset || 0
        };
        
        console.log('Filters:', filters);
        
        // Try to get listings
        let listings;
        try {
            // Try the new search method first
            if (typeof Marketplace.searchListings === 'function') {
                listings = await Marketplace.searchListings(filters);
            } else {
                // Fallback to old method
                listings = await Marketplace.getListings(filters);
            }
        } catch (dbError) {
            console.error('Database error in getListings:', dbError.message);
            // Return empty array instead of crashing
            listings = [];
        }
        
        // Process listings
        const processedListings = (listings || []).map(listing => {
            const images = (listing.image_urls || []).map(url => getSafeMediaUrl(url));
            return {
                ...listing,
                image_urls: images.length > 0 ? images : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400'],
                image_url: images[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400',
                seller_avatar: listing.seller_avatar || '/uploads/avatars/default.png'
            };
        });
        
        console.log(`Returning ${processedListings.length} listings`);
        
        res.json({ 
            success: true, 
            listings: processedListings,
            count: processedListings.length
        });
        
    } catch (error) {
        console.error('Unexpected error in getListings:', error);
        // Don't crash - return empty success response
        res.json({ 
            success: true, 
            listings: [],
            message: 'Service temporarily unavailable'
        });
    }
};

// Create listing with robust error handling
const createListing = async (req, res) => {
    try {
        console.log('POST /api/marketplace/listings called');
        console.log('Files:', req.files?.length || 0);
        console.log('Body keys:', Object.keys(req.body));
        
        // Get user ID from session
        const userId = req.user?.user_id || req.session?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        
        // Validate required fields
        if (!req.body.title || !req.body.description || !req.body.price) {
            return res.status(400).json({
                success: false,
                message: 'Title, description, and price are required'
            });
        }
        
        const listingData = {
            title: req.body.title,
            description: req.body.description,
            price: parseFloat(req.body.price),
            category: req.body.category || 'other',
            condition: req.body.condition || 'good',
            campus: req.body.campus || req.session?.campus || 'main_campus',
            location: req.body.location || '',
            tags: req.body.tags ? (Array.isArray(req.body.tags) ? req.body.tags : JSON.parse(req.body.tags)) : []
        };
        
        // Process uploaded files
        let mediaFiles = [];
        if (req.files && req.files.length > 0) {
            mediaFiles = req.files.map((file, index) => ({
                url: `/uploads/${file.filename}`,
                type: file.mimetype.startsWith('image') ? 'image' : 'video'
            }));
        }
        
        let listingId;
        
        // Try to create listing with media
        if (mediaFiles.length > 0 && typeof Marketplace.createListingWithMedia === 'function') {
            listingId = await Marketplace.createListingWithMedia(userId, listingData, mediaFiles);
        } else {
            // Fallback to simple listing creation
            listingData.image_url = mediaFiles[0]?.url || null;
            listingId = await Marketplace.createListing(userId, listingData);
        }
        
        res.json({ 
            success: true, 
            message: 'Listing created successfully', 
            listing_id: listingId,
            redirect: `/marketplace/listings/${listingId}`
        });
        
    } catch (error) {
        console.error('Error in createListing:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create listing',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Simple placeholder for other methods (implement these later)
const getListingById = async (req, res) => {
    res.json({ success: true, message: 'getListingById - to be implemented' });
};

const contactSeller = async (req, res) => {
    res.json({ success: true, message: 'contactSeller - to be implemented' });
};

const getUserChats = async (req, res) => {
    res.json({ success: true, message: 'getUserChats - to be implemented' });
};

const getChatMessages = async (req, res) => {
    res.json({ success: true, message: 'getChatMessages - to be implemented' });
};

const sendMessage = async (req, res) => {
    res.json({ success: true, message: 'sendMessage - to be implemented' });
};

const getLostFoundItems = async (req, res) => {
    try {
        const items = await Marketplace.getLostFoundItems(req.query);
        const sanitizedItems = items.map(i => ({ ...i, image_url: getSafeMediaUrl(i.image_url) }));
        res.json({ success: true, items: sanitizedItems });
    } catch (error) {
        console.error('Error in getLostFoundItems:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch items' });
    }
};

const createLostFoundItem = async (req, res) => {
    try {
        const reporterId = req.user.user_id || req.user.userId || req.session.userId;
        const itemId = await Marketplace.createLostFoundItem(reporterId, req.body);
        res.status(201).json({ success: true, message: 'Item reported successfully', item_id: itemId });
    } catch (error) {
        console.error('Error in createLostFoundItem:', error);
        res.status(500).json({ success: false, error: 'Failed to create item' });
    }
};

const getSkillOffers = async (req, res) => {
    try {
        const offers = await Marketplace.getSkillOffers(req.query);
        res.json({ success: true, offers });
    } catch (error) {
        console.error('Error in getSkillOffers:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch skill offers' });
    }
};

const createSkillOffer = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId || req.session.userId;
        const offerId = await Marketplace.createSkillOffer(userId, req.body);
        res.status(201).json({ success: true, message: 'Skill offer created successfully', offer_id: offerId });
    } catch (error) {
        console.error('Error in createSkillOffer:', error);
        res.status(500).json({ success: false, error: 'Failed to create skill offer' });
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
    createSkillOffer
};
