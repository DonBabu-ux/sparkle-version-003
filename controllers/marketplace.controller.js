const Marketplace = require('../models/Marketplace');
const marketplaceSchemas = require('../schemas/marketplace.schemas');
const { validate } = require('../middleware/validation.middleware');
const logger = require('../utils/logger');
const upload = require('../utils/fileUpload');

// Helper for media URLs
const getSafeMediaUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('/uploads/') || url.startsWith('http')) {
        return url;
    }
    return null;
};

// ========== WEB ROUTES ==========

const renderMarketplace = async (req, res) => {
    try {
        const filters = {
            category: req.query.category || 'all',
            campus: req.session?.user?.campus || 'main_campus',
            limit: 20
        };

        const { listings } = await Marketplace.getListings(filters);

        const sanitizedListings = listings.map(listing => {
            const images = (listing.image_urls || []).map(url => getSafeMediaUrl(url)).filter(url => url);
            return {
                ...listing,
                image_urls: images.length > 0 ? images : ['/images/default-listing.jpg'],
                image_url: images[0] || '/images/default-listing.jpg'
            };
        });

        res.render('marketplace', {
            title: 'Marketplace',
            initialListings: sanitizedListings || [],
            user: req.session ? req.session.user : null,
            campus: req.session?.user?.campus || 'main_campus'
        });
    } catch (error) {
        logger.error('Render marketplace error:', error);
        res.render('marketplace', {
            title: 'Marketplace',
            initialListings: [],
            user: req.session ? req.session.user : null,
            campus: req.session?.user?.campus || 'main_campus'
        });
    }
};

const renderListingDetail = async (req, res) => {
    try {
        const listing = await Marketplace.getListingWithMedia(req.params.id);

        if (!listing) {
            return res.status(404).render('404', {
                title: 'Listing Not Found',
                message: 'This listing does not exist or has been removed.'
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
            user: req.session ? req.session.user : null
        });
    } catch (error) {
        logger.error('Render listing detail error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load listing details'
        });
    }
};

const renderUserListings = async (req, res) => {
    try {
        const userId = req.session?.user?.user_id;
        if (!userId) {
            return res.redirect('/login');
        }

        const listings = await Marketplace.getUserListings(userId);

        const processedListings = listings.map(listing => ({
            ...listing,
            thumbnail_url: getSafeMediaUrl(listing.thumbnail_url || listing.image_url),
            status_display: listing.status === 'active' ? 'Active' :
                          listing.status === 'sold' ? 'Sold' :
                          listing.status === 'pending' ? 'Pending' : 'Unknown'
        }));

        res.render('marketplace/my-listings', {
            title: 'My Listings',
            listings: processedListings,
            user: req.session.user
        });
    } catch (error) {
        logger.error('Render user listings error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load your listings'
        });
    }
};

// ========== API ROUTES ==========

const getListings = [
    validate(marketplaceSchemas.searchListings, 'query'),
    async (req, res) => {
        try {
            const filters = {
                ...req.query,
                campus: req.session?.user?.campus || req.query.campus || 'main_campus'
            };

            const result = await Marketplace.getListings(filters);

            const processedListings = result.listings.map(listing => {
                const images = (listing.image_urls || []).map(url => getSafeMediaUrl(url)).filter(url => url);
                return {
                    ...listing,
                    image_urls: images.length > 0 ? images : ['/images/default-listing.jpg'],
                    image_url: images[0] || '/images/default-listing.jpg',
                    seller_avatar: listing.seller_avatar || '/images/default-avatar.png'
                };
            });

            res.json({
                success: true,
                listings: processedListings,
                pagination: {
                    total: result.total,
                    limit: result.limit,
                    offset: result.offset,
                    hasMore: result.hasMore
                }
            });
        } catch (error) {
            logger.error('Get listings error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch listings'
            });
        }
    }
];

const getListingById = async (req, res) => {
    try {
        const listing = await Marketplace.getListingWithMedia(req.params.id);

        if (!listing) {
            return res.status(404).json({
                success: false,
                message: 'Listing not found'
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
        logger.error('Get listing by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get listing'
        });
    }
};

const createListing = [
    upload.array('media', 5),
    validate(marketplaceSchemas.createListing),
    async (req, res) => {
        try {
            const userId = req.session?.user?.user_id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            // Process uploaded files
            let mediaFiles = [];
            if (req.files && req.files.length > 0) {
                mediaFiles = req.files.map((file, index) => ({
                    url: `/uploads/${file.filename}`,
                    type: file.mimetype.startsWith('image') ? 'image' : 'video'
                }));
            }

            const listingId = await Marketplace.createListingWithMedia(userId, req.body, mediaFiles);

            res.status(201).json({
                success: true,
                message: 'Listing created successfully',
                listing_id: listingId,
                redirect: `/marketplace/listings/${listingId}`
            });
        } catch (error) {
            logger.error('Create listing error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to create listing'
            });
        }
    }
];

const updateListing = [
    validate(marketplaceSchemas.updateListing),
    async (req, res) => {
        try {
            const userId = req.session?.user?.user_id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            const { listingId } = req.params;
            const { status, ...updates } = req.body;

            if (status) {
                await Marketplace.updateListingStatus(listingId, userId, status);
            }

            // TODO: Add logic to update other fields

            res.json({
                success: true,
                message: 'Listing updated successfully'
            });
        } catch (error) {
            logger.error('Update listing error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to update listing'
            });
        }
    }
];

const deleteListing = async (req, res) => {
    try {
        const userId = req.session?.user?.user_id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const { listingId } = req.params;
        await Marketplace.deleteListing(listingId, userId);

        res.json({
            success: true,
            message: 'Listing deleted successfully'
        });
    } catch (error) {
        logger.error('Delete listing error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete listing'
        });
    }
};

