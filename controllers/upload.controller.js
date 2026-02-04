const logger = require('../utils/logger');

const uploadMedia = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // The file is already uploaded to Cloudinary by the multer middleware
        res.json({
            success: true,
            url: req.file.path || req.file.secure_url,
            public_id: req.file.filename
        });
    } catch (error) {
        logger.error('Upload media error:', error);
        res.status(500).json({ error: 'Failed to upload media' });
    }
};

module.exports = {
    uploadMedia
};
