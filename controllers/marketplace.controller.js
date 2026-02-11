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

// Simple normalizeUser - just ensures avatar_url exists without changing structure
const normalizeUser = (user) => {
    if (!user) return null;

    // Clone the user object to avoid mutations
    const normalized = { ...user };

    // Ensure avatar_url exists
    if (!normalized.avatar_url) {
        normalized.avatar_url = '/uploads/avatars/default.png';
    }

    // Ensure user_id exists (some controllers might use id)
    if (!normalized.user_id && normalized.id) {
        normalized.user_id = normalized.id;
    }

    // Ensure campus exists
    if (!normalized.campus) {
        normalized.campus = 'main_campus';
    }

    // Ensure name exists
    if (!normalized.name && normalized.username) {
        normalized.name = normalized.username;
    } else if (!normalized.name && normalized.email) {
        normalized.name = normalized.email.split('@')[0];
    } else if (!normalized.name) {
        normalized.name = 'User';
    }

    return normalized;
};

// ========== WEB ROUTES ==========

const renderMarketplace = async (req, res) => {
    try {
        // Get user with safe defaults
        const user = req.session?.user ? normalizeUser(req.session.user) : null;

        const filters = {
            category: req.query.category || 'all',
            campus: user?.campus || req.query.campus || 'main_campus',
            limit: 20
        };

        const { listings } = await Marketplace.getListings(filters);

        const sanitizedListings = listings.map(listing => {
            const images = (listing.image_urls || []).map(url => getSafeMediaUrl(url)).filter(url => url);
            // Simple date formatting for SSR
            const date = new Date(listing.created_at);
            const now = new Date();
            const diffMs = now - date;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            let dateDisplay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (diffDays === 0) dateDisplay = 'Today';
            else if (diffDays === 1) dateDisplay = 'Yesterday';
            else if (diffDays < 7) dateDisplay = `${diffDays} days ago`;

            return {
                ...listing,
                image_urls: images.length > 0 ? images : ['/images/default-listing.jpg'],
                image_url: images[0] || '/images/default-listing.jpg',
                date_display: dateDisplay
            };
        });

        res.render('marketplace', {
            title: 'Marketplace',
            initialListings: sanitizedListings || [],
            user: user,
            campus: user?.campus || 'main_campus'
        });
    } catch (error) {
        logger.error('Render marketplace error:', error);

        // Get user with safe defaults
        const user = req.session?.user ? normalizeUser(req.session.user) : null;

        res.render('marketplace', {
            title: 'Marketplace',
            initialListings: [],
            user: user,
            campus: user?.campus || 'main_campus'
        });
    }
};

const renderListingDetail = async (req, res) => {
    try {
        // Get user with safe defaults
        const user = req.session?.user ? normalizeUser(req.session.user) : null;

        const listing = await Marketplace.getListingWithMedia(req.params.id);

        if (!listing) {
            return res.status(404).render('404', {
                title: 'Listing Not Found',
                message: 'This listing does not exist or has been removed.',
                user: user
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
            user: user
        });
    } catch (error) {
        logger.error('Render listing detail error:', error);

        // Get user with safe defaults
        const user = req.session?.user ? normalizeUser(req.session.user) : null;

        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load listing details',
            user: user
        });
    }
};

const renderUserListings = async (req, res) => {
    try {
        const user = normalizeUser(req.session?.user);

        if (!user || !user.user_id) {
            return res.redirect('/login');
        }

        const listings = await Marketplace.getUserListings(user.user_id);

        const processedListings = listings.map(listing => ({
            ...listing,
            thumbnail_url: getSafeMediaUrl(listing.thumbnail_url || listing.image_url),
            status_display: listing.is_sold ? 'Sold' : 'Active'
        }));

        res.render('marketplace/my-listings', {
            title: 'My Listings',
            listings: processedListings,
            user: user
        });
    } catch (error) {
        logger.error('Render user listings error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load your listings',
            user: normalizeUser(req.session?.user)
        });
    }
};

// ========== API ROUTES ==========

