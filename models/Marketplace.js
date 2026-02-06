const pool = require('../config/database');
const crypto = require('crypto');

class Marketplace {
    /**
     * Get all marketplace listings with filters
     */
    static async getListings(filters = {}) {
        let query = `SELECT m.*, u.username as seller_username, u.avatar_url as seller_avatar
                     FROM marketplace_listings m 
                     JOIN users u ON m.seller_id = u.user_id 
                     WHERE m.is_sold = FALSE AND m.status = 'active'`;
        const params = [];

        if (filters.campus) {
            query += ' AND m.campus = ?';
            params.push(filters.campus);
        }

        if (filters.category && filters.category !== 'all') {
            query += ' AND m.category = ?';
            params.push(filters.category);
        }

        if (filters.max_price) {
            query += ' AND m.price <= ?';
            params.push(filters.max_price);
        }

        query += ' ORDER BY m.created_at DESC LIMIT 20';

        const [listings] = await pool.query(query, params);
        
        // Get media for each listing
        for (let listing of listings) {
            const [media] = await pool.query(
                'SELECT * FROM listing_media WHERE listing_id = ? ORDER BY upload_order',
                [listing.listing_id]
            );
            listing.media = media;
            listing.image_urls = media.filter(m => m.media_type === 'image').map(m => m.media_url);
        }
        
        return listings;
    }

    /**
     * Search listings with advanced filters
     */
    static async searchListings(filters = {}) {
        let query = `SELECT m.*, u.username as seller_username, u.avatar_url as seller_avatar
                     FROM marketplace_listings m 
                     JOIN users u ON m.seller_id = u.user_id 
                     WHERE m.status = 'active'`;
        const params = [];

        // Category filter
        if (filters.category && filters.category !== 'all') {
            query += ' AND m.category = ?';
            params.push(filters.category);
        }

        // Price range filter
        if (filters.min_price) {
            query += ' AND m.price >= ?';
            params.push(filters.min_price);
        }
        if (filters.max_price) {
            query += ' AND m.price <= ?';
            params.push(filters.max_price);
        }

        // Campus filter
        if (filters.campus) {
            query += ' AND m.campus = ?';
            params.push(filters.campus);
        }

        // Search term
        if (filters.search) {
            query += ' AND (m.title LIKE ? OR m.description LIKE ?)';
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm);
        }

        // Tags filter (if using JSON)
        if (filters.tags && Array.isArray(filters.tags) && filters.tags.length > 0) {
            filters.tags.forEach(tag => {
                query += ' AND JSON_CONTAINS(m.tags, ?)';
                params.push(JSON.stringify(tag));
            });
        }

        query += ' ORDER BY m.created_at DESC';
        
        // Pagination
        if (filters.limit) {
            query += ' LIMIT ?';
            params.push(parseInt(filters.limit));
        }
        if (filters.offset) {
            query += ' OFFSET ?';
            params.push(parseInt(filters.offset));
        }

        const [listings] = await pool.query(query, params);
        
        // Get media for each listing
        for (let listing of listings) {
            const [media] = await pool.query(
                'SELECT * FROM listing_media WHERE listing_id = ? ORDER BY upload_order',
                [listing.listing_id]
            );
            listing.media = media;
            listing.image_urls = media.filter(m => m.media_type === 'image').map(m => m.media_url);
        }
        
