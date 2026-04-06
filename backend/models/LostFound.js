const pool = require('../config/database');
const logger = require('../utils/logger');

class LostFound {
    static async create(itemData) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const query = `
                INSERT INTO lost_found_items 
                (item_id, reporter_id, type, title, description, category, campus, location, date_lost_found, contact_info, status, image_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
            `;

            // For now, image_url in main table stores the primary image (first one)
            // We can add multiple images to lost_found_media later if needed

            const values = [
                itemData.item_id,
                itemData.reporter_id,
                itemData.type,
                itemData.title,
                itemData.description,
                itemData.category,
                itemData.campus,
                itemData.location,
                itemData.date_lost_found,
                itemData.contact_info,
                itemData.image_url // Primary image
            ];

            await connection.query(query, values);

            // Handle multiple media if provided
            if (itemData.media && Array.isArray(itemData.media) && itemData.media.length > 0) {
                const mediaQuery = `
                    INSERT INTO lost_found_media (media_id, item_id, media_url, media_type, upload_order)
                    VALUES ?
                `;
                const mediaValues = itemData.media.map((url, index) => [
                    require('crypto').randomUUID(),
                    itemData.item_id,
                    url,
                    'image', // Default to image for now
                    index
                ]);
                await connection.query(mediaQuery, [mediaValues]);
            }

            await connection.commit();
            return itemData;
        } catch (error) {
            await connection.rollback();
            logger.error('Error creating lost/found item:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    static async findAll(filters) {
        try {
            let query = `
                SELECT i.*, u.username as reporter_username, u.avatar_url as reporter_avatar 
                FROM lost_found_items i
                JOIN users u ON i.reporter_id = u.user_id
                WHERE 1=1
            `;
            const params = [];

            if (filters.campus && filters.campus !== 'all') {
                query += ' AND i.campus = ?';
                params.push(filters.campus);
            }
            if (filters.type && filters.type !== 'all') {
                query += ' AND i.type = ?';
                params.push(filters.type);
            }
            if (filters.status) {
                query += ' AND i.status = ?';
                params.push(filters.status);
            }

            query += ' ORDER BY i.created_at DESC';

            const [items] = await pool.query(query, params);
            return items;
        } catch (error) {
            logger.error('Error finding lost/found items:', error);
            throw error;
        }
    }

    static async findById(itemId) {
        try {
            const query = `
                SELECT i.*, u.username as reporter_username, u.avatar_url as reporter_avatar 
                FROM lost_found_items i
                JOIN users u ON i.reporter_id = u.user_id
                WHERE i.item_id = ?
            `;
            const [rows] = await pool.query(query, [itemId]);
            if (rows.length === 0) return null;

            const item = rows[0];

            // Fetch validation media
            const [media] = await pool.query('SELECT * FROM lost_found_media WHERE item_id = ? ORDER BY upload_order', [itemId]);
            item.media = media; // Attach media array

            return item;
        } catch (error) {
            logger.error('Error finding lost/found item by ID:', error);
            throw error;
        }
    }

    static async updateStatus(itemId, status, claimedBy = null) {
        try {
            let query = 'UPDATE lost_found_items SET status = ?';
            const params = [status];

            if (claimedBy) {
                query += ', claimed_by = ?, claimed_at = NOW()';
                params.push(claimedBy);
            }

            query += ' WHERE item_id = ?';
            params.push(itemId);

            await pool.query(query, params);
            return true;
        } catch (error) {
            logger.error('Error updating lost/found item status:', error);
            throw error;
        }
    }

    static async delete(itemId) {
        try {
            await pool.query('DELETE FROM lost_found_items WHERE item_id = ?', [itemId]);
            return true;
        } catch (error) {
            logger.error('Error deleting lost/found item:', error);
            throw error;
        }
    }
}

module.exports = LostFound;