const getListings = [
    validate(marketplaceSchemas.searchListings, 'query'),
    async (req, res) => {
        try {
            const user = req.session?.user ? normalizeUser(req.session.user) : null;
            const filters = {
                ...req.query,
                campus: user?.campus || req.query.campus || 'main_campus'
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
            const user = req.session?.user ? normalizeUser(req.session.user) : null;
            if (!user || !user.user_id) {
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

            const listingId = await Marketplace.createListingWithMedia(user.user_id, req.body, mediaFiles);

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
            const user = req.session?.user ? normalizeUser(req.session.user) : null;
            if (!user || !user.user_id) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            const { listingId } = req.params;
            const { status, ...updates } = req.body;

            if (status) {
                await Marketplace.updateListingStatus(listingId, user.user_id, status);
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
        const user = req.session?.user ? normalizeUser(req.session.user) : null;
        if (!user || !user.user_id) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const { listingId } = req.params;
        await Marketplace.deleteListing(listingId, user.user_id);

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
            const user = req.session?.user ? normalizeUser(req.session.user) : null;
            if (!user || !user.user_id) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            const { sellerId, listingId, message } = req.body;

            if (user.user_id === sellerId) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot contact yourself'
                });
            }

            const chat = await Marketplace.getOrCreateChat(user.user_id, sellerId, listingId);

            // Send initial message if provided
            if (message && message.trim()) {
                await Marketplace.sendMessage(chat.chat_id, user.user_id, message);
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
        const user = req.session?.user ? normalizeUser(req.session.user) : null;
        if (!user || !user.user_id) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const chats = await Marketplace.getUserChats(user.user_id);

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
        const user = req.session?.user ? normalizeUser(req.session.user) : null;
        if (!user || !user.user_id) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const messages = await Marketplace.getChatMessages(req.params.chatId);

        // Mark messages as read
        await Marketplace.markMessagesAsRead(req.params.chatId, user.user_id);

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
            const user = req.session?.user ? normalizeUser(req.session.user) : null;
            if (!user || !user.user_id) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            const { chatId } = req.params;
            const { content } = req.body;

            const messageId = await Marketplace.sendMessage(chatId, user.user_id, content);

            // Emit socket event for real-time messaging
            if (req.io) {
                req.io.to(chatId).emit('new_message', {
                    chatId,
                    messageId,
                    senderId: user.user_id,
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
            const user = req.session?.user ? normalizeUser(req.session.user) : null;
            if (!user || !user.user_id) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            const { listingId } = req.body;
            const result = await Marketplace.toggleFavorite(user.user_id, listingId);

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
        const user = req.session?.user ? normalizeUser(req.session.user) : null;
        if (!user || !user.user_id) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const favorites = await Marketplace.getUserFavorites(user.user_id);

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
        const user = req.session?.user ? normalizeUser(req.session.user) : null;
        if (!user || !user.user_id) {
            return res.json({
                favoritesCount: 0,
                wishlistCount: 0,
                notificationCount: 0
            });
        }

        const counts = await Marketplace.getCounts(user.user_id);

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
            const user = req.session?.user ? normalizeUser(req.session.user) : null;
            if (!user || !user.user_id) {
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
            const user = req.session?.user ? normalizeUser(req.session.user) : null;
            if (!user || !user.user_id) {
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

// ========== NEW SAFETY & REVIEW FEATURES ==========

const getSafeMeetupLocations = async (req, res) => {
    try {
        const pool = require('../config/database');
        const campus = req.query.campus || req.user?.campus || 'main_campus';

        const [locations] = await pool.query(
            'SELECT * FROM safe_meetup_locations WHERE campus = ? AND is_verified = 1 ORDER BY has_security DESC, is_24_7 DESC',
            [campus]
        );

        res.json({
            success: true,
            locations
        });
    } catch (error) {
        logger.error('Get safe meetup locations error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch safe meetup locations'
        });
    }
};

const reportListing = async (req, res) => {
    try {
        const user = req.user || req.session?.user;
        if (!user || !user.user_id) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const pool = require('../config/database');
        const { id } = req.params;
        const { reason, details } = req.body;
        const report_id = require('crypto').randomUUID();

        await pool.query(
            'INSERT INTO listing_reports (report_id, listing_id, reporter_id, reason, details) VALUES (?, ?, ?, ?, ?)',
            [report_id, id, user.user_id, reason, details]
        );

        res.json({
            success: true,
            message: 'Report submitted successfully'
        });
    } catch (error) {
        logger.error('Report listing error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit report'
        });
    }
};

const blockUser = async (req, res) => {
    try {
        const user = req.user || req.session?.user;
        if (!user || !user.user_id) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const pool = require('../config/database');
        const { id } = req.params;
        const { reason } = req.body;
        const block_id = require('crypto').randomUUID();

        await pool.query(
            'INSERT INTO marketplace_user_blocks (block_id, blocker_id, blocked_id, reason) VALUES (?, ?, ?, ?)',
            [block_id, user.user_id, id, reason]
        );

        res.json({
            success: true,
            message: 'User blocked successfully'
        });
    } catch (error) {
        logger.error('Block user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to block user'
        });
    }
};

const createReview = async (req, res) => {
    try {
        const user = req.user || req.session?.user;
        if (!user || !user.user_id) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const pool = require('../config/database');
        const { listing_id, reviewee_id, rating, comment, transaction_type } = req.body;
        const review_id = require('crypto').randomUUID();

        await pool.query(
            'INSERT INTO marketplace_reviews (review_id, listing_id, reviewer_id, reviewee_id, rating, comment, transaction_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [review_id, listing_id, user.user_id, reviewee_id, rating, comment, transaction_type]
        );

        res.json({
            success: true,
            message: 'Review submitted successfully'
        });
    } catch (error) {
        logger.error('Create review error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create review'
        });
    }
};

const getUserReviews = async (req, res) => {
    try {
        const pool = require('../config/database');
        const { id } = req.params;

        const [reviews] = await pool.query(
            `SELECT r.*, u.name as reviewer_name, u.avatar_url as reviewer_avatar 
             FROM marketplace_reviews r 
             JOIN users u ON r.reviewer_id = u.user_id 
             WHERE r.reviewee_id = ? 
             ORDER BY r.created_at DESC 
             LIMIT 50`,
            [id]
        );

        const [stats] = await pool.query(
            `SELECT 
                COUNT(*) as total_reviews,
                AVG(rating) as average_rating,
                SUM(CASE WHEN transaction_type = 'buyer' THEN 1 ELSE 0 END) as buyer_reviews,
                SUM(CASE WHEN transaction_type = 'seller' THEN 1 ELSE 0 END) as seller_reviews
             FROM marketplace_reviews 
             WHERE reviewee_id = ?`,
            [id]
        );

        res.json({
            success: true,
            reviews,
            stats: stats[0]
        });
    } catch (error) {
        logger.error('Get user reviews error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch reviews'
        });
    }
};

const boostListing = async (req, res) => {
    try {
        const user = req.user || req.session?.user;
        if (!user || !user.user_id) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const pool = require('../config/database');
        const { id } = req.params;

        // Check if user owns the listing
        const [listings] = await pool.query(
            'SELECT seller_id FROM marketplace_listings WHERE listing_id = ?',
            [id]
        );

        if (listings.length === 0 || listings[0].seller_id !== user.user_id) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        await pool.query(
            'UPDATE marketplace_listings SET boost_count = boost_count + 1, last_boosted_at = NOW() WHERE listing_id = ?',
            [id]
        );

        res.json({
            success: true,
            message: 'Listing boosted successfully'
        });
    } catch (error) {
        logger.error('Boost listing error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to boost listing'
        });
    }
};

const markAsSold = async (req, res) => {
    try {
        const user = req.user || req.session?.user;
        if (!user || !user.user_id) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const pool = require('../config/database');
        const { id } = req.params;

        // Check if user owns the listing
        const [listings] = await pool.query(
            'SELECT seller_id FROM marketplace_listings WHERE listing_id = ?',
            [id]
        );

        if (listings.length === 0 || listings[0].seller_id !== user.user_id) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        await pool.query(
            'UPDATE marketplace_listings SET status = ?, sold_at = NOW(), is_sold = 1 WHERE listing_id = ?',
            ['sold', id]
        );

        res.json({
            success: true,
            message: 'Listing marked as sold'
        });
    } catch (error) {
        logger.error('Mark as sold error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark listing as sold'
        });
    }
};

const relistItem = async (req, res) => {
    try {
        const user = req.user || req.session?.user;
        if (!user || !user.user_id) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const pool = require('../config/database');
        const { id } = req.params;

        // Get original listing
        const [listings] = await pool.query(
            'SELECT * FROM marketplace_listings WHERE listing_id = ? AND seller_id = ?',
            [id, user.user_id]
        );

        if (listings.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Listing not found'
            });
        }

        const original = listings[0];
        const new_listing_id = require('crypto').randomUUID();

        // Create new listing with same details
        await pool.query(
            `INSERT INTO marketplace_listings 
             (listing_id, seller_id, title, description, price, category, condition, campus, location, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
            [new_listing_id, user.user_id, original.title, original.description, original.price,
                original.category, original.condition, original.campus, original.location]
        );

        // Copy media
        const [media] = await pool.query(
            'SELECT * FROM listing_media WHERE listing_id = ?',
            [id]
        );

        for (const m of media) {
            const media_id = require('crypto').randomUUID();
            await pool.query(
                'INSERT INTO listing_media (media_id, listing_id, media_url, media_type, upload_order) VALUES (?, ?, ?, ?, ?)',
                [media_id, new_listing_id, m.media_url, m.media_type, m.upload_order]
            );
        }

        res.json({
            success: true,
            message: 'Item relisted successfully',
            listing_id: new_listing_id
        });
    } catch (error) {
        logger.error('Relist item error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to relist item'
        });
    }
};

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
    createSkillOffer,

    // New Safety & Review Features
    getSafeMeetupLocations,
    reportListing,
    blockUser,
    createReview,
    getUserReviews,
    boostListing,
    markAsSold,
    relistItem
};