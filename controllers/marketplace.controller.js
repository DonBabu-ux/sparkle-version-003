const Marketplace = require('../models/Marketplace');
const LostFound = require('../models/LostFound');
const SkillMarket = require('../models/SkillMarket');
const marketplaceSchemas = require('../schemas/marketplace.schemas');
const { validate } = require('../middleware/validation.middleware');
const logger = require('../utils/logger');
const { upload, marketplaceUpload } = require('../utils/fileUpload');
const crypto = require('crypto');
const notificationController = require('./notification.controller');
const pool = require('../config/database');

// Helper for media URLs
const getSafeMediaUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('/uploads/') || url.startsWith('http')) {
        return url;
    }
    return null;
};

// ... existing help functions ...

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

    // Ensure affiliation exists
    if (!normalized.affiliation && !normalized.campus) {
        normalized.affiliation = normalized.campus = 'all';
    } else if (!normalized.affiliation) {
        normalized.affiliation = normalized.campus;
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
        const affiliation = req.query.affiliation || req.query.campus || user?.affiliation || user?.campus || 'all';
        const filters = {
            category: req.query.category || 'all',
            affiliation: affiliation,
            campus: affiliation, // For model compatibility
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
            const result = await Marketplace.getListings(filters);
            listings = result.listings || [];
            total = result.total || result.pagination?.total || listings.length;
            hasMore = result.pagination?.hasMore || false;
        } catch (dbError) {
            logger.error('Database error in marketplace:', dbError.message);
        }

        try {
            recommendedListings = await Marketplace.getRecommendations(user?.user_id || null, affiliation, 6);
        } catch (recError) {
            logger.warn('Error getting recommendations:', recError.message);
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
            affiliation: affiliation,
            filters: filters
        });
    } catch (error) {
        logger.error('Render marketplace error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load marketplace data. Please try again later.',
            user: normalizeUser(req.user)
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

        // Fetch reviews for this listing
        const reviews = await Marketplace.getListingReviews(req.params.id);

        res.render('marketplace/listing-detail', {
            title: listing.title || 'Listing Details',
            listing: listing,
            reviews: reviews || [],
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

const renderSellerProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = normalizeUser(req.user);
        const profile = await Marketplace.getSellerProfile(userId);

        if (!profile) {
            return res.status(404).render('404', { title: 'Seller Not Found', message: 'This seller does not exist.', user });
        }

        res.render('marketplace/seller-profile', {
            title: `${profile.username}'s Marketplace Profile`,
            seller: profile,
            user
        });
    } catch (error) {
        logger.error('Render seller profile error:', error);
        res.status(500).render('error', { title: 'Error', message: 'Failed to load seller profile', user: normalizeUser(req.user) });
    }
};

const renderWishlist = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        if (!user) return res.redirect('/login');
        
        const wishlist = await Marketplace.getUserWishlist(user.user_id);
        
        res.render('marketplace/wishlist', {
            title: 'My Wishlist',
            listings: wishlist || [],
            user
        });
    } catch (error) {
        logger.error('Render wishlist error:', error);
        res.status(500).render('error', { title: 'Error', message: 'Failed to load wishlist', user: normalizeUser(req.user) });
    }
};

// ========== API ROUTES ==========



const getListings = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        const affiliation = req.query.affiliation || req.query.campus || user?.affiliation || user?.campus || 'all';
        const filters = {
            ...req.query,
            currentUserId: user?.user_id,
            affiliation: affiliation,
            campus: affiliation
        };

        const result = await Marketplace.getListings(filters);

        res.json({
            success: true,
            listings: result.listings,
            pagination: result.pagination
        });
    } catch (error) {
        logger.error('Get listings API error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch listings' });
    }
};

const getCategories = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        const categories = await Marketplace.getCategories({
            campus: req.query.campus || user?.campus || 'all'
        });
        
        res.json({
            success: true,
            categories
        });
    } catch (error) {
        logger.error('Get categories API error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch categories' });
    }
};

