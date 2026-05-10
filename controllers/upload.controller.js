const logger = require('../utils/logger');

const MediaService = require('../services/media.service');
const crypto = require('crypto');

const uploadMedia = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const userId = req.user?.userId || req.user?.user_id || 'anonymous';
        const fileSizeBytes = req.file.size || 0;
        const originalName = req.file.originalname || 'unknown';
        const hashChecksum = crypto.createHash('md5').update(`${userId}-${fileSizeBytes}-${originalName}`).digest('hex');
        
        let category = 'temporary';
        if (req.originalUrl.includes('message')) category = 'message';
        else if (req.file.fieldname === 'avatar') category = 'profile';

        try {
            await MediaService.registerMedia({
                ownerId: userId,
                category: category,
                cloudinaryPublicId: req.file.filename,
                secureUrl: req.file.path || req.file.secure_url,
                lifecycleState: 'active',
                isReusable: false,
                fileSizeBytes: fileSizeBytes,
                hashChecksum: hashChecksum
            });
            console.log(`✅ Generic media registered as ${category}`);
        } catch (mediaErr) {
            console.error('⚠️ Media registry failed:', mediaErr.message);
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
