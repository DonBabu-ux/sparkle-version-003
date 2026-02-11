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
}

module.exports = SkillMarket;
