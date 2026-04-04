const pool = require('../config/database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const admin = require('../config/firebase-admin');

class Marketplace {
    /**
     * Get user counts (favorites, etc.) for the navbar
     */
    static async getCounts(userId) {
        try {
            if (!userId) return { favoritesCount: 0, wishlistCount: 0, notificationCount: 0 };
            
            const [favs] = await pool.query('SELECT COUNT(*) as count FROM marketplace_favorites WHERE user_id = ?', [userId]);
            const [wish] = await pool.query('SELECT COUNT(*) as count FROM marketplace_wishlist WHERE user_id = ?', [userId]);
            const [notif] = await pool.query('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE', [userId]);
            
            return {
                favoritesCount: favs[0]?.count || 0,
                wishlistCount: 0,
                notificationCount: 0
            };
        } catch (error) {
            logger.error('Error getting user counts:', error);
            return { favoritesCount: 0, wishlistCount: 0, notificationCount: 0 };
        }
    }

    /**
     * Get safe meetup locations for campus
     */
    static async getSafeMeetupLocations(campus = 'all') {
        try {
            let query = 'SELECT * FROM safe_meetup_locations WHERE 1=1';
            const params = [];

            if (campus && campus !== 'all') {
                query += ' AND campus = ?';
                params.push(campus);
            }

            query += ' ORDER BY is_verified DESC, name ASC';
            const [locations] = await pool.query(query, params);
            return locations;
        } catch (error) {
            logger.error('Error getting safe meetup locations:', error);
            // Return defaults if table is missing or DB fails
            return [
                { id: 1, name: 'Campus Security Office', description: 'Available 24/7, high visibility.', lat: -1.2833, lng: 36.8167, campus: 'main_campus' },
                { id: 2, name: 'Student Union Lounge', description: 'Busy public area.', lat: -1.2840, lng: 36.8170, campus: 'main_campus' },
                { id: 3, name: 'Main Library Entrance', description: 'Monitored by cameras.', lat: -1.2850, lng: 36.8180, campus: 'main_campus' }
            ];
        }
    }


    /**
     * Toggle favorite for a listing
     */
    static async toggleFavorite(userId, listingId) {
        const [existing] = await pool.query(
            'SELECT favorite_id FROM marketplace_favorites WHERE user_id = ? AND listing_id = ?',
            [userId, listingId]
        );

        if (existing.length > 0) {
            await pool.query('DELETE FROM marketplace_favorites WHERE favorite_id = ?', [existing[0].favorite_id]);
            return { favorited: false };
        } else {
            const favorite_id = uuidv4();
            await pool.query(
                'INSERT INTO marketplace_favorites (favorite_id, user_id, listing_id) VALUES (?, ?, ?)',
                [favorite_id, userId, listingId]
            );

            // Notify seller
            try {
                const [[listing]] = await pool.query(
                    'SELECT seller_id, title FROM marketplace_listings WHERE listing_id = ?',
                    [listingId]
                );
                const [[user]] = await pool.query('SELECT username FROM users WHERE user_id = ?', [userId]);
                
                if (listing && listing.seller_id !== userId) {
                    const notificationController = require('../controllers/notification.controller');
                    notificationController.createNotification({
                        user_id: listing.seller_id,
                        actor_id: userId,
                        type: 'marketplace_favorite',
                        title: '❤️ Someone liked your item!',
                        content: `${user.username} favorited your listing: "${listing.title}"`,
                        related_id: listingId,
                        related_type: 'marketplace_listing',
                        action_url: `/marketplace/listings/${listingId}`
                    }).catch(() => {});
                }
            } catch (err) {
                logger.error('Error notifying seller of favorite:', err);
            }

            return { favorited: true };
        }
    }

    /**
     * Record a view for a listing
     */
    static async recordView(listingId, userId = null) {
        try {
            await pool.query(
                'UPDATE marketplace_listings SET view_count = view_count + 1 WHERE listing_id = ?',
                [listingId]
            );
            return true;
        } catch (error) {
            logger.error('Error recording view:', error);
            return false;
        }
    }

    /**
     * Add a review for a seller
     */
    static async createReview(reviewData) {
        const { listing_id, reviewer_id, reviewee_id, rating, comment, transaction_type } = reviewData;
        const review_id = uuidv4();

        // Check for duplicate review
        const [existing] = await pool.query(
            'SELECT review_id FROM marketplace_reviews WHERE listing_id = ? AND reviewer_id = ?',
            [listing_id, reviewer_id]
        );

        if (existing.length > 0) {
            // Update existing review instead of creating new one
            await pool.query(
                'UPDATE marketplace_reviews SET rating = ?, comment = ?, transaction_type = ?, created_at = NOW() WHERE review_id = ?',
                [rating, comment, transaction_type, existing[0].review_id]
            );
            return { review_id: existing[0].review_id, updated: true };
        }

        await pool.query(
            'INSERT INTO marketplace_reviews (review_id, listing_id, reviewer_id, reviewee_id, rating, comment, transaction_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [review_id, listing_id, reviewer_id, reviewee_id, rating, comment, transaction_type]
        );

        // Update listing average rating
        await this.updateAverageRating(listing_id);

        return { review_id, updated: false };
    }

    static async updateAverageRating(listingId) {
        const [reviews] = await pool.query(
            'SELECT AVG(rating) as avg, COUNT(*) as count FROM marketplace_reviews WHERE listing_id = ?',
            [listingId]
        );
        if (reviews[0]) {
            await pool.query(
                'UPDATE marketplace_listings SET average_rating = ? WHERE listing_id = ?',
                [reviews[0].avg || 0, listingId]
            );
        }
    }

    static async getListingReviews(listingId) {
        const [reviews] = await pool.query(
            `SELECT r.*, u.username as reviewer_name, u.avatar_url as reviewer_avatar
             FROM marketplace_reviews r
             JOIN users u ON r.reviewer_id = u.user_id
             WHERE r.listing_id = ?
             ORDER BY r.created_at DESC`,
            [listingId]
        );
        return reviews;
    }

    /**
     * Record a share
     */
    static async recordShare(listingId, userId = null) {
        await pool.query(
            'UPDATE marketplace_listings SET share_count = share_count + 1 WHERE listing_id = ?',
            [listingId]
        );
        return true;
    }

    /**
     * Toggle favorite for a seller
     */
    static async toggleFavoriteSeller(userId, sellerId) {
        const [existing] = await pool.query(
            'SELECT favorite_id FROM marketplace_favorite_sellers WHERE user_id = ? AND seller_id = ?',
            [userId, sellerId]
        );

        if (existing.length > 0) {
            await pool.query('DELETE FROM marketplace_favorite_sellers WHERE favorite_id = ?', [existing[0].favorite_id]);
            return { favorited: false };
        } else {
            await pool.query(
                'INSERT INTO marketplace_favorite_sellers (favorite_id, user_id, seller_id) VALUES (?, ?, ?)',
                [uuidv4(), userId, sellerId]
            );
            return { favorited: true };
        }
    }

    /**
     * Create a review for a seller
     */
    static async createReview(reviewData) {
        const { listing_id, reviewer_id, reviewee_id, rating, comment, transaction_type } = reviewData;
        const review_id = uuidv4();
        await pool.query(
            'INSERT INTO marketplace_reviews (review_id, listing_id, reviewer_id, reviewee_id, rating, comment, transaction_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [review_id, listing_id, reviewer_id, reviewee_id, rating, comment, transaction_type]
        );
        return { review_id };
    }

    /**
     * Get reviews for a user
     */
    static async getUserReviews(userId) {
        const [rows] = await pool.query(
            `SELECT r.*, u.username as reviewer_username, u.avatar_url as reviewer_avatar
             FROM marketplace_reviews r
             JOIN users u ON r.reviewer_id = u.user_id
             WHERE r.reviewee_id = ?
             ORDER BY r.created_at DESC`,
            [userId]
        );
        return rows;
    }

    /**
     * Get user's favorited listings
     */
    static async getUserFavorites(userId) {
        const [rows] = await pool.query(
            `SELECT f.favorite_id, l.*, u.username as seller_username, 
                    (SELECT media_url FROM listing_media WHERE listing_id = l.listing_id LIMIT 1) as media_url
             FROM marketplace_favorites f
             JOIN marketplace_listings l ON f.listing_id = l.listing_id
             JOIN users u ON l.seller_id = u.user_id
             WHERE f.user_id = ?`,
            [userId]
        );
        return rows;
    }

    /**
     * Get all marketplace listings with filters (FIXED VERSION)
     */
    static async getListings(filters = {}, userId = null) {
        const {
            search = '',
            category = '',
            campus = '',
            condition = '',
            minPrice = 0,
            maxPrice = 1000000,
            minRating = 0,
            sort = 'newest',
            limit = 20,
            offset = 0,
            currentUserId = null
        } = filters;

        const sessionUserId = currentUserId || userId;

        try {
            let query = `
                SELECT 
                    l.*,
                    u.username as seller_username,
                    u.avatar_url as seller_avatar,
                    (SELECT media_url FROM listing_media WHERE listing_id = l.listing_id LIMIT 1) as media_url,
                    (SELECT AVG(rating) FROM marketplace_reviews WHERE reviewee_id = l.seller_id) as seller_rating,
                    (SELECT COUNT(*) FROM marketplace_reviews WHERE reviewee_id = l.seller_id) as review_count,
                    CASE WHEN f.favorite_id IS NOT NULL THEN 1 ELSE 0 END as is_favorited,
                    CASE WHEN w.wishlist_id IS NOT NULL THEN 1 ELSE 0 END as is_wishlisted,
                    (SELECT COUNT(*) FROM marketplace_orders WHERE listing_id = l.listing_id) as order_count
                FROM marketplace_listings l
                JOIN users u ON l.seller_id = u.user_id
                LEFT JOIN marketplace_favorites f ON l.listing_id = f.listing_id AND f.user_id = ?
                LEFT JOIN marketplace_wishlist w ON l.listing_id = w.listing_id AND w.user_id = ?
                WHERE l.status = 'active' AND l.is_sold = 0
            `;
            const params = [sessionUserId, sessionUserId];

            // Record view if userId is provided
            if (userId && listings.length > 0) {
                 // Actually this should be done in individual listing view, but we can track impressions here?
                 // No, only record view in getListingById or recordView endpoint.
            }

            // Apply filters
            if (search) {
                const searchTerm = `%${search.trim().replace(/[%_]/g, '\\$&')}%`;
                query += ` AND (l.title LIKE ? OR l.description LIKE ?)`;
                params.push(searchTerm, searchTerm);
            }

            if (category && category !== 'all') {
                query += ` AND l.category = ?`;
                params.push(category);
            }

            if (campus && campus !== 'all') {
                query += ` AND l.campus = ?`;
                params.push(campus);
            }

            if (condition && condition !== 'all') {
                query += ` AND l.condition = ?`;
                params.push(condition);
            }

            if (minPrice > 0) {
                query += ` AND l.price >= ?`;
                params.push(parseFloat(minPrice));
            }

            if (maxPrice < 1000000) {
                query += ` AND l.price <= ?`;
                params.push(parseFloat(maxPrice));
            }

            // Apply sorting
            switch (sort) {
                case 'name_asc':
                    query += ` ORDER BY l.title ASC`;
                    break;
                case 'name_desc':
                    query += ` ORDER BY l.title DESC`;
                    break;
                case 'rating':
                    query += ` ORDER BY (SELECT AVG(rating) FROM marketplace_reviews WHERE reviewee_id = l.seller_id) DESC, l.created_at DESC`;
                    break;
                case 'popular':
                    query += ` ORDER BY l.view_count DESC, l.created_at DESC`;
                    break;
                case 'price_low':
                    query += ` ORDER BY l.price ASC`;
                    break;
                case 'price_high':
                    query += ` ORDER BY l.price DESC`;
                    break;
                case 'newest':
                default:
                    query += ` ORDER BY l.created_at DESC`;
                    break;
            }

            // Add pagination
            const finalLimit = Math.min(parseInt(limit) || 20, 100);
            const finalOffset = Math.max(parseInt(offset) || 0, 0);
            query += ` LIMIT ? OFFSET ?`;
            params.push(finalLimit, finalOffset);

            const [listings] = await pool.query(query, params);

            // Get media for each listing
            for (let listing of listings) {
                const [media] = await pool.query(
                    'SELECT media_url, media_type FROM listing_media WHERE listing_id = ? ORDER BY upload_order ASC LIMIT 5',
                    [listing.listing_id]
                );
                listing.media = media;
                listing.image_urls = media
                    .filter(m => m.media_type === 'image')
                    .map(m => m.media_url);

                if (listing.image_urls.length === 0 && listing.image_url) {
                    listing.image_urls = [listing.image_url];
                }
            }

            // Get total count for pagination
            let countQuery = `
                SELECT COUNT(*) as total 
                FROM marketplace_listings l
                WHERE l.status = 'active' AND l.is_sold = 0
            `;
            const countParams = [];
            if (search) {
                const searchTerm = `%${search.trim().replace(/[%_]/g, '\\$&')}%`;
                countQuery += ` AND (l.title LIKE ? OR l.description LIKE ?)`;
                countParams.push(searchTerm, searchTerm);
            }
            if (category && category !== 'all') {
                countQuery += ` AND l.category = ?`;
                countParams.push(category);
            }
            if (campus && campus !== 'all') {
                countQuery += ` AND l.campus = ?`;
                countParams.push(campus);
            }
            if (condition && condition !== 'all') {
                countQuery += ` AND l.condition = ?`;
                countParams.push(condition);
            }
            if (minPrice > 0) {
                countQuery += ` AND l.price >= ?`;
                countParams.push(parseFloat(minPrice));
            }
            if (maxPrice < 1000000) {
                countQuery += ` AND l.price <= ?`;
                countParams.push(parseFloat(maxPrice));
            }

            const [countResult] = await pool.query(countQuery, countParams);

            return {
                listings,
                pagination: {
                    total: countResult[0].total,
                    limit: finalLimit,
                    offset: finalOffset,
                    hasMore: finalOffset + listings.length < countResult[0].total
                }
            };

        } catch (error) {
            logger.error('Database error in getListings:', error);
            // On error return empty array
            return { listings: [], pagination: { total: 0, limit: 20, offset: 0, hasMore: false } };
        }
    }

    /**
     * Get categories with active listing counts
     */
    static async getCategories(filters = {}) {
        let query = `
            SELECT category AS id, 
                   COUNT(*) AS count 
            FROM marketplace_listings 
            WHERE status = 'active' AND is_sold = 0
        `;
        const params = [];

        if (filters.campus && filters.campus !== 'all') {
            query += ` AND campus = ?`;
            params.push(filters.campus);
        }

        query += ` GROUP BY category ORDER BY count DESC`;

        const [rows] = await pool.query(query, params);
        
        const categoryNames = {
            'electronics': 'Electronics',
            'books': 'Books & Notes',
            'fashion': 'Fashion',
            'dorm': 'Dorm Life',
            'services': 'Services',
            'other': 'Other'
        };

        return rows.map(row => ({
            id: row.id,
            name: categoryNames[row.id] || (row.id.charAt(0).toUpperCase() + row.id.slice(1).replace('_', ' ')),
            count: row.count
        }));
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
                const pricePrefs = { min: 0, max: 0, avg: 0, count: 0 };
                const conditionPrefs = {};

                userInteractions.forEach(item => {
                    const price = parseFloat(item.price);
                    if (!isNaN(price)) {
                        // Category preferences
                        categoryPrefs[item.category] = (categoryPrefs[item.category] || 0) + 1;

                        // Price preferences
                        pricePrefs.min = pricePrefs.count === 0 ? price : Math.min(pricePrefs.min, price);
                        pricePrefs.max = pricePrefs.count === 0 ? price : Math.max(pricePrefs.max, price);
                        pricePrefs.avg = (pricePrefs.avg * pricePrefs.count + price) / (pricePrefs.count + 1);
                        pricePrefs.count++;

                        // Condition preferences
                        conditionPrefs[item.condition] = (conditionPrefs[item.condition] || 0) + 1;
                    }
                });

                // 3. Find most preferred categories
                const topCategories = Object.entries(categoryPrefs)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 3)
                    .map(([cat]) => cat);

                // Safe price range fallbacks
                const safeAvg = isNaN(pricePrefs.avg) || pricePrefs.avg === 0 ? 500 : pricePrefs.avg;
                const minRange = Math.max(0, safeAvg * 0.5);
                const maxRange = safeAvg * 2.0;

                // Most preferred condition fallback
                const topConditionEntry = Object.entries(conditionPrefs).sort(([,a], [,b]) => b - a)[0];
                const topCondition = topConditionEntry ? topConditionEntry[0] : 'good';

                // 4. Build recommendation query with scoring
                let query = `
                    SELECT ml.*,
                           u.username as seller_username,
                           u.avatar_url as seller_avatar,
                           (SELECT AVG(rating) FROM marketplace_reviews WHERE reviewee_id = ml.seller_id) as seller_rating,
                           (SELECT COUNT(*) FROM marketplace_reviews WHERE reviewee_id = ml.seller_id) as seller_review_count,
                           (
                               CASE
                                   WHEN ml.category IN (${topCategories.length > 0 ? topCategories.map(() => '?').join(',') : "''"}) THEN 10
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
                    minRange,
                    maxRange,
                    topCondition,
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
                    AND ml.listing_id NOT IN (${recommendations.map(r => `'${r.listing_id}'`).join(',') || "'NULL'"})
                    ORDER BY ml.view_count DESC, ml.created_at DESC
                    LIMIT ?
                `;

                const params = [campus];
                if (userId) params.push(userId);
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
     * Get a single listing with all its media (for detail pages)
     */
    /**
     * Get a single listing with all its media - FIXED VERSION
     */
    static async getListingWithMedia(listingId, userId = null) {
        const connection = await pool.getConnection();
        try {
            // Increment view count
            await connection.query(
                'UPDATE marketplace_listings SET view_count = view_count + 1 WHERE listing_id = ?',
                [listingId]
            ).catch(() => {}); // Non-critical

            // Get listing with seller info and is_favorited status
            const [listings] = await connection.query(`
                SELECT 
                    ml.*,
                    u.username as seller_username,
                    u.avatar_url as seller_avatar,
                    u.campus as seller_campus,
                    u.is_verified as seller_verified,
                    (SELECT AVG(rating) FROM marketplace_reviews WHERE reviewee_id = ml.seller_id) as seller_rating,
                    (SELECT COUNT(*) FROM marketplace_reviews WHERE reviewee_id = ml.seller_id) as seller_review_count,
                    CASE WHEN f.favorite_id IS NOT NULL THEN 1 ELSE 0 END as is_favorited,
                    CASE WHEN w.wishlist_id IS NOT NULL THEN 1 ELSE 0 END as is_wishlisted
                FROM marketplace_listings ml
                JOIN users u ON ml.seller_id = u.user_id
                LEFT JOIN marketplace_favorites f ON ml.listing_id = f.listing_id AND f.user_id = ?
                LEFT JOIN marketplace_wishlist w ON ml.listing_id = w.listing_id AND w.user_id = ?
                WHERE ml.listing_id = ? AND ml.status != 'deleted'
            `, [userId, userId, listingId]);

            if (listings.length === 0) return null;

            const listing = listings[0];

            // Fetch all media
            const [media] = await connection.query(
                'SELECT * FROM listing_media WHERE listing_id = ? ORDER BY upload_order',
                [listingId]
            );
            listing.media = media;
            listing.image_urls = media
                .filter(m => m.media_type === 'image')
                .map(m => m.media_url);

            if (listing.image_urls.length === 0 && listing.image_url) {
                listing.image_urls = [listing.image_url];
            }

            return listing;
        } catch (error) {
            logger.error('Database error in getListingWithMedia:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Create a new marketplace listing (MySQL + Cloudinary support)
     */
    static async createListing(listingData) {
        const connection = await pool.getConnection();
        const { seller_id, title, description, price, category, condition, campus, location, tags, media, image_url } = listingData;
        
        try {
            await connection.beginTransaction();

            const listing_id = uuidv4();

            // 1. Insert into marketplace_listings
            await connection.query(
                `INSERT INTO marketplace_listings 
                (listing_id, seller_id, title, description, price, category, \`condition\`, campus, location, status, image_url, tags) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
                [listing_id, seller_id, title, description, price, category, condition, campus, location, image_url, JSON.stringify(tags || [])]
            );

            // 2. Insert media
            if (media && media.length > 0) {
                for (const item of media) {
                    await connection.query(
                        'INSERT INTO listing_media (media_id, listing_id, media_url, media_type, upload_order) VALUES (?, ?, ?, ?, ?)',
                        [uuidv4(), listing_id, item.url, item.type, item.order]
                    );
                }
            }

            // 3. Insert tags (optional)
            if (tags && tags.length > 0) {
                for (const tag of tags) {
                    await connection.query(
                        'INSERT INTO listing_tags (listing_id, tag_name) VALUES (?, ?)',
                        [listing_id, tag]
                    );
                }
            }

            await connection.commit();
            return listing_id;
        } catch (error) {
            await connection.rollback();
            logger.error('Error in createListing:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Update an existing listing
     */
    static async updateListing(id, sellerId, updates) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [listing] = await connection.query(
                'SELECT listing_id FROM marketplace_listings WHERE listing_id = ? AND seller_id = ?',
                [id, sellerId]
            );
            if (listing.length === 0) throw new Error('UNAUTHORIZED');

            // Build dynamic update query
            const fields = [];
            const values = [];
            const allowedFields = ['title', 'description', 'price', 'category', 'condition', 'campus', 'location', 'status'];

            for (const key of allowedFields) {
                if (updates[key] !== undefined) {
                    fields.push(`${key} = ?`);
                    values.push(updates[key]);
                }
            }

            if (fields.length > 0) {
                values.push(id);
                await connection.query(
                    `UPDATE marketplace_listings SET ${fields.join(', ')}, updated_at = NOW() WHERE listing_id = ?`,
                    values
                );
            }

            // Sync media if provided
            if (updates.media) {
                await connection.query('DELETE FROM listing_media WHERE listing_id = ?', [id]);
                for (const item of updates.media) {
                    await connection.query(
                        'INSERT INTO listing_media (media_id, listing_id, media_url, media_type, upload_order) VALUES (?, ?, ?, ?, ?)',
                        [uuidv4(), id, item.url, item.type, item.order]
                    );
                }
            }

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Boost a listing (promote it)
     */
    static async boostListing(listingId) {
        await pool.query(
            'UPDATE marketplace_listings SET boost_count = boost_count + 1, last_boosted_at = NOW(), is_promoted = 1 WHERE listing_id = ?',
            [listingId]
        );
        return true;
    }

    /**
     * Place an order with listing snapshot
     * Derives critical values from DB but allows custom meetup details.
     */
    static async placeOrder(orderData) {
        const connection = await pool.getConnection();
        const { 
            listingId, 
            buyerId, 
            agreedPrice, 
            campus, 
            location, 
            scheduledTime,
            message 
        } = orderData;

        try {
            await connection.beginTransaction();

            // 1. Get listing details (snapshot and existence check)
            const [listings] = await connection.query(
                'SELECT * FROM marketplace_listings WHERE listing_id = ? FOR UPDATE',
                [listingId]
            );

            if (listings.length === 0) throw new Error('LISTING_NOT_FOUND');
            const listing = listings[0];

            if (listing.is_sold) throw new Error('LISTING_SOLD');
            if (listing.status !== 'active' && listing.status !== 'pending') {
                throw new Error('LISTING_NOT_AVAILABLE');
            }
            if (listing.seller_id === buyerId) throw new Error('CANNOT_BUY_OWN');

            // 2. Check for existing active orders
            const [existing] = await connection.query(
                "SELECT order_id FROM marketplace_orders WHERE listing_id = ? AND buyer_id = ? AND status IN ('pending', 'accepted')",
                [listingId, buyerId]
            );
            if (existing.length > 0) throw new Error('ORDER_EXISTS');

            const orderId = uuidv4();
            const finalPrice = agreedPrice || listing.price;

            // 3. Create order record (Snapshot data)
            await connection.query(
                `INSERT INTO marketplace_orders 
                (order_id, listing_id, buyer_id, seller_id, 
                 listing_title, listing_description, price_at_time, 
                 currency, item_condition, agreed_price, campus, 
                 location_description, scheduled_time, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, 'KES', ?, ?, ?, ?, ?, 'pending')`,
                [
                    orderId, listingId, buyerId, listing.seller_id, 
                    listing.title, listing.description, listing.price, 
                    listing.condition, finalPrice, campus || listing.campus, 
                    location || listing.location, scheduledTime || null
                ]
            );

            // 4. Update listing status to 'pending' to prevent multiple buyers
            await connection.query(
                "UPDATE marketplace_listings SET status = 'pending' WHERE listing_id = ?",
                [listingId]
            );

            // 5. Initial audit log
            await connection.query(
                'INSERT INTO order_audit_log (log_id, order_id, actor_id, action, new_status, changes) VALUES (?, ?, ?, ?, ?, ?)',
                [uuidv4(), orderId, buyerId, 'ORDER_PLACED', 'pending', JSON.stringify({ message })]
            );

            await connection.commit();

            // 6. Push to Firebase for real-time seller notification
            try {
                const firebaseRef = admin.database().ref(`marketplace/orders/${orderId}`);
                await firebaseRef.set({
                    orderId,
                    listingId,
                    buyerId,
                    sellerId: listing.seller_id,
                    status: 'pending',
                    price: finalPrice,
                    createdAt: new Date().toISOString()
                });
            } catch (firebaseError) {
                logger.error('Firebase push failed in placeOrder:', firebaseError);
            }

            return orderId;
        } catch (error) {
            await connection.rollback();
            logger.error('Error in placeOrder transaction:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Block a user
     */
    static async blockUser(userId, blockedId, reason) {
        await pool.query(
            'INSERT INTO marketplace_user_blocks (block_id, blocker_id, blocked_id, reason) VALUES (?, ?, ?, ?)',
            [uuidv4(), userId, blockedId, reason]
        );
        return true;
    }

    /**
     * Create a review for a completed order
     */
    static async createReview(reviewData) {
        const { listing_id, reviewer_id, reviewee_id, rating, comment, transaction_type } = reviewData;
        
        // Verify order is completed
        const [orders] = await pool.query(
            "SELECT order_id FROM marketplace_orders WHERE listing_id = ? AND status = 'completed'",
            [listing_id]
        );
        if (orders.length === 0) throw new Error('Incomplete transaction cannot be reviewed');

        await pool.query(
            `INSERT INTO marketplace_reviews 
             (review_id, listing_id, reviewer_id, reviewee_id, rating, comment, transaction_type) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), listing_id, reviewer_id, reviewee_id, rating, comment, transaction_type]
        );
        return true;
    }

    /**
     * Relist a sold/cancelled item
     */
    static async relistItem(id, userId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Get original listing
            const [listings] = await connection.query(
                'SELECT * FROM marketplace_listings WHERE listing_id = ? AND seller_id = ?',
                [id, userId]
            );

            if (listings.length === 0) throw new Error('LISTING_NOT_FOUND');
            const original = listings[0];

            const new_listing_id = uuidv4();

            // Create new listing
            await connection.query(
                `INSERT INTO marketplace_listings 
                 (listing_id, seller_id, title, description, price, category, condition, campus, location, status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
                [new_listing_id, userId, original.title, original.description, original.price,
                    original.category, original.condition, original.campus, original.location]
            );

            // Copy media
            const [media] = await connection.query('SELECT * FROM listing_media WHERE listing_id = ?', [id]);
            for (const m of media) {
                await connection.query(
                    'INSERT INTO listing_media (media_id, listing_id, media_url, media_type, upload_order) VALUES (?, ?, ?, ?, ?)',
                    [uuidv4(), new_listing_id, m.media_url, m.media_type, m.upload_order]
                );
            }

            await connection.commit();
            return new_listing_id;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
    /**
     * Update a listing with dynamic fields
     */
    static async updateListing(listingId, updateData) {
        const connection = await pool.getConnection();
        const { media, ...fields } = updateData;

        try {
            await connection.beginTransaction();

            if (Object.keys(fields).length > 0) {
                const setClauses = Object.keys(fields).map(key => `\`${key}\` = ?`).join(', ');
                const values = Object.values(fields);
                
                await connection.query(
                    `UPDATE marketplace_listings SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE listing_id = ?`,
                    [...values, listingId]
                );
            }

            // Update media if provided
            if (media && media.length > 0) {
                // Remove old media
                await connection.query('DELETE FROM listing_media WHERE listing_id = ?', [listingId]);
                
                for (const m of media) {
                    await connection.query(
                        'INSERT INTO listing_media (media_id, listing_id, media_url, media_type, upload_order) VALUES (?, ?, ?, ?, ?)',
                        [uuidv4(), listingId, m.url, m.type, m.order]
                    );
                }
            }

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            logger.error('Error in updateListing:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Boost a listing visibility
     */
    static async boostListing(listingId) {
        await pool.query(
            'UPDATE marketplace_listings SET boost_count = boost_count + 1, last_boosted_at = NOW(), is_promoted = 1 WHERE listing_id = ?',
            [listingId]
        );
    }

    /**
     * Block a user for marketplace safety
     */
    static async blockUser(blockerId, blockedId, reason) {
        await pool.query(
            'INSERT INTO marketplace_user_blocks (block_id, blocker_id, blocked_id, reason) VALUES (?, ?, ?, ?)',
            [uuidv4(), blockerId, blockedId, reason]
        );
    }

    /**
     * Create a review for a completed order
     */
    static async createReview(reviewData) {
        const { reviewer_id, reviewee_id, listing_id, rating, comment, transaction_type } = reviewData;
        
        // Verification: Verify there was a COMPLETED order for this listing and buyer/seller
        const [orders] = await pool.query(
            `SELECT order_id FROM marketplace_orders 
             WHERE listing_id = ? AND status = 'completed' 
             AND ((buyer_id = ? AND seller_id = ?) OR (buyer_id = ? AND seller_id = ?))`,
            [listing_id, reviewer_id, reviewee_id, reviewee_id, reviewer_id]
        );

        if (orders.length === 0) {
            throw new Error('Only participants of a completed order can leave reviews');
        }

        await pool.query(
            'INSERT INTO marketplace_reviews (review_id, listing_id, reviewer_id, reviewee_id, rating, comment, transaction_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), listing_id, reviewer_id, reviewee_id, rating, comment, transaction_type]
        );
    }

    /**
     * Create a listing (Unified method for the fixed controller)
     */
    static async createListing(listingData) {
        const connection = await pool.getConnection();
        const {
            seller_id, title, description, price, category, 
            condition, campus, location, tags, image_url, media
        } = listingData;

        try {
            await connection.beginTransaction();

            const listingId = uuidv4();

            // Insert listing
            await connection.query(
                `INSERT INTO marketplace_listings 
                (listing_id, seller_id, title, description, price, category, \`condition\`, campus, location, image_url, tags) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    listingId,
                    seller_id,
                    title,
                    description || '',
                    parseFloat(price),
                    category || 'other',
                    condition || 'good',
                    campus,
                    location || '',
                    image_url,
                    Array.isArray(tags) ? JSON.stringify(tags) : tags || null
                ]
            );

            // Insert media
            if (media && media.length > 0) {
                for (const m of media) {
                    await connection.query(
                        'INSERT INTO listing_media (media_id, listing_id, media_url, media_type, upload_order) VALUES (?, ?, ?, ?, ?)',
                        [uuidv4(), listingId, m.url, m.type, m.order]
                    );
                }
            }

            await connection.commit();
            return listingId;
        } catch (error) {
            await connection.rollback();
            logger.error('Error in createListing:', error);
            throw error;
        } finally {
            connection.release();
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
            // Cloudinary URLs come from file.path (set by CloudinaryStorage)
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
     * Wishlist Management (Separate from Likes)
     */
    static async toggleWishlist(userId, listingId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [existing] = await connection.query(
                'SELECT wishlist_id FROM marketplace_wishlist WHERE user_id = ? AND listing_id = ?',
                [userId, listingId]
            );

            if (existing.length > 0) {
                await connection.query('DELETE FROM marketplace_wishlist WHERE wishlist_id = ?', [existing[0].wishlist_id]);
                await connection.commit();
                return { wishlisted: false };
            } else {
                const wishlist_id = require('crypto').randomUUID();
                await connection.query(
                    'INSERT INTO marketplace_wishlist (wishlist_id, user_id, listing_id) VALUES (?, ?, ?)',
                    [wishlist_id, userId, listingId]
                );
                await connection.commit();
                return { wishlisted: true };
            }
        } catch (error) {
            if (connection) await connection.rollback();
            logger.error('Transaction error in toggleWishlist:', error);
            throw error;
        } finally {
            if (connection) connection.release();
        }
    }

    static async getUserWishlist(userId) {
        try {
            const [rows] = await pool.query(
                `SELECT ml.*, mw.created_at as wishlisted_at
                 FROM marketplace_wishlist mw
                 JOIN marketplace_listings ml ON mw.listing_id = ml.listing_id
                 WHERE mw.user_id = ? AND ml.is_sold = FALSE
                 ORDER BY mw.created_at DESC`,
                [userId]
            );
            return rows;
        } catch (error) {
            logger.error('Database error in getUserWishlist:', error);
            return [];
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
     * Update order status with business-rule enforcement.
     * - accepted / rejected → seller only (from pending)
     * - cancelled           → buyer or seller (from pending/accepted)
     * - completed           → both parties confirmed meetup
     */
    static async updateOrderStatus(orderId, userId, newStatus, reason = null) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Lock order row
            const [[order]] = await connection.query(
                'SELECT * FROM marketplace_orders WHERE order_id = ? FOR UPDATE',
                [orderId]
            );

            if (!order) throw new Error('ORDER_NOT_FOUND');
            const oldStatus = order.status;

            // Validate participant
            const isBuyer = order.buyer_id === userId;
            const isSeller = order.seller_id === userId;
            if (!isBuyer && !isSeller) throw new Error('UNAUTHORIZED');

            // Validate transition using helper
            this.validateStatusTransition(oldStatus, newStatus, isBuyer, isSeller);

            // Special check for complete
            if (newStatus === 'completed') {
                if (!order.meetup_confirmed_by_buyer || !order.meetup_confirmed_by_seller) {
                    throw new Error('MEETUP_NOT_CONFIRMED');
                }
            }

            // Update data
            const updateData = {
                status: newStatus,
                last_action_by: userId,
                last_action_at: new Date()
            };

            if (newStatus === 'accepted')  updateData.accepted_at = new Date();
            if (newStatus === 'rejected')  updateData.rejected_at = new Date();
            if (newStatus === 'cancelled') {
                updateData.cancelled_at = new Date();
                updateData.cancelled_by = userId;
                updateData.cancellation_reason = reason;
            }
            if (newStatus === 'completed') updateData.completed_at = new Date();
            if (newStatus === 'disputed')  updateData.disputed_at = new Date();

            const setClauses = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
            const values = Object.values(updateData);
            
            await connection.query(
                `UPDATE marketplace_orders SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
                [...values, orderId]
            );

            // Reactivate/finalize listing
            if (['rejected', 'cancelled'].includes(newStatus)) {
                await connection.query(
                    "UPDATE marketplace_listings SET status = 'active' WHERE listing_id = ?",
                    [order.listing_id]
                );
            } else if (newStatus === 'completed') {
                await connection.query(
                    "UPDATE marketplace_listings SET is_sold = 1, status = 'sold', sold_at = NOW() WHERE listing_id = ?",
                    [order.listing_id]
                );
            }

            // Audit log
            await connection.query(
                `INSERT INTO order_audit_log (log_id, order_id, actor_id, action, old_status, new_status, changes)
                 VALUES (?, ?, ?, 'STATUS_CHANGE', ?, ?, ?)`,
                [uuidv4(), orderId, userId, oldStatus, newStatus, JSON.stringify({ reason })]
            );

            await connection.commit();

            // Update Firebase
            try {
                const firebaseRef = admin.database().ref(`marketplace/orders/${orderId}`);
                await firebaseRef.update({
                    status: newStatus,
                    updatedAt: new Date().toISOString(),
                    lastActionBy: userId
                });
            } catch (firebaseError) {
                logger.error('Firebase update failed:', firebaseError);
            }

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
     * Helper to validate status transitions
     */
    static validateStatusTransition(oldStatus, newStatus, isBuyer, isSeller) {
        const transitions = {
            'pending': {
                'accepted': isSeller,
                'rejected': isSeller,
                'cancelled': isBuyer || isSeller,
            },
            'accepted': {
                'cancelled': isBuyer || isSeller,
                'completed': isBuyer || isSeller,
                'disputed': isBuyer || isSeller
            },
            'rejected': {},
            'cancelled': {},
            'completed': {},
            'disputed': {}
        };

        if (!transitions[oldStatus] || transitions[oldStatus][newStatus] === undefined) {
            throw new Error('INVALID_TRANSITION');
        }
        if (!transitions[oldStatus][newStatus]) {
            throw new Error('UNAUTHORIZED');
        }
    }

    /**
     * Confirm meetup attendance (buyer or seller)
     * When both confirm, order can be completed.
     */
    static async confirmMeetup(orderId, userId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [[order]] = await connection.query(
                'SELECT * FROM marketplace_orders WHERE order_id = ? FOR UPDATE',
                [orderId]
            );

            if (!order) throw new Error('ORDER_NOT_FOUND');
            if (order.status !== 'accepted') throw new Error('INVALID_TRANSITION');

            const isBuyer = order.buyer_id === userId;
            const isSeller = order.seller_id === userId;
            if (!isBuyer && !isSeller) throw new Error('UNAUTHORIZED');

            if (isBuyer) {
                await connection.query('UPDATE marketplace_orders SET meetup_confirmed_by_buyer = 1 WHERE order_id = ?', [orderId]);
            } else {
                await connection.query('UPDATE marketplace_orders SET meetup_confirmed_by_seller = 1 WHERE order_id = ?', [orderId]);
            }

            await connection.commit();

            const [[updated]] = await pool.query(
                'SELECT meetup_confirmed_by_buyer, meetup_confirmed_by_seller FROM marketplace_orders WHERE order_id = ?',
                [orderId]
            );

            const bothConfirmed = updated.meetup_confirmed_by_buyer && updated.meetup_confirmed_by_seller;

            // Update Firebase
            try {
                const firebaseRef = admin.database().ref(`marketplace/orders/${orderId}`);
                await firebaseRef.update({
                    meetupConfirmedByBuyer: !!updated.meetup_confirmed_by_buyer,
                    meetupConfirmedBySeller: !!updated.meetup_confirmed_by_seller,
                    meetupBothConfirmed: !!bothConfirmed,
                    updatedAt: new Date().toISOString()
                });
            } catch (firebaseError) {
                logger.error('Firebase update failed:', firebaseError);
            }

            return {
                buyerConfirmed: !!updated.meetup_confirmed_by_buyer,
                sellerConfirmed: !!updated.meetup_confirmed_by_seller,
                bothConfirmed: !!bothConfirmed
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
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
     * Raise a dispute for an order
     */
    static async createDispute(disputeData) {
        const connection = await pool.getConnection();
        const { order_id, raised_by, reason, description } = disputeData;

        try {
            await connection.beginTransaction();

            const dispute_id = uuidv4();

            // Insert dispute
            await connection.query(
                `INSERT INTO order_disputes (dispute_id, order_id, raised_by, reason, description, status) 
                 VALUES (?, ?, ?, ?, ?, 'open')`,
                [dispute_id, order_id, raised_by, reason, description]
            );

            // Transition order status to 'disputed'
            await connection.query(
                "UPDATE marketplace_orders SET status = 'disputed', disputed_at = NOW(), last_action_by = ?, last_action_at = NOW() WHERE order_id = ?",
                [raised_by, order_id]
            );

            // Audit log
            await connection.query(
                `INSERT INTO order_audit_log (log_id, order_id, actor_id, action, old_status, new_status, changes)
                 VALUES (?, ?, ?, 'DISPUTE_RAISED', (SELECT status FROM marketplace_orders WHERE order_id = ?), 'disputed', ?)`,
                [uuidv4(), order_id, raised_by, order_id, JSON.stringify({ dispute_id, reason })]
            );

            await connection.commit();
            return dispute_id;
        } catch (error) {
            await connection.rollback();
            logger.error('Error in createDispute:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Get orders for a user (as buyer or seller) with images – KES prices
     */
    /**
     * Get user's orders with filters and pagination
     */
    static async getUserOrders(filters) {
        const { userId, limit, offset, role } = filters;
        
        let query = `
            SELECT o.*,
                   lm.media_url AS listing_image,
                   buyer.username AS buyer_username,
                   seller.username AS seller_username
            FROM marketplace_orders o
            LEFT JOIN listing_media lm ON lm.listing_id = o.listing_id AND lm.upload_order = 0
            JOIN users buyer ON o.buyer_id = buyer.user_id
            JOIN users seller ON o.seller_id = seller.user_id
            WHERE 1=1
        `;
        const params = [];

        if (role === 'buyer') {
            query += ' AND o.buyer_id = ?';
            params.push(userId);
        } else if (role === 'seller') {
            query += ' AND o.seller_id = ?';
            params.push(userId);
        } else {
            query += ' AND (o.buyer_id = ? OR o.seller_id = ?)';
            params.push(userId, userId);
        }

        query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [orders] = await pool.query(query, params);

        // Get count
        let countQuery = 'SELECT COUNT(*) as total FROM marketplace_orders WHERE 1=1';
        const countParams = [];
        if (role === 'buyer') {
            countQuery += ' AND buyer_id = ?';
            countParams.push(userId);
        } else if (role === 'seller') {
            countQuery += ' AND seller_id = ?';
            countParams.push(userId);
        } else {
            countQuery += ' AND (buyer_id = ? OR seller_id = ?)';
            countParams.push(userId, userId);
        }

        const [[countResult]] = await pool.query(countQuery, countParams);

        return {
            orders,
            pagination: {
                total: countResult.total,
                limit,
                offset,
                hasMore: offset + orders.length < countResult.total
            }
        };
    }

    /**
     * Get user's orders (Legacy - matching current usage)
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

    static async getSellerProfile(userId) {
        try {
            // Get user basic info and aggregate ratings
            const [users] = await pool.query(
                `SELECT u.user_id, u.username, u.name, u.avatar_url, u.campus, u.is_verified, u.joined_at as created_at,
                        (SELECT AVG(rating) FROM marketplace_reviews WHERE reviewee_id = u.user_id) as average_rating,
                        (SELECT COUNT(*) FROM marketplace_reviews WHERE reviewee_id = u.user_id) as total_reviews,
                        (SELECT COUNT(*) FROM marketplace_listings WHERE seller_id = u.user_id AND status = 'active') as active_listings
                 FROM users u
                 WHERE u.user_id = ?`,
                [userId]
            );

            if (users.length === 0) return null;
            const user = users[0];

            // Get recent listings
            const [listings] = await pool.query(
                `SELECT * FROM marketplace_listings 
                 WHERE seller_id = ? AND status = 'active' 
                 ORDER BY created_at DESC LIMIT 20`,
                [userId]
            );

            // Get recent reviews received
            const [reviews] = await pool.query(
                `SELECT r.*, u.username as reviewer_name, u.avatar_url as reviewer_avatar
                 FROM marketplace_reviews r
                 JOIN users u ON r.reviewer_id = u.user_id
                 WHERE r.reviewee_id = ?
                 ORDER BY r.created_at DESC LIMIT 10`,
                [userId]
            );

            return {
                ...user,
                listings,
                reviews
            };
        } catch (error) {
            logger.error('Error in getSellerProfile:', error);
            throw error;
        }
    }
}

module.exports = Marketplace;