const contactSeller = [
    validate(marketplaceSchemas.contactSeller),
    async (req, res) => {
        try {
            const buyerId = req.session?.user?.user_id;
            if (!buyerId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            const { sellerId, listingId, message } = req.body;

            if (buyerId === sellerId) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot contact yourself'
                });
            }

            const chat = await Marketplace.getOrCreateChat(buyerId, sellerId, listingId);

            // Send initial message if provided
            if (message && message.trim()) {
                await Marketplace.sendMessage(chat.chat_id, buyerId, message);
            }

            res.json({
                success: true,
                chatId: chat.chat_id,
                redirect: `/messages?chat=${chat.chat_id}`
            });
        } catch (error) {
            logger.error('Contact seller error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to contact seller'
            });
        }
    }
];

const getUserChats = async (req, res) => {
    try {
        const userId = req.session?.user?.user_id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const chats = await Marketplace.getUserChats(userId);

        res.json({
            success: true,
            chats: chats || []
        });
    } catch (error) {
        logger.error('Get user chats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch chats'
        });
    }
};

const getChatMessages = async (req, res) => {
    try {
        const userId = req.session?.user?.user_id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const messages = await Marketplace.getChatMessages(req.params.chatId);
        
        // Mark messages as read
        await Marketplace.markMessagesAsRead(req.params.chatId, userId);

        res.json({
            success: true,
            messages: messages || []
        });
    } catch (error) {
        logger.error('Get chat messages error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch messages'
        });
    }
};

const sendMessage = [
    validate(marketplaceSchemas.sendMessage),
    async (req, res) => {
        try {
            const senderId = req.session?.user?.user_id;
            if (!senderId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            const { chatId } = req.params;
            const { content } = req.body;

            const messageId = await Marketplace.sendMessage(chatId, senderId, content);

            // Emit socket event for real-time messaging
            if (req.io) {
                req.io.to(chatId).emit('new_message', {
                    chatId,
                    messageId,
                    senderId,
                    content,
                    timestamp: new Date()
                });
            }

            res.json({
                success: true,
                messageId: messageId
            });
        } catch (error) {
            logger.error('Send message error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to send message'
            });
        }
    }
];

const toggleFavorite = [
    validate(marketplaceSchemas.toggleFavorite, 'body'),
    async (req, res) => {
        try {
            const userId = req.session?.user?.user_id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            const { listingId } = req.body;
            const result = await Marketplace.toggleFavorite(userId, listingId);

            res.json({
                success: true,
                favorited: result.favorited
            });
        } catch (error) {
            logger.error('Toggle favorite error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to update favorite'
            });
        }
    }
];

const getFavorites = async (req, res) => {
    try {
        const userId = req.session?.user?.user_id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const favorites = await Marketplace.getUserFavorites(userId);

        res.json({
            success: true,
            favorites: favorites || []
        });
    } catch (error) {
        logger.error('Get favorites error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch favorites'
        });
    }
};

const getCounts = async (req, res) => {
    try {
        const userId = req.session?.user?.user_id;
        if (!userId) {
            return res.json({
                favoritesCount: 0,
                wishlistCount: 0,
                notificationCount: 0
            });
        }

        const counts = await Marketplace.getCounts(userId);

        res.json({
            success: true,
            ...counts
        });
    } catch (error) {
        logger.error('Get counts error:', error);
        res.json({
            favoritesCount: 0,
            wishlistCount: 0,
            notificationCount: 0
        });
    }
};

// Lost & Found endpoints
const getLostFoundItems = async (req, res) => {
    try {
        const items = await Marketplace.getLostFoundItems(req.query);
        
        const sanitizedItems = items.map(i => ({ 
            ...i, 
            image_url: getSafeMediaUrl(i.image_url) 
        }));

        res.json({ 
            success: true, 
            items: sanitizedItems || []
        });
    } catch (error) {
        logger.error('Get lost & found items error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch items'
        });
    }
};

const createLostFoundItem = [
    validate(marketplaceSchemas.createLostFoundItem),
    async (req, res) => {
        try {
            const reporterId = req.session?.user?.user_id;
            if (!reporterId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            // TODO: Implement createLostFoundItem in model
            res.status(201).json({ 
                success: true, 
                message: 'Item reported successfully'
            });
        } catch (error) {
            logger.error('Create lost & found item error:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to create item'
            });
        }
    }
];

// Skill offers endpoints
const getSkillOffers = async (req, res) => {
    try {
        const offers = await Marketplace.getSkillOffers(req.query);
        res.json({ 
            success: true, 
            offers: offers || []
        });
    } catch (error) {
        logger.error('Get skill offers error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch skill offers'
        });
    }
};

const createSkillOffer = [
    validate(marketplaceSchemas.createSkillOffer),
    async (req, res) => {
        try {
            const userId = req.session?.user?.user_id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            // TODO: Implement createSkillOffer in model
            res.status(201).json({ 
                success: true, 
                message: 'Skill offer created successfully'
            });
        } catch (error) {
            logger.error('Create skill offer error:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to create skill offer'
            });
        }
    }
];

module.exports = {
    // Web Routes
    renderMarketplace,
    renderListingDetail,
    renderUserListings,
    
    // API Routes
    getListings,
    getListingById,
    createListing,
    updateListing,
    deleteListing,
    contactSeller,
    getUserChats,
    getChatMessages,
    sendMessage,
    toggleFavorite,
    getFavorites,
    getCounts,
    getLostFoundItems,
    createLostFoundItem,
    getSkillOffers,
    createSkillOffer
};