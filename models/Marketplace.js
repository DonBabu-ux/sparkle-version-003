const pool = require('../config/database');
const logger = require('../utils/logger');

class Marketplace {
    /**
     * Get all marketplace listings with filters (MySQL SAFE)
     */
    static async getListings(filters = {}) {
        try {
            let query = `
                SELECT ml.*, u.username as seller_username, u.avatar_url as seller_avatar,
                       (SELECT AVG(rating) FROM marketplace_reviews WHERE reviewee_id = ml.seller_id) as seller_rating,
                       (SELECT COUNT(*) FROM marketplace_reviews WHERE reviewee_id = ml.seller_id) as seller_review_count
                FROM marketplace_listings ml
                JOIN users u ON ml.seller_id = u.user_id
                WHERE ml.is_sold = FALSE
            `;
            const params = [];

            // Seller filter
            if (filters.seller_id) {
                query += ' AND ml.seller_id = ?';
                params.push(filters.seller_id);
            }

            // Campus filter
            if (filters.campus && filters.campus !== 'all') {
                query += ' AND ml.campus = ?';
                params.push(filters.campus);
            }

            // Category filter
            if (filters.category && filters.category !== 'all') {
                query += ' AND ml.category = ?';
                params.push(filters.category);
            }

            // Price filters
            if (filters.minPrice && !isNaN(filters.minPrice)) {
                query += ' AND ml.price >= ?';
                params.push(parseFloat(filters.minPrice));
            }
            if (filters.maxPrice && !isNaN(filters.maxPrice)) {
                query += ' AND ml.price <= ?';
                params.push(parseFloat(filters.maxPrice));
            }

            // Condition filter
            if (filters.condition && filters.condition !== 'all') {
                query += ' AND ml.condition = ?';
                params.push(filters.condition);
            }

            // Seller rating filter
            if (filters.minRating && !isNaN(filters.minRating)) {
                query += ` AND (SELECT AVG(rating) FROM marketplace_reviews WHERE reviewee_id = ml.seller_id) >= ?`;
                params.push(parseFloat(filters.minRating));
            }

            // Search term
            if (filters.search && typeof filters.search === 'string' && filters.search.trim()) {
                const searchTerm = `%${filters.search.trim().replace(/[%_]/g, '\\$&')}%`;
                query += ' AND (ml.title LIKE ? OR ml.description LIKE ?)';
                params.push(searchTerm, searchTerm);
            }

            // Sorting
            const sortBy = filters.sort || 'newest';
            switch (sortBy) {
                case 'price_low':
                    query += ' ORDER BY ml.price ASC';
                    break;
                case 'price_high':
                    query += ' ORDER BY ml.price DESC';
                    break;
                case 'popular':
                    query += ' ORDER BY ml.view_count DESC';
                    break;
                case 'newest':
                default:
                    query += ' ORDER BY ml.created_at DESC';
                    break;
            }

            // Pagination
            const limit = Math.min(parseInt(filters.limit) || 20, 100);
            const offset = Math.max(parseInt(filters.offset) || 0, 0);
            query += ' LIMIT ? OFFSET ?';
            params.push(limit, offset);

            const [listings] = await pool.query(query, params);

            // Get media and favorited status if userId is provided
            for (let listing of listings) {
                const [media] = await pool.query(
                    'SELECT * FROM listing_media WHERE listing_id = ? ORDER BY upload_order',
                    [listing.listing_id]
                );
                listing.media = media;
                listing.image_urls = media.map(m => m.media_url);

                if (filters.currentUserId) {
                    const [fav] = await pool.query(
                        'SELECT 1 FROM marketplace_favorites WHERE user_id = ? AND listing_id = ?',
                        [filters.currentUserId, listing.listing_id]
                    );
                    listing.is_favorited = fav.length > 0;
                }
            }

            // Get total count for pagination
            const [countResult] = await pool.query(
                'SELECT COUNT(*) as total FROM marketplace_listings WHERE is_sold = FALSE'
            );
            const total = countResult[0]?.total || 0;

            return {
                listings,
                total,
                limit,
                offset,
                hasMore: offset + limit < total
            };
        } catch (error) {
            logger.error('Database error in getListings:', error);
            throw error;
        }
    }

