const Marketplace = require('../models/Marketplace');
const LostFound = require('../models/LostFound');
const SkillMarket = require('../models/SkillMarket');
const marketplaceSchemas = require('../schemas/marketplace.schemas');
const { validate } = require('../middleware/validation.middleware');
const logger = require('../utils/logger');
const upload = require('../utils/fileUpload');
const crypto = require('crypto');

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
        const user = normalizeUser(req.user);
        const filters = {
            category: req.query.category || 'all',
            campus: req.query.campus || user?.campus || 'all',
            sort: req.query.sort || 'newest',
            minPrice: req.query.minPrice,
            maxPrice: req.query.maxPrice,
            minRating: req.query.minRating,
            condition: req.query.condition,
            search: req.query.search,
            currentUserId: user?.user_id,
            limit: 20
        };

        // Try to get real data first, fallback to mock if database issues
        let { listings, total, hasMore } = { listings: [], total: 0, hasMore: false };
        let recommendedListings = [];
        let counts = { favoritesCount: 0, wishlistCount: 0, notificationCount: 0 };

        try {
            const result = await Marketplace.getListingsWithMock(filters, true); // Enable mock data
            listings = result.listings;
            total = result.total;
            hasMore = result.hasMore;
        } catch (dbError) {
            logger.warn('Database error in marketplace, using mock data:', dbError.message);
            // Use only mock data as fallback
            const mockResult = await Marketplace.getListingsWithMock(filters, true);
            listings = mockResult.listings;
            total = mockResult.total;
            hasMore = mockResult.hasMore;
        }

        try {
            recommendedListings = await Marketplace.getRecommendations(user?.user_id || null, user?.campus || 'main_campus', 6);
        } catch (recError) {
            logger.warn('Error getting recommendations:', recError.message);
            // Use mock recommendations
            recommendedListings = Marketplace.generateMockData(6);
        }

        try {
            if (user?.user_id) {
                counts = await Marketplace.getCounts(user.user_id);
            }
        } catch (countError) {
            logger.warn('Error getting counts:', countError.message);
            // counts already initialized with defaults
        }

        res.render('marketplace', {
            title: 'Sparkle Mall | Marketplace',
            listings: listings || [],
            recommendedListings: recommendedListings || [],
            user: user,
            counts: counts,
            campus: user?.campus || 'main_campus',
            filters: filters
        });
    } catch (error) {
        logger.error('Render marketplace error:', error);
        // Ultimate fallback - render with empty data
        res.render('marketplace', {
            title: 'Sparkle Mall | Marketplace',
            listings: Marketplace.generateMockData(10),
            recommendedListings: Marketplace.generateMockData(6),
            user: normalizeUser(req.user),
            counts: { favoritesCount: 0, wishlistCount: 0, notificationCount: 0 },
            campus: 'main_campus',
            filters: { category: 'all', sort: 'newest' }
        });
    }
};

const renderListingDetail = async (req, res) => {
    try {
        // Get user with safe defaults
        const user = normalizeUser(req.user);

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
        const user = normalizeUser(req.user);

        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load listing details',
            user: user
        });
    }
};

const renderUserListings = async (req, res) => {
    try {
        const user = normalizeUser(req.user);

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
            user: normalizeUser(req.user)
        });
    }
};

const renderOrders = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        if (!user || !user.user_id) return res.redirect('/login');

        const orders = await Marketplace.getOrders(user.user_id);
        res.render('marketplace/orders', {
            title: 'My Orders',
            orders: orders || [],
            user: user
        });
    } catch (error) {
        logger.error('Render orders error:', error);
        res.status(500).render('error', { title: 'Error', message: 'Failed to load orders', user: normalizeUser(req.user) });
    }
};

const renderSell = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        if (!user || !user.user_id) return res.redirect('/login');
        res.render('marketplace/sell', {
            title: 'Sell Item',
            user: user
        });
    } catch (error) {
        logger.error('Render sell error:', error);
        res.status(500).render('error', { title: 'Error', message: 'Failed to load sell page', user: normalizeUser(req.user) });
    }
};

// ========== API ROUTES ==========

const getRecommendations = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        const limit = parseInt(req.query.limit) || 5;
        const listings = await Marketplace.getRecommendations(user?.user_id || null, user?.campus || 'main_campus', limit);
        res.json({ success: true, listings });
    } catch (error) {
        logger.error('API recommendations error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch recommendations' });
    }
};

