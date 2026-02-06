const pool = require('../config/database');
const crypto = require('crypto');

class Marketplace {
    // ... keep your existing methods ...

    /**
     * Create listing with multiple media files
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
        return listing;
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
             AND (listing_id = ? OR listing_id IS NULL)`,
            [participant1, participant2, listingId]
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
        
        return { chat_id: chatId, participant1_id: participant1, participant2_id: participant2, listing_id: listingId };
    }

    /**
     * Send message
     */
    static async sendMessage(chatId, senderId, content) {
        const messageId = crypto.randomUUID();
        await pool.query(
            `INSERT INTO messages (message_id, chat_id, sender_id, content) 
             VALUES (?, ?, ?, ?)`,
            [messageId, chatId, senderId, content]
        );
        
        // Update chat last message
        await pool.query(
            `UPDATE chats 
             SET last_message = ?, last_message_time = CURRENT_TIMESTAMP 
             WHERE chat_id = ?`,
            [content.substring(0, 200), chatId] // Store first 200 chars
        );
        
        return messageId;
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
                    ml.title as listing_title
             FROM chats c
             JOIN users u1 ON c.participant1_id = u1.user_id
             JOIN users u2 ON c.participant2_id = u2.user_id
             LEFT JOIN marketplace_listings ml ON c.listing_id = ml.listing_id
             WHERE c.participant1_id = ? OR c.participant2_id = ?
             ORDER BY c.last_message_time DESC`,
            [userId, userId]
        );
        
        return chats;
    }

    /**
     * Search listings with filters
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
        if (filters.tags && Array.isArray(filters.tags)) {
            filters.tags.forEach(tag => {
                query += ' AND JSON_CONTAINS(m.tags, ?)';
                params.push(JSON.stringify(tag));
            });
        }

        query += ' ORDER BY m.created_at DESC';
        
        // Pagination
        if (filters.limit) {
            query += ' LIMIT ?';
            params.push(filters.limit);
        }
        if (filters.offset) {
            query += ' OFFSET ?';
            params.push(filters.offset);
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
}

module.exports = Marketplace;
