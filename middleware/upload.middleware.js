const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

// Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        const folder = file.fieldname === 'avatar' ? 'sparkle_avatars' : 'sparkle_uploads';
        return {
            folder: folder,
            resource_type: 'auto',
            public_id: `${file.fieldname}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
            allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi', 'webm'],
            transformation: file.fieldname === 'avatar' ? [{ width: 500, height: 500, crop: 'limit' }] : []
        };
    },
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|webm|mov|avi/;
        const ext = path.extname(file.originalname).toLowerCase();
        const isExtMatch = allowedTypes.test(ext);
        const isMimeMatch = allowedTypes.test(file.mimetype);

        if (isExtMatch && isMimeMatch) {
            return cb(null, true);
        } else {
            cb(new Error('Invalid file type! Only images and videos are allowed.'));
        }
    },
    limits: { 
        fileSize: 50 * 1024 * 1024 // 50MB total limit
    }
});

module.exports = {
    upload,
    cloudinary
};