    /**
     * Get recommended listings for a user
     */
    static async getRecommendations(userId, campus = 'main_campus', limit = 5) {
        try {
            // Simple algorithm: 
            // 1. Featured/Promoted listings first
            // 2. High rated sellers
            // 3. Newest listings in same campus
            const query = `
                SELECT ml.*, u.username as seller_username, u.avatar_url as seller_avatar,
                       (SELECT AVG(rating) FROM marketplace_reviews WHERE reviewee_id = ml.seller_id) as seller_rating
                FROM marketplace_listings ml
                JOIN users u ON ml.seller_id = u.user_id
                WHERE ml.is_sold = FALSE 
                AND (ml.campus = ? OR ml.campus = 'main_campus')
                AND ml.seller_id != ?
                ORDER BY (status = 'active') DESC, ml.view_count DESC, ml.created_at DESC
                LIMIT ?
            `;
            const [listings] = await pool.query(query, [campus, userId, limit]);

            // Add media to recommendations
            for (let listing of listings) {
                const [media] = await pool.query(
                    'SELECT media_url FROM listing_media WHERE listing_id = ? ORDER BY upload_order LIMIT 1',
                    [listing.listing_id]
                );
                listing.media_url = media[0]?.media_url || listing.image_url || '/images/default-listing.jpg';
            }

            return listings;
        } catch (error) {
            logger.error('Error fetching recommendations:', error);
            return [];
        }
    }

