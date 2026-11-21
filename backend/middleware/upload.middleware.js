const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { CompressedCloudinaryStorage } = require('../utils/compressStorage');
const R2StorageEngine = require('../utils/r2Storage');
require('dotenv').config();

// Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const isR2Primary = (process.env.MEDIA_STORAGE_PRIMARY || 'r2').toLowerCase() === 'r2';

let storage;
let marketplaceStorage;
let messageStorage;
let momentsStorage;

if (isR2Primary) {
    console.log('⚡ [UploadMiddleware] Cloudflare R2 enabled as PRIMARY media storage engine');
    storage = new R2StorageEngine({ category: 'general', maxEdge: 1600, quality: 80 });
    marketplaceStorage = new R2StorageEngine({ category: 'marketplace', maxEdge: 1200, quality: 80 });
    messageStorage = new R2StorageEngine({ category: 'message', maxEdge: 1600, quality: 80 });
    momentsStorage = new R2StorageEngine({ category: 'moment', maxEdge: 1920, quality: 85 });
} else {
    console.log('☁️ [UploadMiddleware] Cloudinary legacy enabled as media storage engine');
    const baseStorage = new CloudinaryStorage({
        cloudinary: cloudinary,
        params: async (req, file) => {
            const folder = file.fieldname === 'avatar' ? 'sparkle_avatars' : 'sparkle_uploads';
            return {
                folder: folder,
                resource_type: 'auto',
                public_id: `${file.fieldname}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
                allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi', 'webm', 'm4v']
            };
        }
    });
    storage = new CompressedCloudinaryStorage(baseStorage, { maxEdge: 1600, quality: 80 });

    const baseMarketplaceStorage = new CloudinaryStorage({
        cloudinary: cloudinary,
        params: async () => ({
            folder: 'marketplace_listings',
            allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'gif']
        })
    });
    marketplaceStorage = new CompressedCloudinaryStorage(baseMarketplaceStorage, { maxEdge: 1200, quality: 80 });

    const baseMessageStorage = new CloudinaryStorage({
        cloudinary: cloudinary,
        params: async () => ({
            folder: 'sparkle_messages',
            resource_type: 'auto',
            public_id: `msg-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
        })
    });
    messageStorage = new CompressedCloudinaryStorage(baseMessageStorage, { maxEdge: 1600, quality: 80 });

    momentsStorage = new CloudinaryStorage({
        cloudinary: cloudinary,
        params: async () => ({
            folder: 'sparkle_moments_hd',
            resource_type: 'video',
            public_id: `moment-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
            allowed_formats: ['mp4', 'mov', 'avi', 'webm', 'mkv']
        })
    });
}

const fileFilterImagesAndVideos = (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const isImageOrVideoMime = file.mimetype ? (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/') || file.mimetype === 'application/octet-stream') : false;
    const isImageOrVideoExt = /\.(jpg|jpeg|png|gif|webp|jfif|avif|heic|heif|bmp|svg|mp4|webm|mov|avi|m4v)$/i.test(ext);

    if (isImageOrVideoMime || isImageOrVideoExt) {
        return cb(null, true);
    }
    cb(new Error('Invalid file type! Only images and videos are allowed.'));
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilterImagesAndVideos,
    limits: { fileSize: 15 * 1024 * 1024 }
});

const marketplaceUpload = multer({
    storage: marketplaceStorage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const isImageMime = file.mimetype ? (file.mimetype.startsWith('image/') || file.mimetype === 'application/octet-stream') : false;
        const isImageExt = /\.(jpg|jpeg|png|gif|webp|jfif|avif|heic|heif|bmp|svg|tiff)$/i.test(ext);

        if (isImageMime || isImageExt) {
            return cb(null, true);
        }
        cb(new Error('Invalid file type! Only images are allowed for marketplace listings.'));
    },
    limits: { fileSize: 10 * 1024 * 1024 }
});

const messageUpload = multer({
    storage: messageStorage,
    limits: { fileSize: 25 * 1024 * 1024 }
});

const momentsUpload = multer({
    storage: momentsStorage,
    limits: { fileSize: 100 * 1024 * 1024 }
});

const postUpload = multer({
    storage: storage,
    fileFilter: fileFilterImagesAndVideos,
    limits: { fileSize: 25 * 1024 * 1024 }
});

const storiesUpload = multer({
    storage: storage,
    fileFilter: fileFilterImagesAndVideos,
    limits: { fileSize: 25 * 1024 * 1024 }
});

module.exports = {
    upload,
    marketplaceUpload,
    messageUpload,
    momentsUpload,
    postUpload,
    storiesUpload,
    cloudinary
};
