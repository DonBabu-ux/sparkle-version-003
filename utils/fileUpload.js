const { upload } = require('../middleware/upload.middleware');

/**
 * Standardized upload utility for marketplace and general media.
 * Uses unified Cloudinary configuration from upload.middleware.js.
 */
module.exports = upload;