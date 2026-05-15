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

const https = require('https');
let timeOffsetSeconds = 0;

// Dynamically fix Cloudinary "Stale request" due to system time skew
https.get('https://api.cloudinary.com', (res) => {
    if (res.headers.date) {
        const apiDate = new Date(res.headers.date);
        timeOffsetSeconds = Math.round((apiDate - new Date()) / 1000);
        console.log(`[Cloudinary] Time offset adjusted by ${timeOffsetSeconds} seconds`);
    }
}).on('error', () => {
    timeOffsetSeconds = 0; // safe fallback – no offset
});


// Helper to get fresh drift (Real-Time Sync)
const getDrift = () => new Promise((resolve) => {
    https.get('https://api.cloudinary.com/v1_1/demo/ping', (res) => {
        const serverDate = new Date(res.headers.date);
        resolve(Math.round((serverDate.getTime() - Date.now()) / 1000));
    }).on('error', () => resolve(21447)); // Fallback to last known good drift
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        console.log('☁️ Starting Cloudinary Upload for field:', file.fieldname, '| Original Name:', file.originalname);
        const dynamicDrift = await getDrift();
        const patchedTimestamp = Math.round(Date.now() / 1000) + dynamicDrift;
        const folder = file.fieldname === 'avatar' ? 'sparkle_avatars' : 'sparkle_uploads';
        
        console.log(`🕒 Time Drift Sync: ${dynamicDrift}s | Patched Timestamp: ${patchedTimestamp} | Folder: ${folder}`);
        
        return {
            folder: folder,
            resource_type: 'auto',
            timestamp: patchedTimestamp,
            public_id: `${file.fieldname}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
            allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi', 'webm', 'm4v'],
            transformation: file.fieldname === 'avatar' ? [{ width: 500, height: 500, crop: 'limit' }] : []
        };
    },
});

const marketplaceStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        const driftOffset = 21447;
        const patchedTimestamp = Math.round(Date.now() / 1000) + driftOffset;
        return {
            folder: 'marketplace_listings',
            allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
            transformation: [{ width: 1000, height: 1000, crop: 'limit' }],
            timestamp: patchedTimestamp
        };
    }
});

const messageStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        return {
            folder: 'sparkle_messages',
            resource_type: 'auto',
            timestamp: Math.round(Date.now() / 1000) + timeOffsetSeconds,
            public_id: `msg-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
            // We omit allowed_formats to allow 'raw' files like .pdf and 'video' like .mp3 and auto-detect
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
        fileSize: 3 * 1024 * 1024 // 3MB limit for profile/avatar/group icons
    }
});

const marketplaceUpload = multer({
    storage: marketplaceStorage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const ext = path.extname(file.originalname).toLowerCase();
        const isExtMatch = allowedTypes.test(ext);
        const isMimeMatch = allowedTypes.test(file.mimetype);

        if (isExtMatch && isMimeMatch) {
            return cb(null, true);
        } else {
            cb(new Error('Invalid file type! Only images are allowed for marketplace listings.'));
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB per image
    }
});

const messageUpload = multer({
    storage: messageStorage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit (Strictly match frontend logic for videos/docs)
    }
});

const momentsStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        const dynamicDrift = await getDrift();
        const patchedTimestamp = Math.round(Date.now() / 1000) + dynamicDrift;
        
        console.log('🎥 MOMENT HD PIPELINE: Starting high-fidelity upload');
        
        return {
            folder: 'sparkle_moments_hd',
            resource_type: 'video',
            timestamp: patchedTimestamp,
            public_id: `moment-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
            allowed_formats: ['mp4', 'mov', 'avi', 'webm', 'mkv'],
            // HD Transcoding & Adaptive Streaming Strategy
            streaming_profile: 'full_hd', // Generates HLS bitrates up to 1080p
            eager: [
                // 1080p High Quality MP4 (Preserve detail)
                { width: 1080, height: 1920, crop: 'limit', quality: 'auto:best', format: 'mp4', bit_rate: '6m' },
                // 720p Balanced MP4
                { width: 720, height: 1280, crop: 'limit', quality: 'auto:good', format: 'mp4', bit_rate: '3.5m' },
                // HD Thumbnail/Cover
                { width: 1080, height: 1920, crop: 'limit', format: 'jpg', quality: 'auto:best' }
            ],
            eager_async: true, // Non-blocking upload
            transformation: [
                { quality: 'auto:best' }, // Global quality setting
                { fetch_format: 'auto' }
            ]
        };
    },
});

const momentsUpload = multer({
    storage: momentsStorage,
    limits: {
        fileSize: 100 * 1024 * 1024 // Increased to 100MB for 1080p HD videos
    }
});

const postUpload = multer({
    storage: storage,
    limits: {
        fileSize: 15 * 1024 * 1024 // 15MB limit for posts (photos/small videos)
    }
});

const storiesUpload = multer({
    storage: storage,
    limits: {
        fileSize: 20 * 1024 * 1024 // 20MB limit for Stories (allows high-res videos/images)
    }
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
