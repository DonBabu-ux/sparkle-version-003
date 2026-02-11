const LostFound = require('../models/LostFound');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const getFeed = async (req, res) => {
    try {
        const filters = {
            campus: req.query.campus || (req.user && req.user.campus) || 'all',
            type: req.query.type,
            status: req.query.status || 'open'
        };

        const items = await LostFound.findAll(filters);
        res.json(items);
    } catch (error) {
        logger.error('Get Lost & Found feed error:', error);
        res.status(500).json({ error: 'Failed to fetch items' });
    }
};

const getItem = async (req, res) => {
    try {
        const item = await LostFound.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        res.json(item);
    } catch (error) {
        logger.error('Get Lost & Found item error:', error);
        res.status(500).json({ error: 'Failed to fetch item' });
    }
};

const reportItem = async (req, res) => {
    try {
        const { type, title, description, category, location, date_lost_found, contact_info } = req.body;

        // Handle image upload (single or multiple)
        // req.file is populated by multer if single, req.files if multiple
        // We'll rely on the route configuration to use upload.array('media')

        const mediaUrls = [];
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                // Ensure URL starts with /uploads/
                mediaUrls.push('/uploads/' + file.filename);
            });
        } else if (req.body.media_url) {
            mediaUrls.push(req.body.media_url);
        }

        const itemData = {
            item_id: uuidv4(),
            reporter_id: req.user.user_id || req.user.userId,
            type,
            title,
            description,
            category,
            campus: req.body.campus || req.user.campus || 'main',
            location,
            date_lost_found: date_lost_found || new Date(),
            contact_info,
            image_url: mediaUrls.length > 0 ? mediaUrls[0] : null,
            media: mediaUrls
        };

        const newItem = await LostFound.create(itemData);
        res.status(201).json(newItem);
    } catch (error) {
        logger.error('Report Lost & Found item error:', error);
        res.status(500).json({ error: 'Failed to report item' });
    }
};

const claimItem = async (req, res) => {
    try {
        const { id } = req.params;
        await LostFound.updateStatus(id, 'claimed', req.user.user_id);
        res.json({ success: true, message: 'Item claimed successfully' });
    } catch (error) {
        logger.error('Claim item error:', error);
        res.status(500).json({ error: 'Failed to claim item' });
    }
};

const deleteItem = async (req, res) => {
    try {
        const { id } = req.params;
        const item = await LostFound.findById(id);

        if (!item) return res.status(404).json({ error: 'Item not found' });

        // Check ownership
        if (item.reporter_id !== req.user.user_id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        await LostFound.delete(id);
        res.json({ success: true, message: 'Item deleted' });
    } catch (error) {
        logger.error('Delete item error:', error);
        res.status(500).json({ error: 'Failed to delete item' });
    }
};

module.exports = {
    getFeed,
    getItem,
    reportItem,
    claimItem,
    deleteItem
};
