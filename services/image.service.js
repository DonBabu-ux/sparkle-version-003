// services/image.service.js
// Sharp-based local image processing pipeline
// Handles compression, WebP conversion, and thumbnail generation non-blocking
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');
const THUMB_DIR = path.join(UPLOAD_DIR, 'thumbnails');

// Ensure dirs exist
[UPLOAD_DIR, THUMB_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

class ImageService {
    /**
     * Compress and convert image to WebP. Returns saved filename.
     * @param {Buffer} inputBuffer - Raw file buffer from Multer memoryStorage
     * @param {object} options
     */
    async processImage(inputBuffer, options = {}) {
        const {
            width = 1200,
            height = 1200,
            quality = 80,
            fit = 'inside',
            folder = 'general'
        } = options;

        const filename = `${crypto.randomBytes(8).toString('hex')}.webp`;
        const outputDir = path.join(UPLOAD_DIR, folder);
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
        const outputPath = path.join(outputDir, filename);

        await sharp(inputBuffer)
            .rotate()                          // Auto-correct EXIF orientation
            .resize(width, height, { fit, withoutEnlargement: true })
            .webp({ quality })
            .toFile(outputPath);

        return { filename, path: outputPath, url: `/uploads/${folder}/${filename}` };
    }

    /**
     * Generate thumbnail (200x200 WebP) from buffer.
     */
    async generateThumbnail(inputBuffer, originalFilename) {
        const filename = `thumb_${path.parse(originalFilename).name}.webp`;
        const outputPath = path.join(THUMB_DIR, filename);

        await sharp(inputBuffer)
            .rotate()
            .resize(200, 200, { fit: 'cover' })
            .webp({ quality: 70 })
            .toFile(outputPath);

        return { filename, url: `/uploads/thumbnails/${filename}` };
    }

    /**
     * Process avatar: square crop, 500x500 WebP.
     */
    async processAvatar(inputBuffer) {
        return this.processImage(inputBuffer, {
            width: 500,
            height: 500,
            quality: 85,
            fit: 'cover',
            folder: 'avatars'
        });
    }

    /**
     * Validate image buffer before processing.
     */
    async getMetadata(inputBuffer) {
        return sharp(inputBuffer).metadata();
    }

    /**
     * Strip all EXIF metadata (privacy).
     */
    async stripExif(inputBuffer) {
        return sharp(inputBuffer).rotate().toBuffer();
    }
}

module.exports = new ImageService();
