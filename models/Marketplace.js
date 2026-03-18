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
     * Get recommended listings for a user with advanced algorithm
     */
    static async getRecommendations(userId, campus = 'main_campus', limit = 6) {
        try {
            let recommendations = [];

            if (userId) {
                // Advanced algorithm for logged-in users
                // 1. Get user's interaction history (favorites, views, purchases)
                const [userInteractions] = await pool.query(`
                    SELECT DISTINCT ml.category, ml.price, ml.condition
                    FROM marketplace_listings ml
                    LEFT JOIN marketplace_favorites mf ON ml.listing_id = mf.listing_id AND mf.user_id = ?
                    LEFT JOIN marketplace_orders mo ON ml.listing_id = mo.listing_id AND mo.buyer_id = ?
                    WHERE (mf.user_id IS NOT NULL OR mo.buyer_id IS NOT NULL)
                    AND ml.is_sold = FALSE
                    ORDER BY ml.created_at DESC
                    LIMIT 20
                `, [userId, userId]);

                // 2. Calculate user preferences
                const categoryPrefs = {};
                const pricePrefs = { min: Infinity, max: 0, avg: 0 };
                const conditionPrefs = {};

                userInteractions.forEach(item => {
                    // Category preferences
                    categoryPrefs[item.category] = (categoryPrefs[item.category] || 0) + 1;

                    // Price preferences
                    pricePrefs.min = Math.min(pricePrefs.min, item.price);
                    pricePrefs.max = Math.max(pricePrefs.max, item.price);
                    pricePrefs.avg = pricePrefs.avg ? (pricePrefs.avg + item.price) / 2 : item.price;

                    // Condition preferences
                    conditionPrefs[item.condition] = (conditionPrefs[item.condition] || 0) + 1;
                });

                // 3. Find most preferred categories
                const topCategories = Object.entries(categoryPrefs)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 3)
                    .map(([cat]) => cat);

                // 4. Build recommendation query with scoring
                let query = `
                    SELECT ml.*,
                           u.username as seller_username,
                           u.avatar_url as seller_avatar,
                           (SELECT AVG(rating) FROM marketplace_reviews WHERE reviewee_id = ml.seller_id) as seller_rating,
                           (SELECT COUNT(*) FROM marketplace_reviews WHERE reviewee_id = ml.seller_id) as seller_review_count,
                           (
                               CASE
                                   WHEN ml.category IN (${topCategories.map(() => '?').join(',')}) THEN 10
                                   ELSE 0
                               END +
                               CASE
                                   WHEN ml.price BETWEEN ? AND ? THEN 5
                                   ELSE 0
                               END +
                               CASE
                                   WHEN ml.condition = ? THEN 3
                                   ELSE 0
                               END +
                               (ml.view_count * 0.1) +
                               (COALESCE((SELECT AVG(rating) FROM marketplace_reviews WHERE reviewee_id = ml.seller_id), 0) * 2)
                           ) as recommendation_score
                    FROM marketplace_listings ml
                    JOIN users u ON ml.seller_id = u.user_id
                    WHERE ml.is_sold = FALSE
                    AND ml.seller_id != ?
                    AND (ml.campus = ? OR ml.campus = 'main_campus')
                    ORDER BY recommendation_score DESC, ml.created_at DESC
                    LIMIT ?
                `;

                const params = [
                    ...topCategories,
                    Math.max(0, pricePrefs.avg * 0.7), // 70% of avg price
                    pricePrefs.avg * 1.3, // 130% of avg price
                    Object.keys(conditionPrefs).sort((a,b) => conditionPrefs[b] - conditionPrefs[a])[0] || 'good',
                    userId,
                    campus,
                    limit
                ];

                const [result] = await pool.query(query, params);
                recommendations = result;
            }

            // Fallback for non-logged-in users or if no personalized recommendations
            if (recommendations.length < limit) {
                const fallbackLimit = limit - recommendations.length;
                const fallbackQuery = `
                    SELECT ml.*, u.username as seller_username, u.avatar_url as seller_avatar,
                           (SELECT AVG(rating) FROM marketplace_reviews WHERE reviewee_id = ml.seller_id) as seller_rating,
                           (SELECT COUNT(*) FROM marketplace_reviews WHERE reviewee_id = ml.seller_id) as seller_review_count
                    FROM marketplace_listings ml
                    JOIN users u ON ml.seller_id = u.user_id
                    WHERE ml.is_sold = FALSE
                    AND (ml.campus = ? OR ml.campus = 'main_campus')
                    ${userId ? 'AND ml.seller_id != ?' : ''}
                    AND ml.listing_id NOT IN (${recommendations.map(() => '?').join(',') || 'NULL'})
                    ORDER BY ml.view_count DESC, ml.created_at DESC
                    LIMIT ?
                `;

                const params = [campus];
                if (userId) params.push(userId);
                params.push(...recommendations.map(r => r.listing_id));
                params.push(fallbackLimit);

                const [fallback] = await pool.query(fallbackQuery, params);
                recommendations = [...recommendations, ...fallback];
            }

            // Add media to all recommendations
            for (let listing of recommendations) {
                const [media] = await pool.query(
                    'SELECT media_url FROM listing_media WHERE listing_id = ? ORDER BY upload_order LIMIT 1',
                    [listing.listing_id]
                );
                listing.media_url = media[0]?.media_url || listing.image_url || '/images/default-listing.jpg';
            }

            return recommendations;
        } catch (error) {
            logger.error('Database error in getRecommendations:', error);
            // Fallback to simple recommendations
            try {
                const query = `
                    SELECT ml.*, u.username as seller_username, u.avatar_url as seller_avatar,
                           (SELECT AVG(rating) FROM marketplace_reviews WHERE reviewee_id = ml.seller_id) as seller_rating
                    FROM marketplace_listings ml
                    JOIN users u ON ml.seller_id = u.user_id
                    WHERE ml.is_sold = FALSE
                    AND (ml.campus = ? OR ml.campus = 'main_campus')
                    ${userId ? 'AND ml.seller_id != ?' : ''}
                    ORDER BY ml.view_count DESC, ml.created_at DESC
                    LIMIT ?
                `;
                const params = [campus];
                if (userId) params.push(userId);
                params.push(limit);

                const [listings] = await pool.query(query, params);

                // Add media
                for (let listing of listings) {
                    const [media] = await pool.query(
                        'SELECT media_url FROM listing_media WHERE listing_id = ? ORDER BY upload_order LIMIT 1',
                        [listing.listing_id]
                    );
                    listing.media_url = media[0]?.media_url || listing.image_url || '/images/default-listing.jpg';
                }

                return listings;
            } catch (fallbackError) {
                logger.error('Fallback recommendation error:', fallbackError);
                return [];
            }
        }
    }

    /**
     * Generate mock marketplace data for testing
     */
    static generateMockData(count = 10) {
        const categories = ['electronics', 'books', 'clothing', 'furniture', 'services', 'sports', 'home', 'other'];
        const conditions = ['new', 'like_new', 'good', 'fair'];
        const campuses = ['main_campus', 'west_campus', 'east_campus', 'north_campus'];
        const titles = [
            'iPhone 12 Pro Max', 'Calculus Textbook', 'Nike Air Max', 'Study Desk', 'Tutoring Services',
            'MacBook Pro 2023', 'Psychology Notes', 'Levi\'s Jeans', 'Dorm Fridge', 'Photography Service',
            'Gaming Laptop', 'Chemistry Lab Manual', 'Adidas Sneakers', 'Bookshelf', 'Math Tutoring',
            'Wireless Headphones', 'History Textbook', 'Winter Jacket', 'Coffee Maker', 'Logo Design'
        ];
        const descriptions = [
            'Barely used, in excellent condition. Comes with original packaging.',
            'Essential textbook for your course. Highlighted notes included.',
            'Comfortable and stylish. Perfect for campus life.',
            'Solid wood construction. Great for studying or storage.',
            'Professional tutoring services. Flexible scheduling available.',
            'Latest model with M2 chip. Perfect for development work.',
            'Comprehensive study guide with practice problems.',
            'Classic fit, durable material. Campus approved style.',
            'Compact and efficient. Quiet operation for dorm rooms.',
            'High-quality photography for events and portraits.'
        ];

        const mockListings = [];

        for (let i = 0; i < count; i++) {
            const category = categories[Math.floor(Math.random() * categories.length)];
            const basePrice = this.getBasePriceForCategory(category);
            const price = Math.round(basePrice * (0.5 + Math.random() * 1.5)); // 50-200% of base price

            mockListings.push({
                listing_id: `mock_${crypto.randomUUID()}`,
                seller_id: `user_${Math.floor(Math.random() * 100) + 1}`,
                title: titles[Math.floor(Math.random() * titles.length)],
                description: descriptions[Math.floor(Math.random() * descriptions.length)],
                price: price,
                category: category,
                condition: conditions[Math.floor(Math.random() * conditions.length)],
                campus: campuses[Math.floor(Math.random() * campuses.length)],
                location: `Building ${Math.floor(Math.random() * 20) + 1}, Room ${Math.floor(Math.random() * 500) + 100}`,
                is_sold: false,
                status: 'active',
                view_count: Math.floor(Math.random() * 100),
                created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Last 30 days
                seller_username: `student${Math.floor(Math.random() * 1000) + 1}`,
                seller_avatar: `/uploads/avatars/default.png`,
                seller_rating: (3 + Math.random() * 2).toFixed(1), // 3.0-5.0 rating
                seller_review_count: Math.floor(Math.random() * 20),
                is_favorited: Math.random() > 0.7, // 30% favorited
                image_urls: [`/images/mock-listing-${Math.floor(Math.random() * 5) + 1}.jpg`],
                media_url: `/images/mock-listing-${Math.floor(Math.random() * 5) + 1}.jpg`
            });
        }

        return mockListings;
    }

    /**
     * Get base price for category
     */
    static getBasePriceForCategory(category) {
        const priceMap = {
            'electronics': 15000,
            'books': 2000,
            'clothing': 3000,
            'furniture': 8000,
            'services': 5000,
            'sports': 4000,
            'home': 2500,
            'other': 1000
        };
        return priceMap[category] || 1000;
    }

    /**
     * Get listings with option to include mock data
     */
    static async getListingsWithMock(filters = {}, includeMock = false) {
        try {
            const realListings = await this.getListings(filters);

            if (includeMock && realListings.listings.length < filters.limit) {
                const mockCount = Math.min(
                    filters.limit - realListings.listings.length,
                    5 // Max 5 mock items
                );
                const mockListings = this.generateMockData(mockCount);

                // Mark mock listings
                mockListings.forEach(listing => {
                    listing.is_mock = true;
                });

                realListings.listings = [...realListings.listings, ...mockListings];
                realListings.total += mockCount;
            }

            return realListings;
        } catch (error) {
            logger.error('Error in getListingsWithMock:', error);

            // Return mock data as fallback
            if (includeMock) {
                const mockListings = this.generateMockData(filters.limit || 10);
                return {
                    listings: mockListings,
                    total: mockListings.length,
                    limit: filters.limit || 10,
                    offset: filters.offset || 0,
                    hasMore: false
                };
            }

            throw error;
        }
    }

    /**
     * Get base price for category
     */
    static getBasePriceForCategory(category) {
        const priceMap = {
            'electronics': 15000,
            'books': 2000,
            'clothing': 3000,
            'furniture': 8000,
            'services': 5000,
            'sports': 4000,
            'home': 2500,
            'other': 1000
        };
        return priceMap[category] || 1000;
    }

    /**
     * Get listings with option to include mock data
     */
    static async getListingsWithMock(filters = {}, includeMock = false) {
        try {
            const realListings = await this.getListings(filters);

            if (includeMock && realListings.listings.length < filters.limit) {
                const mockCount = Math.min(
                    filters.limit - realListings.listings.length,
                    5 // Max 5 mock items
                );
                const mockListings = this.generateMockData(mockCount);

                // Mark mock listings
                mockListings.forEach(listing => {
                    listing.is_mock = true;
                });

                realListings.listings = [...realListings.listings, ...mockListings];
                realListings.total += mockCount;
            }

            return realListings;
        } catch (error) {
            logger.error('Error in getListingsWithMock:', error);

            // Return mock data as fallback
            if (includeMock) {
                const mockListings = this.generateMockData(filters.limit || 10);
                return {
                    listings: mockListings,
                    total: mockListings.length,
                    limit: filters.limit || 10,
                    offset: filters.offset || 0,
                    hasMore: false
                };
            }

            throw error;
        }
    }
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
     * Create order – atomic MySQL transaction with row-level locking.
     * Derives ALL critical values server-side; trusts nothing from client.
     * Prices stored in KES.
     */
    static async createOrder(buyerId, listingId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Lock listing row to prevent race conditions
            const [[listing]] = await connection.query(
                `SELECT seller_id, price, title, description, \`condition\`, status
                 FROM marketplace_listings WHERE listing_id = ? FOR UPDATE`,
                [listingId]
            );

            if (!listing)                          { throw Object.assign(new Error('Listing not found'),          { code: 'LISTING_NOT_FOUND' }); }
            if (listing.status === 'sold')          { throw Object.assign(new Error('Item already sold'),          { code: 'LISTING_SOLD' }); }
            if (listing.status !== 'active')        { throw Object.assign(new Error('Listing is not active'),      { code: 'LISTING_NOT_ACTIVE' }); }
            if (listing.seller_id === buyerId)      { throw Object.assign(new Error('Cannot buy your own item'),   { code: 'CANNOT_BUY_OWN' }); }

            // Prevent duplicate active orders
            const [[dup]] = await connection.query(
                `SELECT COUNT(*) AS cnt FROM marketplace_orders
                 WHERE listing_id = ? AND buyer_id = ? AND status IN ('pending','accepted')`,
                [listingId, buyerId]
            );
            if (dup.cnt > 0) { throw Object.assign(new Error('You already have an active order for this item'), { code: 'ORDER_EXISTS' }); }

            const orderId   = require('crypto').randomUUID();
            const logId     = require('crypto').randomUUID();

            // Insert order – snapshot listing data, KES currency
            await connection.query(
                `INSERT INTO marketplace_orders
                 (order_id, listing_id, buyer_id, seller_id,
                  listing_title, listing_description, price_at_time, currency, item_condition,
                  status)
                 VALUES (?, ?, ?, ?,
                         ?, ?, ?, 'KES', ?,
                         'pending')`,
                [
                    orderId, listingId, buyerId, listing.seller_id,
                    listing.title, listing.description, listing.price, listing.condition
                ]
            );

            // Lock listing so other buyers can't order simultaneously
            await connection.query(
                `UPDATE marketplace_listings SET status = 'pending' WHERE listing_id = ?`,
                [listingId]
            );

            // Write immutable audit log entry
            await connection.query(
                `INSERT INTO order_audit_log (log_id, order_id, actor_id, action, new_status)
                 VALUES (?, ?, ?, 'ORDER_CREATED', 'pending')`,
                [logId, orderId, buyerId]
            );

            await connection.commit();
            return orderId;
        } catch (error) {
            await connection.rollback();
            logger.error('Transaction error in createOrder:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Update order status with business-rule enforcement.
     * - accepted / rejected → seller only (from pending)
     * - cancelled           → buyer or seller (from pending/accepted)
     * - completed           → both parties confirmed meetup
     */
    static async updateOrderStatus(orderId, actorId, newStatus, reason = null) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Lock order row
            const [[order]] = await connection.query(
                `SELECT order_id, status, buyer_id, seller_id, listing_id,
                        meetup_confirmed_by_buyer, meetup_confirmed_by_seller
                 FROM marketplace_orders WHERE order_id = ? FOR UPDATE`,
                [orderId]
            );
            if (!order) throw Object.assign(new Error('Order not found'), { code: 'ORDER_NOT_FOUND' });

            const { status: curr, buyer_id, seller_id, listing_id } = order;
            const logId = require('crypto').randomUUID();

            let updateSql = '';
            let updateParams = [];
            let reactivateListing = false;

            if (newStatus === 'accepted') {
                if (actorId !== seller_id)       throw Object.assign(new Error('Only seller can accept'), { code: 'UNAUTHORIZED' });
                if (curr !== 'pending')          throw Object.assign(new Error('Can only accept pending orders'), { code: 'INVALID_TRANSITION' });
                updateSql = 'UPDATE marketplace_orders SET status=?, accepted_at=NOW(), last_action_by=?, last_action_at=NOW() WHERE order_id=?';
                updateParams = ['accepted', actorId, orderId];

            } else if (newStatus === 'rejected') {
                if (actorId !== seller_id)       throw Object.assign(new Error('Only seller can reject'), { code: 'UNAUTHORIZED' });
                if (curr !== 'pending')          throw Object.assign(new Error('Can only reject pending orders'), { code: 'INVALID_TRANSITION' });
                updateSql = 'UPDATE marketplace_orders SET status=?, rejected_at=NOW(), last_action_by=?, last_action_at=NOW() WHERE order_id=?';
                updateParams = ['rejected', actorId, orderId];
                reactivateListing = true;

            } else if (newStatus === 'cancelled') {
                if (actorId !== buyer_id && actorId !== seller_id)
                    throw Object.assign(new Error('Unauthorized'), { code: 'UNAUTHORIZED' });
                if (!['pending','accepted'].includes(curr))
                    throw Object.assign(new Error('Cannot cancel at this stage'), { code: 'INVALID_TRANSITION' });
                updateSql = `UPDATE marketplace_orders
                             SET status=?, cancelled_at=NOW(), cancelled_by=?, cancellation_reason=?,
                                 last_action_by=?, last_action_at=NOW()
                             WHERE order_id=?`;
                updateParams = ['cancelled', actorId, reason, actorId, orderId];
                reactivateListing = true;

            } else if (newStatus === 'completed') {
                if (curr !== 'accepted')
                    throw Object.assign(new Error('Can only complete accepted orders'), { code: 'INVALID_TRANSITION' });
                if (!order.meetup_confirmed_by_buyer || !order.meetup_confirmed_by_seller)
                    throw Object.assign(new Error('Both parties must confirm the meetup first'), { code: 'MEETUP_NOT_CONFIRMED' });
                updateSql = 'UPDATE marketplace_orders SET status=?, completed_at=NOW(), last_action_by=?, last_action_at=NOW() WHERE order_id=?';
                updateParams = ['completed', actorId, orderId];
                // Mark listing as sold
                await connection.query(
                    `UPDATE marketplace_listings SET status='sold', is_sold=1, sold_at=NOW() WHERE listing_id=?`,
                    [listing_id]
                );

            } else if (newStatus === 'disputed') {
                if (actorId !== buyer_id && actorId !== seller_id)
                    throw Object.assign(new Error('Unauthorized'), { code: 'UNAUTHORIZED' });
                if (curr !== 'accepted')
                    throw Object.assign(new Error('Can only dispute accepted orders'), { code: 'INVALID_TRANSITION' });
                updateSql = 'UPDATE marketplace_orders SET status=?, disputed_at=NOW(), last_action_by=?, last_action_at=NOW() WHERE order_id=?';
                updateParams = ['disputed', actorId, orderId];

            } else {
                throw Object.assign(new Error('Invalid status'), { code: 'INVALID_STATUS' });
            }

            await connection.query(updateSql, updateParams);

            if (reactivateListing) {
                await connection.query(
                    `UPDATE marketplace_listings SET status='active' WHERE listing_id=? AND is_sold=0`,
                    [listing_id]
                );
            }

            // Audit log
            await connection.query(
                `INSERT INTO order_audit_log (log_id, order_id, actor_id, action, old_status, new_status)
                 VALUES (?, ?, ?, 'STATUS_CHANGE', ?, ?)`,
                [logId, orderId, actorId, curr, newStatus]
            );

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            logger.error('Transaction error in updateOrderStatus:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Confirm meetup attendance (buyer or seller)
     * When both confirm, order can be completed.
     */
    static async confirmMeetup(orderId, userId) {
        const [[order]] = await pool.query(
            `SELECT order_id, buyer_id, seller_id, status,
                    meetup_confirmed_by_buyer, meetup_confirmed_by_seller
             FROM marketplace_orders WHERE order_id = ?`,
            [orderId]
        );
        if (!order) throw new Error('Order not found');
        if (order.status !== 'accepted') throw new Error('Can only confirm meetup for accepted orders');

        let field = null;
        if (userId === order.buyer_id)  field = 'meetup_confirmed_by_buyer';
        if (userId === order.seller_id) field = 'meetup_confirmed_by_seller';
        if (!field) throw Object.assign(new Error('Unauthorized'), { code: 'UNAUTHORIZED' });

        await pool.query(
            `UPDATE marketplace_orders SET \`${field}\` = 1 WHERE order_id = ?`,
            [orderId]
        );

        // Reload to check both confirmed
        const [[updated]] = await pool.query(
            `SELECT meetup_confirmed_by_buyer, meetup_confirmed_by_seller FROM marketplace_orders WHERE order_id = ?`,
            [orderId]
        );
        return {
            buyerConfirmed:  !!updated.meetup_confirmed_by_buyer,
            sellerConfirmed: !!updated.meetup_confirmed_by_seller,
            bothConfirmed:   !!(updated.meetup_confirmed_by_buyer && updated.meetup_confirmed_by_seller)
        };
    }

    /**
     * Get single order details – only accessible by buyer or seller
     */
    static async getOrderById(orderId, userId) {
        try {
            const [rows] = await pool.query(
                `SELECT o.*,
                        lm.media_url AS listing_image,
                        buyer.username   AS buyer_username,
                        buyer.avatar_url AS buyer_avatar,
                        seller.username  AS seller_username,
                        seller.avatar_url AS seller_avatar
                 FROM marketplace_orders o
                 LEFT JOIN listing_media lm ON lm.listing_id = o.listing_id AND lm.upload_order = 0
                 JOIN users buyer   ON o.buyer_id  = buyer.user_id
                 JOIN users seller  ON o.seller_id = seller.user_id
                 WHERE o.order_id = ?
                   AND (o.buyer_id = ? OR o.seller_id = ?)`,
                [orderId, userId, userId]
            );
            return rows[0] || null;
        } catch (error) {
            logger.error('Database error in getOrderById:', error);
            return null;
        }
    }

    /**
     * Get orders for a user (as buyer or seller) with images – KES prices
     */
    static async getOrders(userId) {
        try {
            const [orders] = await pool.query(
                `SELECT o.*,
                        COALESCE(lm.media_url, ml.image_url) AS image_url,
                        buyer.username   AS buyer_username,
                        buyer.avatar_url AS buyer_avatar,
                        seller.username  AS seller_username,
                        seller.avatar_url AS seller_avatar,
                        CASE WHEN o.buyer_id = ? THEN o.seller_id  ELSE o.buyer_id      END AS other_user_id,
                        CASE WHEN o.buyer_id = ? THEN seller.username  ELSE buyer.username  END AS other_username,
                        CASE WHEN o.buyer_id = ? THEN seller.avatar_url ELSE buyer.avatar_url END AS other_avatar
                 FROM marketplace_orders o
                 JOIN marketplace_listings ml ON o.listing_id = ml.listing_id
                 LEFT JOIN listing_media lm   ON lm.listing_id = o.listing_id AND lm.upload_order = 0
                 JOIN users buyer             ON o.buyer_id  = buyer.user_id
                 JOIN users seller            ON o.seller_id = seller.user_id
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