        return listings;
    }

    /**
     * Get lost & found items
     */
    static async getLostFoundItems(filters = {}) {
        let query = `SELECT lf.*, u.username as reporter_username 
                     FROM lost_found_items lf 
                     JOIN users u ON lf.reporter_id = u.user_id 
                     WHERE lf.status = 'open'`;
        const params = [];

        if (filters.campus) {
            query += ' AND lf.campus = ?';
            params.push(filters.campus);
        }

        if (filters.type) {
            query += ' AND lf.type = ?';
            params.push(filters.type);
        }

        query += ' ORDER BY lf.created_at DESC LIMIT 20';

        const [items] = await pool.query(query, params);
        return items;
    }

    /**
     * Get skill offers
     */
    static async getSkillOffers(filters = {}) {
        let query = `SELECT so.*, u.username, u.avatar_url
                     FROM skill_offers so 
                     JOIN users u ON so.user_id = u.user_id 
                     WHERE so.is_active = TRUE`;
        const params = [];

        if (filters.campus) {
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
    }

    /**
     * Create marketplace listing (single image - legacy)
     */
    static async createListing(sellerId, listingData) {
        const listingId = crypto.randomUUID();
        await pool.query(
            `INSERT INTO marketplace_listings (listing_id, seller_id, title, description, price, category, condition, campus, location, image_url, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                listingId,
                sellerId,
                listingData.title,
                listingData.description,
                listingData.price,
                listingData.category || null,
                listingData.condition || 'good',
                listingData.campus,
                listingData.location || null,
                listingData.image_url || null,
                'active'
            ]
        );
        return listingId;
    }

    /**
     * Create marketplace listing with multiple media files
     */
    static async createListingWithMedia(sellerId, listingData, mediaFiles = []) {
        const listingId = crypto.randomUUID();
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            // Insert listing
            await connection.query(
                `INSERT INTO marketplace_listings 
                (listing_id, seller_id, title, description, price, category, condition, campus, location, status, tags) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    listingId,
                    sellerId,
                    listingData.title,
                    listingData.description,
                    listingData.price,
                    listingData.category || null,
                    listingData.condition || 'good',
                    listingData.campus,
                    listingData.location || null,
                    'active',
                    listingData.tags ? JSON.stringify(listingData.tags) : null
                ]
            );
            
            // Insert media files
            for (let i = 0; i < mediaFiles.length; i++) {
                const media = mediaFiles[i];
                await connection.query(
                    `INSERT INTO listing_media (media_id, listing_id, media_url, media_type, upload_order) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        crypto.randomUUID(),
                        listingId,
                        media.url,
                        media.type,
                        i
                    ]
                );
            }
            
            await connection.commit();
            return listingId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Get listing with all media
     */
    static async getListingWithMedia(listingId) {
        const [listings] = await pool.query(
            `SELECT m.*, u.username as seller_username, u.avatar_url as seller_avatar
             FROM marketplace_listings m 
             JOIN users u ON m.seller_id = u.user_id 
             WHERE m.listing_id = ?`,
            [listingId]
        );
        
        if (listings.length === 0) return null;
        
        const listing = listings[0];
        
        // Get media files
        const [media] = await pool.query(
            `SELECT * FROM listing_media 
             WHERE listing_id = ? 
             ORDER BY upload_order ASC`,
            [listingId]
        );
        
        listing.media = media;
        listing.image_urls = media.filter(m => m.media_type === 'image').map(m => m.media_url);
        return listing;
    }

    /**
     * Create lost/found item
     */
    static async createLostFoundItem(reporterId, itemData) {
        const itemId = crypto.randomUUID();
        await pool.query(
            `INSERT INTO lost_found_items (item_id, reporter_id, type, title, description, category, campus, location, date_lost_found, image_url) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                itemId,
                reporterId,
                itemData.type,
                itemData.title,
                itemData.description,
                itemData.category || null,
                itemData.campus,
                itemData.location || null,
                itemData.date_lost_found || null,
                itemData.image_url || null
            ]
        );
        return itemId;
    }

    /**
     * Create skill offer
     */
    static async createSkillOffer(userId, offerData) {
        const offerId = crypto.randomUUID();
        await pool.query(
            `INSERT INTO skill_offers (offer_id, user_id, title, description, category, skill_type, price, is_free, campus) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                offerId,
                userId,
                offerData.title,
                offerData.description,
                offerData.category || null,
                offerData.skill_type || null,
                offerData.price || null,
                offerData.is_free ? 1 : 0,
                offerData.campus
            ]
        );
        return offerId;
    }

    /**
     * Get or create chat between users
     */
    static async getOrCreateChat(userId1, userId2, listingId = null) {
        // Ensure consistent ordering for unique constraint
        const [participant1, participant2] = [userId1, userId2].sort();
        
        const [existingChats] = await pool.query(
            `SELECT * FROM chats 
             WHERE participant1_id = ? AND participant2_id = ? 
             AND (listing_id = ? OR (listing_id IS NULL AND ? IS NULL))`,
            [participant1, participant2, listingId, listingId]
        );
        
        if (existingChats.length > 0) {
            return existingChats[0];
        }
        
        // Create new chat
        const chatId = crypto.randomUUID();
        await pool.query(
            `INSERT INTO chats (chat_id, participant1_id, participant2_id, listing_id) 
             VALUES (?, ?, ?, ?)`,
            [chatId, participant1, participant2, listingId]
        );
        
        return { 
            chat_id: chatId, 
            participant1_id: participant1, 
            participant2_id: participant2, 
            listing_id: listingId 
        };
    }

    /**
     * Send message
     */
    static async sendMessage(chatId, senderId, content) {
        const messageId = crypto.randomUUID();
        
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            
            // Insert message
            await connection.query(
                `INSERT INTO messages (message_id, chat_id, sender_id, content) 
                 VALUES (?, ?, ?, ?)`,
                [messageId, chatId, senderId, content]
            );
            
            // Update chat last message
            await connection.query(
                `UPDATE chats 
                 SET last_message = ?, last_message_time = CURRENT_TIMESTAMP 
                 WHERE chat_id = ?`,
                [content.length > 200 ? content.substring(0, 197) + '...' : content, chatId]
            );
            
            await connection.commit();
            return messageId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Get chat messages
     */
    static async getChatMessages(chatId, limit = 50) {
        const [messages] = await pool.query(
            `SELECT m.*, u.username as sender_username, u.avatar_url as sender_avatar
             FROM messages m
             JOIN users u ON m.sender_id = u.user_id
             WHERE m.chat_id = ?
             ORDER BY m.created_at DESC
             LIMIT ?`,
            [chatId, limit]
        );
        
        return messages.reverse(); // Return in chronological order
    }

    /**
     * Get user's chats
     */
    static async getUserChats(userId) {
        const [chats] = await pool.query(
            `SELECT c.*, 
                    u1.username as participant1_name,
                    u2.username as participant2_name,
                    ml.title as listing_title,
                    ml.listing_id,
                    CASE 
                        WHEN c.participant1_id = ? THEN u2.avatar_url
                        ELSE u1.avatar_url
                    END as other_user_avatar,
                    CASE 
                        WHEN c.participant1_id = ? THEN u2.username
                        ELSE u1.username
                    END as other_user_name
             FROM chats c
             JOIN users u1 ON c.participant1_id = u1.user_id
             JOIN users u2 ON c.participant2_id = u2.user_id
             LEFT JOIN marketplace_listings ml ON c.listing_id = ml.listing_id
             WHERE c.participant1_id = ? OR c.participant2_id = ?
             ORDER BY c.last_message_time DESC`,
            [userId, userId, userId, userId]
        );
        
        return chats;
    }

    /**
     * Mark messages as read
     */
    static async markMessagesAsRead(chatId, userId) {
        await pool.query(
            `UPDATE messages m
             JOIN chats c ON m.chat_id = c.chat_id
             SET m.is_read = TRUE
             WHERE m.chat_id = ? 
             AND m.sender_id != ?
             AND m.is_read = FALSE`,
            [chatId, userId]
        );
        
        return true;
    }

    /**
     * Get unread message count
     */
    static async getUnreadCount(userId) {
        const [result] = await pool.query(
            `SELECT COUNT(*) as unread_count
             FROM messages m
             JOIN chats c ON m.chat_id = c.chat_id
             WHERE (c.participant1_id = ? OR c.participant2_id = ?)
             AND m.sender_id != ?
             AND m.is_read = FALSE`,
            [userId, userId, userId]
        );
        
        return result[0]?.unread_count || 0;
    }

    /**
     * Update listing status
     */
    static async updateListingStatus(listingId, status) {
        await pool.query(
            `UPDATE marketplace_listings 
             SET status = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE listing_id = ?`,
            [status, listingId]
        );
        
        return true;
    }

    /**
     * Delete listing
     */
    static async deleteListing(listingId, sellerId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            
            // Delete media first
            await connection.query(
                'DELETE FROM listing_media WHERE listing_id = ?',
                [listingId]
            );
            
            // Delete listing
            const [result] = await connection.query(
                'DELETE FROM marketplace_listings WHERE listing_id = ? AND seller_id = ?',
                [listingId, sellerId]
            );
            
            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Get user's listings
     */
    static async getUserListings(userId) {
        const [listings] = await pool.query(
            `SELECT m.*, 
                    (SELECT COUNT(*) FROM listing_media WHERE listing_id = m.listing_id) as media_count
             FROM marketplace_listings m 
             WHERE m.seller_id = ?
             ORDER BY m.created_at DESC`,
            [userId]
        );
        
        // Get first image for each listing
        for (let listing of listings) {
            if (listing.media_count > 0) {
                const [media] = await pool.query(
                    'SELECT media_url FROM listing_media WHERE listing_id = ? AND media_type = "image" ORDER BY upload_order LIMIT 1',
                    [listing.listing_id]
                );
                listing.image_url = media[0]?.media_url || null;
            }
        }
        
        return listings;
    }

    /**
     * Get chat by ID with participants info
     */
    static async getChatById(chatId, userId) {
        const [chats] = await pool.query(
            `SELECT c.*, 
                    u1.username as participant1_name,
                    u2.username as participant2_name,
                    u1.avatar_url as participant1_avatar,
                    u2.avatar_url as participant2_avatar,
                    ml.title as listing_title,
                    ml.listing_id,
                    CASE 
                        WHEN c.participant1_id = ? THEN u2.user_id
                        ELSE u1.user_id
                    END as other_user_id,
                    CASE 
                        WHEN c.participant1_id = ? THEN u2.username
                        ELSE u1.username
                    END as other_user_name,
                    CASE 
                        WHEN c.participant1_id = ? THEN u2.avatar_url
                        ELSE u1.avatar_url
                    END as other_user_avatar
             FROM chats c
             JOIN users u1 ON c.participant1_id = u1.user_id
             JOIN users u2 ON c.participant2_id = u2.user_id
             LEFT JOIN marketplace_listings ml ON c.listing_id = ml.listing_id
             WHERE c.chat_id = ? AND (c.participant1_id = ? OR c.participant2_id = ?)`,
            [userId, userId, userId, chatId, userId, userId]
        );
        
        return chats[0] || null;
    }
}

module.exports = Marketplace;