    /**
     * Track user search history
     */
    static async trackSearch(userId, query, filters = {}) {
        try {
            const [tables] = await pool.query("SHOW TABLES LIKE 'marketplace_search_history'");
            if (tables.length === 0) return;

            const searchId = require('crypto').randomUUID();
            await pool.query(
                `INSERT INTO marketplace_search_history 
                (search_id, user_id, search_query, category, campus, min_price, max_price) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    searchId, userId, query.trim(), 
                    filters.category || null, 
                    filters.campus || null,
                    filters.min_price || null,
                    filters.max_price || null
                ]
            );
        } catch (error) {
            logger.warn('Failed to track search history:', error.message);
        }
    }

    /**
     * Get seller rating stats
     */
    static async getSellerStats(sellerId) {
        try {
            const [rows] = await pool.query(
                `SELECT 
                    COUNT(*) as total_reviews,
                    AVG(rating) as average_rating,
                    COUNT(DISTINCT listing_id) as sold_count
                 FROM marketplace_reviews 
                 WHERE reviewee_id = ?`,
                [sellerId]
            );
            
            return {
                total_reviews: rows[0]?.total_reviews || 0,
                average_rating: parseFloat(rows[0]?.average_rating || 0).toFixed(1),
                sold_count: rows[0]?.sold_count || 0
            };
        } catch (error) {
            logger.error('Error fetching seller stats:', error);
            return { total_reviews: 0, average_rating: 0, sold_count: 0 };
        }
    }

    /**
     * Get single listing with all media
     */
    static async getListingWithMedia(listingId) {
        try {
            const [listings] = await pool.query(
                `SELECT ml.*, u.username as seller_username, u.avatar_url as seller_avatar,
                        u.user_id as seller_id, u.email as seller_email
                 FROM marketplace_listings ml
                 JOIN users u ON ml.seller_id = u.user_id
                 WHERE ml.listing_id = ? AND ml.is_sold = FALSE`,
                [listingId]
            );

            if (listings.length === 0) return null;

            const listing = listings[0];

            // Get media files from listing_media table if it exists
            try {
                const [media] = await pool.query(
                    'SELECT * FROM listing_media WHERE listing_id = ? ORDER BY upload_order ASC',
                    [listingId]
                );
                listing.media = media;
                listing.image_urls = media
                    .filter(m => m.media_type === 'image')
                    .map(m => m.media_url);
            } catch (mediaError) {
                // If listing_media table doesn't exist, use image_url from marketplace_listings
                listing.media = [];
                listing.image_urls = listing.image_url ? [listing.image_url] : [];
            }

            // Try to increment view count if column exists
            try {
                await pool.query(
                    'UPDATE marketplace_listings SET view_count = COALESCE(view_count, 0) + 1 WHERE listing_id = ?',
                    [listingId]
                );
            } catch (viewError) {
                // view_count column might not exist, ignore error
                logger.warn('Could not increment view count for listing:', listingId);
            }

            return listing;
        } catch (error) {
            logger.error('Database error in getListingWithMedia:', error);
            throw new Error('Failed to fetch listing');
        }
    }

    /**
     * Create marketplace listing with multiple media files
     */
    static async createListingWithMedia(sellerId, listingData, mediaFiles = []) {
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();

            // Generate listing ID
            const [uuidResult] = await connection.query('SELECT UUID() as uuid');
            const listingId = uuidResult[0].uuid;

            // Use first media file as image_url if available
            const imageUrl = mediaFiles.length > 0 && mediaFiles[0].type === 'image' 
                ? mediaFiles[0].url 
                : null;

            // Insert listing - match your existing table columns
            await connection.query(
                `INSERT INTO marketplace_listings 
                (listing_id, seller_id, title, description, price, category, condition, campus, location, image_url) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    listingId,
                    sellerId,
                    listingData.title.trim(),
                    listingData.description.trim(),
                    parseFloat(listingData.price),
                    listingData.category || 'other',
                    listingData.condition || 'good',
                    listingData.campus,
                    listingData.location || '',
                    imageUrl
                ]
            );

            // Try to insert media files into listing_media table if it exists
            try {
                for (let i = 0; i < mediaFiles.length; i++) {
                    const media = mediaFiles[i];
                    
                    const [mediaUuidResult] = await connection.query('SELECT UUID() as uuid');
                    const mediaId = mediaUuidResult[0].uuid;
                    
                    await connection.query(
                        `INSERT INTO listing_media (media_id, listing_id, media_url, media_type, upload_order) 
                         VALUES (?, ?, ?, ?, ?)`,
                        [
                            mediaId,
                            listingId,
                            media.url,
                            media.type,
                            i
                        ]
                    );
                }
            } catch (mediaError) {
                // listing_media table might not exist, that's OK
                logger.warn('Could not insert media files:', mediaError.message);
            }

            await connection.commit();
            return listingId;
        } catch (error) {
            await connection.rollback();
            logger.error('Transaction error in createListingWithMedia:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Update listing status (using is_sold)
     */
    static async updateListingStatus(listingId, sellerId, isSold) {
        const soldAt = isSold ? new Date() : null;

        try {
            const [result] = await pool.query(
                `UPDATE marketplace_listings 
                 SET is_sold = ?, sold_at = ?, updated_at = CURRENT_TIMESTAMP 
                 WHERE listing_id = ? AND seller_id = ?`,
                [isSold ? 1 : 0, soldAt, listingId, sellerId]
            );

            return result.affectedRows > 0;
        } catch (error) {
            logger.error('Database error in updateListingStatus:', error);
            throw new Error('Failed to update listing status');
        }
    }

    /**
     * Delete listing (soft delete using is_sold flag)
     */
    static async deleteListing(listingId, sellerId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Mark as sold instead of status change
            const [result] = await connection.query(
                `UPDATE marketplace_listings 
                 SET is_sold = TRUE, updated_at = CURRENT_TIMESTAMP 
                 WHERE listing_id = ? AND seller_id = ?`,
                [listingId, sellerId]
            );

            if (result.affectedRows === 0) {
                throw new Error('Listing not found or unauthorized');
            }

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            logger.error('Transaction error in deleteListing:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Get user's listings
     */
    static async getUserListings(userId) {
        try {
            const [listings] = await pool.query(
                `SELECT ml.*
                 FROM marketplace_listings ml 
                 WHERE ml.seller_id = ? AND ml.is_sold = FALSE
                 ORDER BY ml.created_at DESC`,
                [userId]
            );

            return listings;
        } catch (error) {
            logger.error('Database error in getUserListings:', error);
            throw new Error('Failed to fetch user listings');
        }
    }

    /**
     * Get or create personal chat for marketplace
     */
    static async getOrCreateChat(userId1, userId2, listingId = null) {
        // Ensure consistent ordering for unique constraint
        const [participant1, participant2] = [userId1, userId2].sort();

        try {
            // Check if personal_chats table exists
            const [tables] = await pool.query("SHOW TABLES LIKE 'personal_chats'");
            if (tables.length === 0) {
                // Table doesn't exist, return a mock chat object
                return {
                    chat_id: 'temp-chat-' + Date.now(),
                    participant1_id: participant1,
                    participant2_id: participant2,
                    listing_id: listingId
                };
            }

            const [existingChats] = await pool.query(
                `SELECT * FROM personal_chats 
                 WHERE participant1_id = ? AND participant2_id = ? 
                 AND (listing_id = ? OR (listing_id IS NULL AND ? IS NULL))`,
                [participant1, participant2, listingId, listingId]
            );

            if (existingChats.length > 0) {
                return existingChats[0];
            }

            // Create new chat
            const [uuidResult] = await pool.query('SELECT UUID() as uuid');
            const chatId = uuidResult[0].uuid;
            
            await pool.query(
                `INSERT INTO personal_chats (chat_id, participant1_id, participant2_id, listing_id) 
                 VALUES (?, ?, ?, ?)`,
                [chatId, participant1, participant2, listingId]
            );

            return {
                chat_id: chatId,
                participant1_id: participant1,
                participant2_id: participant2,
                listing_id: listingId
            };
        } catch (error) {
            logger.error('Database error in getOrCreateChat:', error);
            // Return a mock chat object if table doesn't exist
            return {
                chat_id: 'temp-chat-' + Date.now(),
                participant1_id: participant1,
                participant2_id: participant2,
                listing_id: listingId
            };
        }
    }

    /**
     * Send message in personal chat
     */
    static async sendMessage(chatId, senderId, content) {
        if (!content || content.trim().length === 0) {
            throw new Error('Message content is required');
        }

        if (content.length > 1000) {
            throw new Error('Message too long (max 1000 characters)');
        }

        // Check if messages table exists
        const [tables] = await pool.query("SHOW TABLES LIKE 'messages'");
        if (tables.length === 0) {
            // Table doesn't exist, just return a mock message ID
            return 'temp-message-' + Date.now();
        }

        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            // Generate message ID
            const [uuidResult] = await connection.query('SELECT UUID() as uuid');
            const messageId = uuidResult[0].uuid;

            // Insert message
            await connection.query(
                `INSERT INTO messages (message_id, conversation_id, sender_id, type, content) 
                 VALUES (?, ?, ?, 'text', ?)`,
                [messageId, chatId, senderId, content.trim()]
            );

            // Update chat last message if personal_chats table exists
            try {
                const truncatedContent = content.length > 200 ? content.substring(0, 197) + '...' : content;
                await connection.query(
                    `UPDATE personal_chats 
                     SET last_message = ?, last_message_time = CURRENT_TIMESTAMP 
                     WHERE chat_id = ?`,
                    [truncatedContent, chatId]
                );
            } catch (chatError) {
                // personal_chats table might not exist or have different structure
                logger.warn('Could not update chat last message:', chatError.message);
            }

            await connection.commit();
            return messageId;
        } catch (error) {
            await connection.rollback();
            logger.error('Transaction error in sendMessage:', error);
            throw new Error('Failed to send message');
        } finally {
            connection.release();
        }
    }

    /**
     * Get chat messages
     */
    static async getChatMessages(chatId, limit = 50) {
        try {
            // Check if messages table exists
            const [tables] = await pool.query("SHOW TABLES LIKE 'messages'");
            if (tables.length === 0) {
                return [];
            }

            const [messages] = await pool.query(
                `SELECT m.*, u.username as sender_username, u.avatar_url as sender_avatar
                 FROM messages m
                 JOIN users u ON m.sender_id = u.user_id
                 WHERE m.conversation_id = ?
                 ORDER BY m.sent_at DESC
                 LIMIT ?`,
                [chatId, limit]
            );

            return messages.reverse(); // Return in chronological order
        } catch (error) {
            logger.error('Database error in getChatMessages:', error);
            return [];
        }
    }

    /**
     * Get user's personal chats
     */
    static async getUserChats(userId) {
        try {
            // Check if personal_chats table exists
            const [tables] = await pool.query("SHOW TABLES LIKE 'personal_chats'");
            if (tables.length === 0) {
                return [];
            }

            const [chats] = await pool.query(
                `SELECT pc.*, 
                        u1.username as participant1_name,
                        u2.username as participant2_name,
                        ml.title as listing_title,
                        ml.listing_id,
                        CASE 
                            WHEN pc.participant1_id = ? THEN u2.avatar_url
                            ELSE u1.avatar_url
                        END as other_user_avatar,
                        CASE 
                            WHEN pc.participant1_id = ? THEN u2.username
                            ELSE u1.username
                        END as other_user_name
                 FROM personal_chats pc
                 JOIN users u1 ON pc.participant1_id = u1.user_id
                 JOIN users u2 ON pc.participant2_id = u2.user_id
                 LEFT JOIN marketplace_listings ml ON pc.listing_id = ml.listing_id
                 WHERE (pc.participant1_id = ? OR pc.participant2_id = ?)
                 ORDER BY pc.last_message_time DESC`,
                [userId, userId, userId, userId]
            );

            return chats;
        } catch (error) {
            logger.error('Database error in getUserChats:', error);
            return [];
        }
    }

    /**
     * Mark messages as read
     */
    static async markMessagesAsRead(chatId, userId) {
        try {
            // Check if messages table exists
            const [tables] = await pool.query("SHOW TABLES LIKE 'messages'");
            if (tables.length === 0) {
                return true;
            }

            await pool.query(
                `UPDATE messages m
                 SET m.is_read = TRUE
                 WHERE m.conversation_id = ? 
                 AND m.sender_id != ?
                 AND m.is_read = FALSE`,
                [chatId, userId]
            );

            return true;
        } catch (error) {
            logger.error('Database error in markMessagesAsRead:', error);
            return false;
        }
    }

    /**
     * Get unread message count
     */
    static async getUnreadCount(userId) {
        try {
            // Check if messages table exists
            const [tables] = await pool.query("SHOW TABLES LIKE 'messages'");
            if (tables.length === 0) {
                return 0;
            }

            const [result] = await pool.query(
                `SELECT COUNT(*) as unread_count
                 FROM messages m
                 WHERE (EXISTS (
                    SELECT 1 FROM personal_chats pc 
                    WHERE pc.chat_id = m.conversation_id 
                    AND (pc.participant1_id = ? OR pc.participant2_id = ?)
                 ))
                 AND m.sender_id != ?
                 AND m.is_read = FALSE`,
                [userId, userId, userId]
            );

            return result[0]?.unread_count || 0;
        } catch (error) {
            logger.error('Database error in getUnreadCount:', error);
            return 0;
        }
    }

    /**
     * Toggle favorite/wishlist
     */
    static async toggleFavorite(userId, listingId) {
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();

            const [existing] = await connection.query(
                'SELECT * FROM marketplace_favorites WHERE user_id = ? AND listing_id = ?',
                [userId, listingId]
            );

            if (existing.length > 0) {
                await connection.query(
                    'DELETE FROM marketplace_favorites WHERE user_id = ? AND listing_id = ?',
                    [userId, listingId]
                );
                await connection.commit();
                return { favorited: false };
            } else {
                const favoriteId = require('crypto').randomUUID();
                await connection.query(
                    'INSERT INTO marketplace_favorites (favorite_id, user_id, listing_id) VALUES (?, ?, ?)',
                    [favoriteId, userId, listingId]
                );
                await connection.commit();
                return { favorited: true };
            }
        } catch (error) {
            await connection.rollback();
            logger.error('Transaction error in toggleFavorite:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Seller Favoriting
     */
    static async toggleSellerFavorite(userId, sellerId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [existing] = await connection.query(
                'SELECT * FROM marketplace_favorite_sellers WHERE user_id = ? AND seller_id = ?',
                [userId, sellerId]
            );

            if (existing.length > 0) {
                await connection.query(
                    'DELETE FROM marketplace_favorite_sellers WHERE user_id = ? AND seller_id = ?',
                    [userId, sellerId]
                );
                await connection.commit();
                return { favorited: false };
            } else {
                const favoriteId = require('crypto').randomUUID();
                await connection.query(
                    'INSERT INTO marketplace_favorite_sellers (favorite_id, user_id, seller_id) VALUES (?, ?, ?)',
                    [favoriteId, userId, sellerId]
                );
                await connection.commit();
                return { favorited: true };
            }
        } catch (error) {
            await connection.rollback();
            logger.error('Transaction error in toggleSellerFavorite:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    static async getFavoriteSellers(userId) {
        const [rows] = await pool.query(
            `SELECT u.*, 
                    (SELECT AVG(rating) FROM marketplace_reviews WHERE reviewee_id = u.user_id) as average_rating
             FROM marketplace_favorite_sellers mfs
             JOIN users u ON mfs.seller_id = u.user_id
             WHERE mfs.user_id = ?`,
            [userId]
        );
        return rows;
    }


    /**
     * Get user's favorites
     */
    static async getUserFavorites(userId) {
        try {
            // Check if marketplace_favorites table exists
            const [tables] = await pool.query("SHOW TABLES LIKE 'marketplace_favorites'");
            if (tables.length === 0) {
                return [];
            }

            const [favorites] = await pool.query(
                `SELECT ml.*, mf.created_at as favorited_at
                 FROM marketplace_favorites mf
                 JOIN marketplace_listings ml ON mf.listing_id = ml.listing_id
                 WHERE mf.user_id = ? AND ml.is_sold = FALSE
                 ORDER BY mf.created_at DESC`,
                [userId]
            );

            return favorites;
        } catch (error) {
            logger.error('Database error in getUserFavorites:', error);
            return [];
        }
    }

    /**
     * Get lost & found items
     */
    static async getLostFoundItems(filters = {}) {
        try {
            // Check if lost_found_items table exists
            const [tables] = await pool.query("SHOW TABLES LIKE 'lost_found_items'");
            if (tables.length === 0) {
                return [];
            }

            let query = `
                SELECT lfi.*, u.username as reporter_username, u.avatar_url as reporter_avatar
                FROM lost_found_items lfi
                JOIN users u ON lfi.reporter_id = u.user_id
                WHERE lfi.status = 'open'
            `;
            const params = [];

            if (filters.campus && this.isValidCampus(filters.campus)) {
                query += ' AND lfi.campus = ?';
                params.push(filters.campus);
            }

            if (filters.type && ['lost', 'found'].includes(filters.type)) {
                query += ' AND lfi.type = ?';
                params.push(filters.type);
            }

            query += ' ORDER BY lfi.created_at DESC LIMIT 20';

            const [items] = await pool.query(query, params);
            return items;
        } catch (error) {
            logger.error('Database error in getLostFoundItems:', error);
            return [];
        }
    }

    /**
     * Get skill offers
     */
    static async getSkillOffers(filters = {}) {
        try {
            // Check if skill_offers table exists
            const [tables] = await pool.query("SHOW TABLES LIKE 'skill_offers'");
            if (tables.length === 0) {
                return [];
            }

            let query = `
                SELECT so.*, u.username, u.avatar_url
                FROM skill_offers so
                JOIN users u ON so.user_id = u.user_id
                WHERE so.is_active = TRUE
            `;
            const params = [];

            if (filters.campus && this.isValidCampus(filters.campus)) {
                query += ' AND so.campus = ?';
                params.push(filters.campus);
            }

            if (filters.category) {
                query += ' AND so.category = ?';
                params.push(filters.category);
            }

            query += ' ORDER BY so.created_at DESC LIMIT 20';

            const [offers] = await pool.query(query, params);
            return offers;
        } catch (error) {
            logger.error('Database error in getSkillOffers:', error);
            return [];
        }
    }

    /**
     * Create a new marketplace order
     */
    static async createOrder(buyerId, sellerId, listingId, price, orderDetails = '') {
        try {
            const orderId = require('crypto').randomUUID();
            await pool.query(
                `INSERT INTO marketplace_orders
                 (order_id, buyer_id, seller_id, listing_id, price, order_details, status, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
                [orderId, buyerId, sellerId, listingId, price, orderDetails || '']
            );
            return orderId;
        } catch (error) {
            logger.error('Database error in createOrder:', error);
            throw error;
        }
    }

    /**
     * Get orders for a user (as buyer or seller)
     */
    static async getOrders(userId) {
        try {
            const [orders] = await pool.query(
                `SELECT o.*,
                        l.title AS listing_title,
                        l.image_url,
                        buyer.username  AS buyer_username,
                        buyer.avatar_url AS buyer_avatar,
                        seller.username  AS seller_username,
                        seller.avatar_url AS seller_avatar,
                        CASE
                            WHEN o.buyer_id = ? THEN o.seller_id
                            ELSE o.buyer_id
                        END AS other_user_id,
                        CASE
                            WHEN o.buyer_id = ? THEN seller.username
                            ELSE buyer.username
                        END AS other_username,
                        CASE
                            WHEN o.buyer_id = ? THEN seller.avatar_url
                            ELSE buyer.avatar_url
                        END AS other_avatar
                 FROM marketplace_orders o
                 JOIN marketplace_listings l  ON o.listing_id = l.listing_id
                 JOIN users buyer             ON o.buyer_id   = buyer.user_id
                 JOIN users seller            ON o.seller_id  = seller.user_id
                 WHERE o.buyer_id = ? OR o.seller_id = ?
                 ORDER BY o.created_at DESC`,
                [userId, userId, userId, userId, userId]
            );
            return orders;
        } catch (error) {
            logger.error('Database error in getOrders:', error);
            return [];
        }
    }

    /**
     * VALIDATION HELPERS
     */
    static isValidCategory(category) {
        const validCategories = ['electronics', 'books', 'clothing', 'furniture', 'services', 
                                'student_market', 'secondhand', 'sports', 'other'];
        return validCategories.includes(category);
    }

    static isValidCampus(campus) {
        const validCampuses = ['main_campus', 'north_campus', 'south_campus', 'downtown'];
        return validCampuses.includes(campus);
    }

    static isValidCondition(condition) {
        const validConditions = ['new', 'like_new', 'good', 'fair', 'poor'];
        return validConditions.includes(condition);
    }

    static isValidMediaType(type) {
        return ['image', 'video'].includes(type);
    }

    /**
     * Get counts for dashboard
     */
    static async getCounts(userId) {
        try {
            let favoritesCount = 0;
            let wishlistCount = 0;
            let notificationCount = 0;

            // Check and count favorites
            const [favoritesTable] = await pool.query("SHOW TABLES LIKE 'marketplace_favorites'");
            if (favoritesTable.length > 0) {
                const [[cartCount]] = await pool.query('SELECT COUNT(*) as count FROM marketplace_favorites WHERE user_id = ?', [userId]);
                favoritesCount = cartCount.count || 0;
            }

            // Check and count wishlist
            const [wishlistTable] = await pool.query("SHOW TABLES LIKE 'wishlist'");
            if (wishlistTable.length > 0) {
                const [[wishlistResult]] = await pool.query('SELECT COUNT(*) as count FROM wishlist WHERE user_id = ?', [userId]);
                wishlistCount = wishlistResult?.count || 0;
            }

            // Check and count notifications
            const [notificationsTable] = await pool.query("SHOW TABLES LIKE 'notifications'");
            if (notificationsTable.length > 0) {
                const [[notificationResult]] = await pool.query('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE', [userId]);
                notificationCount = notificationResult?.count || 0;
            }

            return {
                favoritesCount,
                wishlistCount,
                notificationCount
            };
        } catch (error) {
            logger.error('Database error in getCounts:', error);
            return {
                favoritesCount: 0,
                wishlistCount: 0,
                notificationCount: 0
            };
        }
    }
}

module.exports = Marketplace;