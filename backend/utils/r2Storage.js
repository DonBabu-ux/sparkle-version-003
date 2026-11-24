/**
 * Multer Storage Engine for Cloudflare R2 with automatic image optimization
 * Replaces Cloudinary upload storage with zero-copy, direct R2 object storage.
 */
const crypto = require('crypto');
const path = require('path');
const sharp = require('sharp');
const storageManager = require('../services/storage/StorageManager');
const logger = require('./logger');

const COMPRESSIBLE_MIME = /^image\/(jpeg|jpg|png|webp|gif|avif|tiff)$/i;
const DEFAULT_MAX_EDGE = 1600;
const DEFAULT_QUALITY = 80;

async function compressImageBuffer(buffer, { maxEdge = DEFAULT_MAX_EDGE, quality = DEFAULT_QUALITY, mimetype } = {}) {
    try {
        let pipeline = sharp(buffer, { failOn: 'none', limitInputPixels: 40_000_000 });
        pipeline = pipeline.rotate(); // auto-orient from EXIF
        pipeline = pipeline.resize({
            width: maxEdge,
            height: maxEdge,
            fit: 'inside',
            withoutEnlargement: true
        });

        if (mimetype === 'image/png') {
            pipeline = pipeline.png({ quality, compressionLevel: 8, palette: true });
        } else if (mimetype === 'image/webp') {
            pipeline = pipeline.webp({ quality });
        } else {
            pipeline = pipeline.jpeg({ quality, mozjpeg: true });
        }

        const out = await pipeline.toBuffer();
        return out.length < buffer.length ? out : buffer;
    } catch (err) {
        logger.warn('[R2Storage] Image compression skipped due to error:', err.message);
        return buffer;
    }
}

class R2StorageEngine {
    constructor(options = {}) {
        this.category = options.category || 'general';
        this.maxEdge = options.maxEdge || DEFAULT_MAX_EDGE;
        this.quality = options.quality || DEFAULT_QUALITY;
        this.adapter = storageManager.getPrimaryAdapter();
    }

    _handleFile(req, file, cb) {
        const chunks = [];
        let totalBytes = 0;

        file.stream.on('data', (c) => {
            chunks.push(c);
            totalBytes += c.length;
        });

        file.stream.on('error', (err) => cb(err));

        file.stream.on('end', async () => {
            try {
                let buffer = Buffer.concat(chunks);
                const isImage = file.mimetype && COMPRESSIBLE_MIME.test(file.mimetype);

                if (isImage) {
                    const originalLength = buffer.length;
                    buffer = await compressImageBuffer(buffer, {
                        maxEdge: this.maxEdge,
                        quality: this.quality,
                        mimetype: file.mimetype
                    });
                    if (buffer.length < originalLength) {
                        logger.info(
                            `[R2Storage] Compressed ${file.originalname}: ${originalLength} -> ${buffer.length} bytes ` +
                            `(${Math.round((1 - buffer.length / originalLength) * 100)}% reduction)`
                        );
                    }
                }

                // Determine category dynamically if request provides context
                let category = this.category;
                if (file.fieldname === 'avatar') category = 'profile';
                else if (file.fieldname === 'video') category = 'reel';
                else if (req.originalUrl && req.originalUrl.includes('story')) category = 'story';
                else if (req.originalUrl && req.originalUrl.includes('moment')) category = 'moment';
                else if (req.originalUrl && req.originalUrl.includes('message')) category = 'message';
                else if (req.originalUrl && req.originalUrl.includes('market')) category = 'marketplace';

                const ext = path.extname(file.originalname || '').replace(/^\./, '').toLowerCase() || 
                    (isImage ? 'jpg' : (file.mimetype ? file.mimetype.split('/')[1] : 'bin'));

                const assetId = crypto.randomUUID();
                const objectKey = StorageManager.generateObjectKey({
                    category,
                    assetId,
                    ext
                });

                const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
                const ownerId = req.user?.userId || req.user?.user_id || 'anonymous';

                const uploadRes = await this.adapter.uploadObject({
                    key: objectKey,
                    body: buffer,
                    contentType: file.mimetype || 'application/octet-stream',
                    metadata: {
                        'sparkle-owner-id': String(ownerId),
                        'sparkle-category': category,
                        'original-name': encodeURIComponent(file.originalname || '')
                    }
                });

                // Populate file object with compatible properties
                const fileInfo = {
                    fieldname: file.fieldname,
                    originalname: file.originalname,
                    encoding: file.encoding,
                    mimetype: file.mimetype,
                    size: buffer.length,
                    path: uploadRes.publicUrl,
                    secure_url: uploadRes.publicUrl,
                    url: uploadRes.publicUrl,
                    location: uploadRes.publicUrl,
                    filename: objectKey,
                    key: objectKey,
                    bucket: uploadRes.bucket,
                    storageProvider: 'r2',
                    sha256: sha256,
                    assetId: assetId,
                    category: category
                };

                cb(null, fileInfo);
            } catch (err) {
                logger.error('[R2Storage] Upload to Cloudflare R2 failed:', err.message);
                cb(err);
            }
        });
    }

    _removeFile(req, file, cb) {
        if (file && file.key) {
            this.adapter.deleteObject({ key: file.key })
                .then(() => cb(null))
                .catch((err) => cb(err));
        } else {
            cb(null);
        }
    }
}

module.exports = R2StorageEngine;