const getTrending = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        // trending is popular listings
        const result = await Marketplace.getListings({
            sort: 'popular',
            limit: 5,
            campus: req.query.campus || user?.campus || 'all'
        });
        
        res.json({
            success: true,
            trending: result.listings
        });
    } catch (error) {
        logger.error('Get trending API error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch trending' });
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
    validate(marketplaceSchemas.createListingSchema),
    async (req, res) => {
        try {
            const user = normalizeUser(req.user);
            if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

            // Files are already uploaded by multer middleware
            const files = req.files || [];
            
            // Process media files
            const media = files.map((file, index) => {
                const url = file.path || file.secure_url || file.url;
                if (!url) {
                    logger.warn(`Missing URL for file ${index}:`, file);
                }
                return {
                    url: url || 'invalid_url',
                    type: file.mimetype?.startsWith('video/') ? 'video' : 'image',
                    order: index
                };
            }).filter(m => m.url !== 'invalid_url');

            // Get primary image
            const primaryImage = media.find(m => m.type === 'image')?.url || (media.length > 0 ? media[0].url : null);
            
            // Parse tags
            let tags = [];
            if (req.body.tags) {
                try {
                    tags = typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : req.body.tags;
                } catch (e) {
                    tags = req.body.tags.split(',').map(t => t.trim()).filter(Boolean);
                }
            }
            
            // Construct listing data
            const listingData = {
                seller_id: user.user_id || user.id,
                title: req.body.title,
                description: req.body.description || '',
                price: parseFloat(req.body.price) || 0,
                category: req.body.category || 'other',
                condition: req.body.condition || 'good',
                campus: req.body.campus || user.campus || 'main_campus',
                location: req.body.location || '',
                tags: tags,
                image_url: primaryImage,
                media: media
            };
            
            logger.info(`Attempting to create listing for user ${user.user_id || user.id}`);
            const listingId = await Marketplace.createListing(listingData);
            
            res.status(201).json({
                success: true,
                message: 'Listing created successfully',
                listing_id: listingId,
                redirect: `/marketplace/listings/${listingId}`
            });
            
        } catch (error) {
            const errorDetails = {
                message: error?.message || 'Unknown Error',
                stack: error?.stack,
                body: req.body,
                userId: req.user?.user_id
            };
            logger.error('Create listing error details:', errorDetails);
            
            res.status(500).json({
                success: false,
                message: error?.message || 'Failed to create listing',
                debug: process.env.NODE_ENV === 'development' ? errorDetails : undefined
            });
        }
    }
];

