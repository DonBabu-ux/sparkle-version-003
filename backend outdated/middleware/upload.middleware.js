// middleware for handling file uploads via Multer and Cloudinary
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// General storage for arbitrary media uploads
const mediaStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'uploads', // folder in Cloudinary
    resource_type: 'auto', // let Cloudinary infer type (image, video, etc.)
    // preserve original filename if possible
    public_id: (req, file) => `${Date.now()}_${file.originalname}`,
  },
});
const upload = multer({ storage: mediaStorage });

// Separate storage for message attachments (might be placed under a different folder)
const messageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'message_attachments',
    resource_type: 'auto',
    public_id: (req, file) => `${Date.now()}_${file.originalname}`,
  },
});
const messageUpload = multer({ storage: messageStorage });

module.exports = {
  upload,
  messageUpload,
};
