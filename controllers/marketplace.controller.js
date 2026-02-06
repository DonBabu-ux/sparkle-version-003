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

// Render single listing page
const renderListingDetail = async (req, res) => {
    try {
        console.log('Rendering listing detail for ID:', req.params.id);
        
        const listingId = req.params.id;
        let listing;
        
        try {
            // Try to get listing with media
            listing = await Marketplace.getListingWithMedia(listingId);
            
            if (!listing) {
                console.log('Listing not found:', listingId);
                return res.status(404).render('404', { 
                    title: 'Listing Not Found',
                    message: 'This listing does not exist or has been removed.'
                });
            }
            
            // Increment view count (don't fail if this errors)
            try {
                await Marketplace.incrementViewCount(listingId);
            } catch (viewError) {
                console.warn('Could not increment view count:', viewError.message);
            }
            
        } catch (dbError) {
            console.error('Database error loading listing:', dbError);
            return res.status(500).render('error', {
                title: 'Error',
                message: 'Failed to load listing details from database'
            });
        }
        
        // Sanitize media URLs
        if (listing.media && Array.isArray(listing.media)) {
            listing.media = listing.media.map(media => ({
                ...media,
                media_url: getSafeMediaUrl(media.media_url)
            }));
        }
        
        res.render('marketplace/listing-detail', {
            title: listing.title || 'Listing Details',
            listing: listing,
            user: req.user || req.session?.user,
            campus: req.session?.campus || 'main_campus'
        });
        
    } catch (error) {
        console.error('Error rendering listing detail:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load listing details'
        });
    }
};

// Render user's listings
const renderUserListings = async (req, res) => {
    try {
        const userId = req.user?.user_id || req.session?.userId;
        
        if (!userId) {
            return res.redirect('/login');
        }
        
        let listings = [];
        try {
            listings = await Marketplace.getUserListings(userId);
        } catch (dbError) {
            console.warn('Could not load user listings:', dbError.message);
        }
        
        // Process listings
        const processedListings = listings.map(listing => {
            const thumbnail = listing.thumbnail_url || listing.image_url;
            return {
                ...listing,
                thumbnail_url: getSafeMediaUrl(thumbnail),
                status_display: listing.status === 'active' ? 'Active' : 
                              listing.status === 'sold' ? 'Sold' : 
                              listing.status === 'pending' ? 'Pending' : 'Unknown'
            };
        });
        
        res.render('marketplace/my-listings', {
            title: 'My Listings',
            listings: processedListings,
            user: req.user || req.session?.user,
            campus: req.session?.campus || 'main_campus'
        });
        
    } catch (error) {
        console.error('Error rendering user listings:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load your listings'
        });
    }
};

