const pool = require('../config/database');
const crypto = require('crypto');

class Marketplace {
    /**
     * Get all marketplace listings
     */
    static async getListings(filters = {}) {
        let query = `SELECT m.*, u.username as seller_username, u.avatar_url as seller_avatar
                     FROM marketplace_listings m 
                     JOIN users u ON m.seller_id = u.user_id 
                     WHERE m.is_sold = FALSE`;
        const params = [];

        if (filters.campus) {
            query += ' AND m.campus = ?';
            params.push(filters.campus);
        }

        if (filters.category) {
            query += ' AND m.category = ?';
            params.push(filters.category);
        }

        if (filters.max_price) {
            query += ' AND m.price <= ?';
            params.push(filters.max_price);
        }

        query += ' ORDER BY m.created_at DESC LIMIT 20';

        const [listings] = await pool.query(query, params);
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
     * Create marketplace listing
     */
    static async createListing(sellerId, listingData) {
        const listingId = crypto.randomUUID();
        await pool.query(
            `INSERT INTO marketplace_listings (listing_id, seller_id, title, description, price, category, condition, campus, location, image_url) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                listingData.image_url || null
            ]
        );
        return listingId;
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
}

module.exports = Marketplace;