const updateListing = [
    async (req, res) => {
        try {
            const user = normalizeUser(req.user);
            if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

            const listingId = req.params.id;
            
            // Verify user owns the listing
            const listing = await Marketplace.getListingById(listingId);
            
            if (!listing) {
                return res.status(404).json({
                    success: false,
                    message: 'Listing not found'
                });
            }
            
            if (listing.seller_id !== user.user_id) {
                return res.status(403).json({
                    success: false,
                    message: 'Not your listing'
                });
            }
            
            // Process new media if any
            let media = [];
            if (req.files && req.files.length > 0) {
                media = req.files.map((file, index) => ({
                    url: file.path || file.filename,
                    type: file.mimetype.startsWith('image/') ? 'image' : 'video',
                    order: index
                }));
            }
            
            // Prepare update data
            const updateData = {
                title: req.body.title,
                description: req.body.description,
                price: req.body.price ? parseFloat(req.body.price) : undefined,
                category: req.body.category,
                condition: req.body.condition,
                campus: req.body.campus,
                location: req.body.location,
                status: req.body.status,
                media: media
            };
            
            // Remove undefined fields
            Object.keys(updateData).forEach(key => 
                updateData[key] === undefined && delete updateData[key]
            );
            
            await Marketplace.updateListing(listingId, updateData);
            
            res.json({
                success: true,
                message: 'Listing updated successfully'
            });
            
        } catch (error) {
            logger.error('Update listing error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update listing'
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

const contactSeller = [
    validate(marketplaceSchemas.contactSellerSchema, 'body'),
    async (req, res) => {
        try {
            const user = normalizeUser(req.user);
            if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

            const { sellerId, message } = req.body;
            const listingId = req.params.id || req.body.listingId;

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
    }
];

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
    validate(marketplaceSchemas.createOrderSchema, 'body'),
    async (req, res) => {
        try {
            const user = normalizeUser(req.user);
            if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

            const { listingId, agreedPrice, message, campus, location, scheduledTime } = req.body;
            
            // Server derives all data from database for security
            const orderId = await Marketplace.placeOrder({ 
                listingId, 
                buyerId: user.user_id,
                agreedPrice,
                message,
                campus,
                location,
                scheduledTime
            });
            
            res.json({
                success: true,
                orderId,
                message: 'Order placed successfully! 🛍️'
            });
            
        } catch (error) {
            logger.error('Place order error:', error);
            const status = error.status || 500;
            res.status(status).json({
                success: false,
                message: error.message || 'Failed to place order'
            });
        }
    }
];



const updateOrderStatus = [
    validate(marketplaceSchemas.updateOrderStatusSchema, 'body'),
    async (req, res) => {
        try {
            const user = normalizeUser(req.user);
            if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

            const { orderId } = req.params;
            const { status, reason } = req.body;

            await Marketplace.updateOrderStatus(orderId, user.user_id, status, reason);

            const updatedOrder = await Marketplace.getOrderById(orderId, user.user_id);
            res.json({
                success: true,
                order: updatedOrder,
                message: `Order marked as ${status}`
            });
        } catch (error) {
            logger.error('Update order status error:', error);
            const msg = error.message;
            res.status(msg === 'UNAUTHORIZED' ? 403 : 400).json({ 
                success: false, 
                message: msg,
                code: msg 
            });
        }
    }
];

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
        
        const { limit = 20, offset = 0, role } = req.query;
        
        const result = await Marketplace.getUserOrders({
            userId: user.user_id,
            limit: parseInt(limit),
            offset: parseInt(offset),
            role // 'buyer', 'seller', or null for both
        });
        
        res.json({
            success: true,
            orders: result.orders || [],
            pagination: result.pagination
        });
        
    } catch (error) {
        logger.error('Get orders error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch orders'
        });
    }
};

const toggleFavorite = [
    validate(marketplaceSchemas.toggleFavoriteSchema, 'body'), // Body might still be required by schema
    async (req, res) => {
        try {
            const user = normalizeUser(req.user);
            if (!user || !user.user_id) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            // Get listingId from params (URL) or fallback to body
            const listingId = req.params.id || req.body.listingId;
            
            if (!listingId) {
                return res.status(400).json({ success: false, message: 'Listing ID is required' });
            }

            const result = await Marketplace.toggleFavorite(user.user_id, listingId);

            // Notify seller when someone favorites their listing (non-blocking)
            if (result.favorited) {
                try {
                    const [[listing]] = await pool.query(
                        'SELECT seller_id, title FROM marketplace_listings WHERE listing_id = ?', 
                        [listingId]
                    );
                    if (listing && listing.seller_id !== user.user_id) {
                        notificationController.createNotification({
                            user_id: listing.seller_id,
                            actor_id: user.user_id,
                            type: 'marketplace_like',
                            title: '❤️ Someone liked your listing!',
                            content: `${user.name || user.username || 'A user'} liked your listing: "${listing.title}"`,
                            related_id: listingId,
                            related_type: 'marketplace_listing',
                            action_url: `/marketplace/listings/${listingId}`
                        }).catch(() => {});
                    }
                } catch (_) { /* non-blocking */ }
            }

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
    validate(marketplaceSchemas.createLostFoundSchema, 'body'),
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
        const offers = await SkillMarket.findAll(req.query);
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
    validate(marketplaceSchemas.createSkillOfferSchema, 'body'),
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



const getRecommendations = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        const { listings } = await Marketplace.getListings({ 
            limit: 6, 
            campus: user?.campus || 'all',
            sort: 'popular'
        }, user?.user_id);
        res.json({ success: true, listings: listings || [] });
    } catch (error) {
        logger.error('Get recommendations error:', error);
        res.status(500).json({ success: false, listings: [] });
    }
};

const createReview = [
    validate(marketplaceSchemas.createReviewSchema, 'body'),
    async (req, res) => {
        try {
            const user = normalizeUser(req.user);
            const reviewData = {
                listing_id: req.body.listing_id,
                reviewer_id: user.user_id,
                reviewee_id: req.body.reviewee_id,
                rating: req.body.rating,
                comment: req.body.comment,
                transaction_type: req.body.transaction_type || 'purchase'
            };
            const result = await Marketplace.createReview(reviewData);
            res.json({ success: true, message: result.updated ? 'Review updated' : 'Review submitted' });
        } catch (error) {
            logger.error('Create review error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
];

const toggleWishlist = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const { id } = req.params;
        const result = await Marketplace.toggleWishlist(user.user_id, id);
        
        res.json({ success: true, ...result });
    } catch (error) {
        logger.error('Toggle wishlist error:', error);
        res.status(500).json({ success: false, message: 'Failed to toggle wishlist' });
    }
};

const getUserReviews = async (req, res) => {
    try {
        const { userId } = req.params;
        const reviews = await Marketplace.getUserReviews(userId);
        res.json({ success: true, reviews });
    } catch (error) {
        logger.error('Get user reviews error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
    }
};

const getCounts = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        if (!user) return res.json({ success: true, favoritesCount: 0, wishlistCount: 0, notificationCount: 0 });
        const counts = await Marketplace.getCounts(user.user_id);
        res.json({ success: true, ...counts });
    } catch (error) {
        logger.error('Get counts error:', error);
        res.json({ success: true, favoritesCount: 0, wishlistCount: 0, notificationCount: 0 });
    }
};

const getSafeMeetupLocations = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        const campus = req.query.campus || user?.campus || 'all';
        const locations = await Marketplace.getSafeMeetupLocations(campus);
        res.json({ success: true, locations });
    } catch (error) {
        logger.error('Get safe meetup locations error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch meetup locations' });
    }
};