// Render marketplace chats
const renderMarketplaceChats = async (req, res) => {
    try {
        const userId = req.user?.user_id || req.session?.userId;
        
        if (!userId) {
            return res.redirect('/login');
        }
        
        let chats = [];
        try {
            chats = await Marketplace.getUserChats(userId);
        } catch (dbError) {
            console.warn('Could not load user chats:', dbError.message);
        }
        
        res.render('marketplace/chats', {
            title: 'Marketplace Chats',
            chats: chats || [],
            user: req.user || req.session?.user,
            campus: req.session?.campus || 'main_campus'
        });
        
    } catch (error) {
        console.error('Error rendering marketplace chats:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load chats'
        });
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

// Get single listing by ID
const getListingById = async (req, res) => {
    try {
        console.log('GET /api/marketplace/listings/:id called, ID:', req.params.id);
        
        const listingId = req.params.id;
        let listing;
        
        try {
            listing = await Marketplace.getListingWithMedia(listingId);
            
            if (!listing) {
                return res.status(404).json({
                    success: false,
                    message: 'Listing not found'
                });
            }
            
            // Increment view count
            try {
                await Marketplace.incrementViewCount(listingId);
            } catch (viewError) {
                console.warn('Could not increment view count:', viewError.message);
            }
            
        } catch (dbError) {
            console.error('Database error in getListingById:', dbError);
            return res.status(500).json({
                success: false,
                message: 'Database error loading listing'
            });
        }
        
        // Sanitize media URLs
        if (listing.media && Array.isArray(listing.media)) {
            listing.media = listing.media.map(media => ({
                ...media,
                media_url: getSafeMediaUrl(media.media_url)
            }));
        }
        
        res.json({
            success: true,
            listing: listing
        });
        
    } catch (error) {
        console.error('Error in getListingById:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get listing',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

// Contact seller
const contactSeller = async (req, res) => {
    try {
        console.log('POST /api/marketplace/contact-seller called');
        
        const buyerId = req.user?.user_id || req.session?.userId;
        const { sellerId, listingId } = req.body;
        
        if (!buyerId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        
        if (buyerId === sellerId) {
            return res.status(400).json({
                success: false,
                message: 'Cannot contact yourself'
            });
        }
        
        // Get or create chat
        let chat;
        try {
            chat = await Marketplace.getOrCreateChat(buyerId, sellerId, listingId);
        } catch (chatError) {
            console.error('Chat creation error:', chatError);
            return res.status(500).json({
                success: false,
                message: 'Failed to create chat'
            });
        }
        
        res.json({ 
            success: true, 
            chatId: chat.chat_id,
            redirect: `/messages?chat=${chat.chat_id}`
        });
        
    } catch (error) {
        console.error('Error in contactSeller:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to contact seller',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get user's chats
const getUserChats = async (req, res) => {
    try {
        const userId = req.user?.user_id || req.session?.userId;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        
        let chats = [];
        try {
            chats = await Marketplace.getUserChats(userId);
        } catch (dbError) {
            console.error('Database error in getUserChats:', dbError);
        }
        
        res.json({ 
            success: true, 
            chats: chats || []
        });
        
    } catch (error) {
        console.error('Error in getUserChats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch chats'
        });
    }
};

// Get chat messages
const getChatMessages = async (req, res) => {
    try {
        const userId = req.user?.user_id || req.session?.userId;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        
        let messages = [];
        try {
            messages = await Marketplace.getChatMessages(req.params.chatId);
        } catch (dbError) {
            console.error('Database error in getChatMessages:', dbError);
        }
        
        res.json({ 
            success: true, 
            messages: messages || []
        });
        
    } catch (error) {
        console.error('Error in getChatMessages:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch messages'
        });
    }
};

// Send message
const sendMessage = async (req, res) => {
    try {
        const senderId = req.user?.user_id || req.session?.userId;
        const { content } = req.body;
        const { chatId } = req.params;
        
        if (!senderId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        
        if (!content || content.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Message content is required'
            });
        }
        
        let messageId;
        try {
            messageId = await Marketplace.sendMessage(chatId, senderId, content);
        } catch (dbError) {
            console.error('Database error in sendMessage:', dbError);
            return res.status(500).json({
                success: false,
                message: 'Failed to send message'
            });
        }
        
        res.json({ 
            success: true, 
            messageId: messageId
        });
        
    } catch (error) {
        console.error('Error in sendMessage:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send message'
        });
    }
};

// Lost & Found items
const getLostFoundItems = async (req, res) => {
    try {
        let items = [];
        try {
            items = await Marketplace.getLostFoundItems(req.query);
        } catch (dbError) {
            console.error('Database error in getLostFoundItems:', dbError);
        }
        
        const sanitizedItems = items.map(i => ({ 
            ...i, 
            image_url: getSafeMediaUrl(i.image_url) 
        }));
        
        res.json({ 
            success: true, 
            items: sanitizedItems || []
        });
        
    } catch (error) {
        console.error('Error in getLostFoundItems:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch items'
        });
    }
};

const createLostFoundItem = async (req, res) => {
    try {
        const reporterId = req.user?.user_id || req.session?.userId;
        
        if (!reporterId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        
        if (!req.body.title || !req.body.description || !req.body.type) {
            return res.status(400).json({
                success: false,
                message: 'Title, description, and type are required'
            });
        }
        
        let itemId;
        try {
            itemId = await Marketplace.createLostFoundItem(reporterId, req.body);
        } catch (dbError) {
            console.error('Database error in createLostFoundItem:', dbError);
            return res.status(500).json({
                success: false,
                message: 'Failed to create item'
            });
        }
        
        res.status(201).json({ 
            success: true, 
            message: 'Item reported successfully', 
            item_id: itemId
        });
        
    } catch (error) {
        console.error('Error in createLostFoundItem:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create item'
        });
    }
};

// Skill offers
const getSkillOffers = async (req, res) => {
    try {
        let offers = [];
        try {
            offers = await Marketplace.getSkillOffers(req.query);
        } catch (dbError) {
            console.error('Database error in getSkillOffers:', dbError);
        }
        
        res.json({ 
            success: true, 
            offers: offers || []
        });
        
    } catch (error) {
        console.error('Error in getSkillOffers:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch skill offers'
        });
    }
};

const createSkillOffer = async (req, res) => {
    try {
        const userId = req.user?.user_id || req.session?.userId;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        
        if (!req.body.title || !req.body.description) {
            return res.status(400).json({
                success: false,
                message: 'Title and description are required'
            });
        }
        
        let offerId;
        try {
            offerId = await Marketplace.createSkillOffer(userId, req.body);
        } catch (dbError) {
            console.error('Database error in createSkillOffer:', dbError);
            return res.status(500).json({
                success: false,
                message: 'Failed to create skill offer'
            });
        }
        
        res.status(201).json({ 
            success: true, 
            message: 'Skill offer created successfully', 
            offer_id: offerId
        });
        
    } catch (error) {
        console.error('Error in createSkillOffer:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create skill offer'
        });
    }
};

module.exports = {
    // Web Routes
    renderMarketplace,
    renderLostFound,
    renderSkillMarket,
    renderListingDetail,
    renderUserListings,
    renderMarketplaceChats,
    
    // API Routes
    getListings,
    getListingById,
    createListing,
    contactSeller,
    getUserChats,
    getChatMessages,
    sendMessage,
    getLostFoundItems,
    createLostFoundItem,
    getSkillOffers,
    createSkillOffer
};