const getListings = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        const filters = {
            ...req.query,
            currentUserId: user?.user_id,
            campus: req.query.campus || user?.campus || 'all'
        };

        const result = await Marketplace.getListings(filters);

        res.json({
            success: true,
            listings: result.listings,
            pagination: {
                total: result.total,
                limit: result.limit,
                offset: result.offset,
                hasMore: result.hasMore
            }
        });
    } catch (error) {
        logger.error('Get listings API error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch listings' });
    }
};

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
            const user = normalizeUser(req.user);
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

            // Optional: Notify followers about new product
            try {
                const notificationController = require('./notification.controller');
                const [followers] = await pool.query('SELECT follower_id FROM follows WHERE following_id = ?', [user.user_id]);
                
                for (const f of followers) {
                    await notificationController.createNotification({
                        user_id: f.follower_id,
                        type: 'marketplace_activity',
                        title: 'New Product nearby! 🛍️',
                        content: `${user.username || 'A seller'} posted a new product: "${req.body.title}". Check it out!`,
                        actor_id: user.user_id,
                        action_url: `/marketplace/listings/${listingId}`
                    }, pool);
                }
            } catch (notifyError) {
                logger.warn('Failed to send marketplace notifications:', notifyError.message);
            }

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
            const user = normalizeUser(req.user);
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
        const user = normalizeUser(req.user);
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

const toggleSellerFavorite = [
    validate(marketplaceSchemas.toggleSellerFavorite, 'body'),
    async (req, res) => {
        try {
            const user = normalizeUser(req.user);
            if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

            const { sellerId } = req.body;
            const result = await Marketplace.toggleSellerFavorite(user.user_id, sellerId);
            res.json({ success: true, favorited: result.favorited });
        } catch (error) {
            logger.error('Toggle seller favorite error:', error);
            res.status(500).json({ success: false, message: 'An error occurred' });
        }
    }
];

const contactSeller = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const { sellerId, listingId, message } = req.body;
        if (user.user_id === sellerId) {
            return res.status(400).json({ success: false, message: 'Cannot contact yourself' });
        }

        const chat = await Marketplace.getOrCreateChat(user.user_id, sellerId, listingId);
        if (message && message.trim()) {
            await Marketplace.sendMessage(chat.chat_id, user.user_id, message);
        }

        res.json({ success: true, chatId: chat.chat_id, redirect: `/messages?chat=${chat.chat_id}` });
    } catch (error) {
        logger.error('Contact seller error:', error);
        res.status(500).json({ success: false, message: 'Failed to contact seller' });
    }
};

const getUserChats = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const chats = await Marketplace.getUserChats(user.user_id);
        res.json({ success: true, chats: chats || [] });
    } catch (error) {
        logger.error('Get user chats error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch chats' });
    }
};

const getChatMessages = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const messages = await Marketplace.getChatMessages(req.params.chatId);
        await Marketplace.markMessagesAsRead(req.params.chatId, user.user_id);
        res.json({ success: true, messages: messages || [] });
    } catch (error) {
        logger.error('Get chat messages error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch messages' });
    }
};

const sendMessage = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const { chatId } = req.params;
        const { content } = req.body;
        const messageId = await Marketplace.sendMessage(chatId, user.user_id, content);
        res.json({ success: true, messageId });
    } catch (error) {
        logger.error('Send message error:', error);
        res.status(500).json({ success: false, message: 'Failed to send message' });
    }
};

const placeOrder = [
    validate(marketplaceSchemas.createOrder, 'body'),
    async (req, res) => {
        try {
            const user = normalizeUser(req.user);
            if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

            const { listingId } = req.body;
            if (!listingId) return res.status(400).json({ success: false, message: 'listingId is required' });

            const orderId = await Marketplace.createOrder(user.user_id, listingId);

            // Push real-time order notification via Firebase
            try {
                const admin = require('../config/firebase-admin');
                if (admin) {
                    const db = admin.database();
                    await db.ref(`marketplace/orders/${orderId}`).set({
                        orderId, listingId,
                        buyerId: user.user_id,
                        status: 'pending',
                        createdAt: Date.now()
                    });
                }
            } catch (fbErr) {
                logger.warn('Firebase order push failed:', fbErr.message);
            }

            res.json({ success: true, orderId, message: 'Order placed successfully! 🛍️' });
        } catch (error) {
            logger.error('Place order error:', error);
            const code = error.code || 'ORDER_FAILED';
            const statusCode = code === 'UNAUTHORIZED' ? 403 : 400;
            res.status(statusCode).json({ success: false, message: error.message || 'Failed to place order', code });
        }
    }
];