const boostListing = [
    async (req, res) => {
        try {
            const user = normalizeUser(req.user);
            const { id } = req.params;
            await Marketplace.boostListing(id);
            res.json({ success: true, message: 'Listing boosted!' });
        } catch (error) {
            logger.error('Boost listing error:', error);
            res.status(500).json({ success: false, message: 'Failed to boost listing' });
        }
    }
];

const toggleSellerFavorite = [
    validate(marketplaceSchemas.favoriteSellerSchema, 'body'),
    async (req, res) => {
        try {
            const user = normalizeUser(req.user);
            if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

            const { sellerId } = req.body;
            const result = await Marketplace.toggleFavoriteSeller(user.user_id, sellerId);

            res.json({
                success: true,
                favorited: result.favorited
            });
        } catch (error) {
            logger.error('Toggle seller favorite error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to update seller wishlist'
            });
        }
    }
];

const blockUser = [
    validate(marketplaceSchemas.blockUserSchema, 'body'),
    async (req, res) => {
        try {
            const user = normalizeUser(req.user);
            const { userId, reason } = req.body;
            await Marketplace.blockUser(user.user_id, userId, reason);
            res.json({ success: true, message: 'User blocked' });
        } catch (error) {
            logger.error('Block user error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
];

const reportListing = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        const { listingId, reason, description } = req.body;
        // Basic report implementation (in real world, save to reports table)
        logger.warn(`Listing ${listingId} reported by ${user.user_id}: ${reason}`);
        res.json({ success: true, message: 'Report submitted' });
    } catch (error) {
        logger.error('Report listing error:', error);
        res.status(500).json({ success: false, message: 'Failed to submit report' });
    }
};

const markAsSold = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        const { id } = req.params;
        await Marketplace.updateListing(id, user.user_id, { status: 'sold' });
        res.json({ success: true, message: 'Item marked as sold' });
    } catch (error) {
        logger.error('Mark as sold error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const relistItem = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        const { id } = req.params;
        const newId = await Marketplace.relistItem(id, user.user_id);
        res.json({ success: true, listingId: newId });
    } catch (error) {
        logger.error('Relist item error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ── View Tracking ─────────────────────────────────────────────────────────────
const recordView = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        const { id } = req.params;

        // Increment view_count in DB (deduplicated per session via header flag from frontend)
        await pool.query(
            'UPDATE marketplace_listings SET view_count = view_count + 1 WHERE listing_id = ?',
            [id]
        );

        // Notify seller (max once per day per viewer — simple check)
        if (user) {
            try {
                const [[listing]] = await pool.query(
                    'SELECT seller_id, title, view_count FROM marketplace_listings WHERE listing_id = ?',
                    [id]
                );
                if (listing && listing.seller_id !== user.user_id) {
                    // only notify at milestone view counts to reduce noise
                    const views = listing.view_count;
                    if ([10, 25, 50, 100, 250, 500].includes(views)) {
                        notificationController.createNotification({
                            user_id: listing.seller_id,
                            actor_id: user.user_id,
                            type: 'marketplace_view',
                            title: `👀 Your listing reached ${views} views!`,
                            content: `"${listing.title}" has been viewed ${views} times. Keep it active!`,
                            related_id: id,
                            related_type: 'marketplace_listing',
                            action_url: `/marketplace/listings/${id}`
                        }).catch(() => {});
                    }
                }
            } catch (_) { /* non-blocking */ }
        }

        res.json({ success: true });
    } catch (error) {
        logger.error('Record view error:', error);
        res.json({ success: false }); // silent fail
    }
};

// ── Share Tracking ────────────────────────────────────────────────────────────
const recordShare = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        const { id } = req.params;

        // Notify the seller about the share
        if (user) {
            try {
                const [[listing]] = await pool.query(
                    'SELECT seller_id, title FROM marketplace_listings WHERE listing_id = ?',
                    [id]
                );
                if (listing && listing.seller_id !== user.user_id) {
                    notificationController.createNotification({
                        user_id: listing.seller_id,
                        actor_id: user.user_id,
                        type: 'marketplace_share',
                        title: '🔗 Someone shared your listing!',
                        content: `${user.name || user.username || 'A user'} shared your listing: "${listing.title}"`,
                        related_id: id,
                        related_type: 'marketplace_listing',
                        action_url: `/marketplace/listings/${id}`
                    }).catch(() => {});
                }
            } catch (_) { /* non-blocking */ }
        }

        res.json({ success: true });
    } catch (error) {
        logger.error('Record share error:', error);
        res.json({ success: false }); // silent fail
    }
};

module.exports = {
    // Web Routes
    renderMarketplace,
    renderListingDetail,
    renderUserListings,
    renderOrders,
    renderSell,
    renderSellerProfile,
    renderWishlist,

    // API Routes
    getListings,
    getCategories,
    getTrending,
    getListingById,
    createListing,
    updateListing,
    deleteListing,
    contactSeller,
    getUserChats,
    getChatMessages,
    sendMessage,
    toggleFavorite,
    toggleWishlist,
    getFavorites,
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
    toggleSellerFavorite,
    recordView,
    recordShare,
    getCounts
};
