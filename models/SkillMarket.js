const pool = require('../config/database');
const logger = require('../utils/logger');

class SkillMarket {
    static async createOffer(offerData) {
        try {
            const query = `
                INSERT INTO skill_offers 
                (offer_id, user_id, title, description, category, skill_type, price, is_free, campus)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const values = [
                offerData.offer_id,
                offerData.user_id,
                offerData.title,
                offerData.description,
                offerData.category,
                offerData.skill_type,
                offerData.price,
                offerData.is_free,
                offerData.campus
            ];
            await pool.query(query, values);
            return offerData;
        } catch (error) {
            logger.error('Error creating skill offer:', error);
            throw error;
        }
    }

    static async findAll(filters) {
        try {
            let query = `
                SELECT s.*, u.username, u.name, u.avatar_url,
                (SELECT AVG(rating) FROM skill_reviews r WHERE r.offer_id = s.offer_id) as average_rating,
                (SELECT COUNT(*) FROM skill_reviews r WHERE r.offer_id = s.offer_id) as review_count
                FROM skill_offers s
                JOIN users u ON s.user_id = u.user_id
                WHERE s.is_active = 1
            `;
            const params = [];

            if (filters.campus && filters.campus !== 'all') {
                query += ' AND s.campus = ?';
                params.push(filters.campus);
            }
            if (filters.category && filters.category !== 'all') {
                query += ' AND s.category = ?';
                params.push(filters.category);
            }
            if (filters.search) {
                query += ' AND (s.title LIKE ? OR s.description LIKE ?)';
                params.push(`%${filters.search}%`, `%${filters.search}%`);
            }

            query += ' ORDER BY s.created_at DESC';

            const [offers] = await pool.query(query, params);
            return offers;
        } catch (error) {
            logger.error('Error finding skill offers:', error);
            throw error;
        }
    }

    static async findById(offerId) {
        try {
            const query = `
                SELECT s.*, u.username, u.name, u.avatar_url,
                (SELECT AVG(rating) FROM skill_reviews r WHERE r.offer_id = s.offer_id) as average_rating,
                (SELECT COUNT(*) FROM skill_reviews r WHERE r.offer_id = s.offer_id) as review_count
                FROM skill_offers s
                JOIN users u ON s.user_id = u.user_id
                WHERE s.offer_id = ?
            `;
            const [rows] = await pool.query(query, [offerId]);
            return rows[0];
        } catch (error) {
            logger.error('Error seeking skill offer by ID:', error);
            throw error;
        }
    }

    static async createBooking(bookingData) {
        try {
            const query = `
                INSERT INTO skill_bookings
                (booking_id, offer_id, booker_id, booking_date, duration_minutes, notes, status)
                VALUES (?, ?, ?, ?, ?, ?, 'pending')
            `;
            await pool.query(query, [
                bookingData.booking_id,
                bookingData.offer_id,
                bookingData.booker_id,
                bookingData.booking_date,
                bookingData.duration_minutes,
                bookingData.notes
            ]);
            return bookingData;
        } catch (error) {
            logger.error('Error creating skill booking:', error);
            throw error;
        }
    }

    static async getClientBookings(userId) {
        try {
            const query = `
                SELECT b.*, s.title, s.category, s.price, u.username as provider_username, u.name as provider_name, u.avatar_url as provider_avatar,
                (SELECT rating FROM skill_reviews r WHERE r.offer_id = b.offer_id AND r.reviewer_id = b.booker_id LIMIT 1) as my_rating
                FROM skill_bookings b
                JOIN skill_offers s ON b.offer_id = s.offer_id
                JOIN users u ON s.user_id = u.user_id
                WHERE b.booker_id = ?
                ORDER BY b.created_at DESC
            `;
            const [rows] = await pool.query(query, [userId]);
            return rows;
        } catch (error) {
            logger.error('Error getting client bookings:', error);
            throw error;
        }
    }

    static async getProviderBookings(userId) {
        try {
            const query = `
                SELECT b.*, s.title, u.username as client_username, u.name as client_name, u.avatar_url as client_avatar
                FROM skill_bookings b
                JOIN skill_offers s ON b.offer_id = s.offer_id
                JOIN users u ON b.booker_id = u.user_id
                WHERE s.user_id = ?
                ORDER BY b.created_at DESC
            `;
            const [rows] = await pool.query(query, [userId]);
            return rows;
        } catch (error) {
            logger.error('Error getting provider bookings:', error);
            throw error;
        }
    }

    static async updateOffer(offerId, updates) {
        const allowed = ['title', 'description', 'category', 'skill_type', 'price', 'is_free', 'availability'];
        const fields = [], values = [];
        for (const [k, v] of Object.entries(updates)) {
            if (allowed.includes(k)) { fields.push(`${k} = ?`); values.push(v); }
        }
        if (fields.length === 0) return;
        values.push(offerId);
        await pool.query(`UPDATE skill_offers SET ${fields.join(', ')} WHERE offer_id = ?`, values);
    }

    static async deleteOffer(offerId) {
        await pool.query('UPDATE skill_offers SET is_active = 0 WHERE offer_id = ?', [offerId]);
    }

    static async rateExchange(bookingId, userId, rating, review) {
        const reviewId = require('crypto').randomUUID();
        // Look up the offer_id from the booking
        const [rows] = await pool.query('SELECT offer_id FROM skill_bookings WHERE booking_id = ?', [bookingId]);
        if (!rows.length) throw new Error('Booking not found');
        const { offer_id } = rows[0];
        
        // Delete existing review for this offer by this user to simulate UPSERT since we lack a composite unique key
        await pool.query('DELETE FROM skill_reviews WHERE offer_id = ? AND reviewer_id = ?', [offer_id, userId]);
        
        await pool.query(
            `INSERT INTO skill_reviews (review_id, offer_id, reviewer_id, rating, comment, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [reviewId, offer_id, userId, rating, review || null]
        );
    }

    static async getOfferReviews(offerId) {
        try {
            const query = `
                SELECT r.rating, r.comment, r.created_at, u.username, u.avatar_url
                FROM skill_reviews r
                JOIN users u ON r.reviewer_id = u.user_id
                WHERE r.offer_id = ?
                ORDER BY r.created_at DESC
            `;
            const [reviews] = await pool.query(query, [offerId]);
            return reviews;
        } catch (error) {
            logger.error('Error fetching skill offer reviews:', error);
            throw error;
        }
    }
}

module.exports = SkillMarket;