const updateOrderStatus = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const { orderId } = req.params;
        const { status, reason } = req.body;
        if (!status) return res.status(400).json({ success: false, message: 'status is required' });

        await Marketplace.updateOrderStatus(orderId, user.user_id, status, reason);

        // Broadcast status change via Firebase
        try {
            const admin = require('../config/firebase-admin');
            if (admin) {
                await admin.database().ref(`marketplace/orders/${orderId}`).update({ status, updatedAt: Date.now() });
            }
        } catch (fbErr) {
            logger.warn('Firebase status update failed:', fbErr.message);
        }

        const updatedOrder = await Marketplace.getOrderById(orderId, user.user_id);
        res.json({ success: true, order: updatedOrder, message: `Order ${status}` });
    } catch (error) {
        logger.error('Update order status error:', error);
        const code = error.code || 'UPDATE_FAILED';
        res.status(code === 'UNAUTHORIZED' ? 403 : 400).json({ success: false, message: error.message, code });
    }
};

const confirmMeetup = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const { orderId } = req.params;
        const result = await Marketplace.confirmMeetup(orderId, user.user_id);

        // If both confirmed, broadcast
        if (result.bothConfirmed) {
            try {
                const admin = require('../config/firebase-admin');
                if (admin) {
                    await admin.database().ref(`marketplace/orders/${orderId}`).update({
                        meetupBothConfirmed: true,
                        updatedAt: Date.now()
                    });
                }
            } catch (fbErr) { logger.warn('Firebase meetup push failed:', fbErr.message); }
        }

        res.json({ success: true, ...result });
    } catch (error) {
        logger.error('Confirm meetup error:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

const getOrderById = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const order = await Marketplace.getOrderById(req.params.orderId, user.user_id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        res.json({ success: true, order });
    } catch (error) {
        logger.error('Get order by ID error:', error);
        res.status(500).json({ success: false, message: 'Failed to load order' });
    }
};

const getOrders = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const orders = await Marketplace.getOrders(user.user_id);
        res.json({ success: true, orders: orders || [] });
    } catch (error) {
        logger.error('Get orders error:', error);
        res.status(500).json({ success: false, message: 'Failed to load orders' });
    }
};

const toggleFavorite = [
    validate(marketplaceSchemas.toggleFavorite, 'body'),
    async (req, res) => {
        try {
            const user = normalizeUser(req.user);
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
        const user = normalizeUser(req.user);
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
        const user = normalizeUser(req.user);
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
            const user = normalizeUser(req.user);
            if (!user || !user.user_id) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            const { type, title, description, category, location, date_lost_found, contact_info } = req.body;

            if (!type || !['lost', 'found'].includes(type)) {
                return res.status(400).json({ success: false, message: 'Type must be "lost" or "found"' });
            }
            if (!title || !title.trim()) {
                return res.status(400).json({ success: false, message: 'Title is required' });
            }

            // Handle optional uploaded image
            const imageUrl = req.file ? (req.file.path || `/uploads/${req.file.filename}`) : null;

            const itemData = {
                item_id: crypto.randomUUID(),
                reporter_id: user.user_id,
                type,
                title: title.trim(),
                description: description ? description.trim() : null,
                category: category || 'other',
                campus: user.campus || 'main_campus',
                location: location ? location.trim() : null,
                date_lost_found: date_lost_found || new Date().toISOString().split('T')[0],
                contact_info: contact_info ? contact_info.trim() : null,
                image_url: imageUrl,
                media: imageUrl ? [imageUrl] : []
            };

            await LostFound.create(itemData);

            res.status(201).json({
                success: true,
                message: 'Item reported successfully',
                item_id: itemData.item_id
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
            const user = normalizeUser(req.user);
            if (!user || !user.user_id) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            const { title, description, category, skill_type, price, is_free } = req.body;

            if (!title || !title.trim()) {
                return res.status(400).json({ success: false, message: 'Title is required' });
            }
            if (!category) {
                return res.status(400).json({ success: false, message: 'Category is required' });
            }

            const offerData = {
                offer_id: crypto.randomUUID(),
                user_id: user.user_id,
                title: title.trim(),
                description: description ? description.trim() : null,
                category,
                skill_type: skill_type || 'teaching',
                price: is_free ? 0 : (parseFloat(price) || 0),
                is_free: is_free ? 1 : 0,
                campus: user.campus || 'main_campus'
            };

            await SkillMarket.createOffer(offerData);

            res.status(201).json({
                success: true,
                message: 'Skill offer created successfully',
                offer_id: offerData.offer_id
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
        const user = req.user;
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
        const user = req.user;
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
        const user = req.user;
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
        const user = req.user;
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
        const user = req.user;
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
        const user = req.user;
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
    renderOrders,
    renderSell,

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

    // Order management
    placeOrder,
    updateOrderStatus,
    confirmMeetup,
    getOrderById,
    getOrders,

    // New Safety & Review Features
    getSafeMeetupLocations,
    reportListing,
    blockUser,
    createReview,
    getUserReviews,
    boostListing,
    markAsSold,
    relistItem,
    getRecommendations,
    toggleSellerFavorite
};
