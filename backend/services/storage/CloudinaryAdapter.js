const cloudinary = require('cloudinary').v2;
const https = require('https');
const http = require('http');
const StorageProvider = require('./StorageProvider.interface');
const logger = require('../../utils/logger');

class CloudinaryAdapter extends StorageProvider {
    constructor() {
        super('cloudinary');
        this.cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        this.apiKey = process.env.CLOUDINARY_API_KEY;
        this.apiSecret = process.env.CLOUDINARY_API_SECRET;

        cloudinary.config({
            cloud_name: this.cloudName,
            api_key: this.apiKey,
            api_secret: this.apiSecret,
            secure: true
        });
    }

    /**
     * Upload an object into Cloudinary (legacy support)
     */
    async uploadObject({ key, body, contentType, metadata = {} }) {
        return new Promise((resolve, reject) => {
            const isVideo = contentType && contentType.startsWith('video');
            const resourceType = isVideo ? 'video' : 'auto';

            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    public_id: key.replace(/\.[^/.]+$/, ''),
                    resource_type: resourceType,
                    context: metadata
                },
                (error, result) => {
                    if (error) return reject(error);
                    resolve({
                        key: result.public_id,
                        bucket: this.cloudName,
                        publicUrl: result.secure_url,
                        etag: result.etag,
                        size: result.bytes,
                        format: result.format
                    });
                }
            );

            if (Buffer.isBuffer(body)) {
                uploadStream.end(body);
            } else if (body && typeof body.pipe === 'function') {
                body.pipe(uploadStream);
            } else {
                reject(new Error('Invalid body passed to Cloudinary uploadObject'));
            }
        });
    }

    /**
     * Download an object stream from Cloudinary
     */
    async downloadObject({ key, publicUrl }) {
        const targetUrl = publicUrl || cloudinary.url(key, { secure: true });
        const client = targetUrl.startsWith('https') ? https : http;

        return new Promise((resolve, reject) => {
            client.get(targetUrl, (res) => {
                if (res.statusCode !== 200) {
                    return reject(new Error(`Failed to fetch Cloudinary media (${res.statusCode}) for ${key}`));
                }
                resolve({
                    stream: res,
                    contentType: res.headers['content-type'],
                    contentLength: parseInt(res.headers['content-length'] || '0', 10),
                    etag: res.headers['etag']
                });
            }).on('error', reject);
        });
    }

    /**
     * Head object metadata
     */
    async headObject({ key, resourceType = 'image' }) {
        try {
            const res = await cloudinary.api.resource(key, { resource_type: resourceType });
            return {
                exists: true,
                contentLength: res.bytes,
                contentType: res.format ? `${resourceType}/${res.format}` : undefined,
                lastModified: new Date(res.created_at),
                metadata: res.context || {},
                width: res.width,
                height: res.height,
                duration: res.duration
            };
        } catch (err) {
            if (err.error?.http_code === 404 || err.http_code === 404) {
                return { exists: false };
            }
            throw err;
        }
    }

    /**
     * Delete an asset from Cloudinary
     */
    async deleteObject({ key, resourceType = 'image' }) {
        try {
            const res = await cloudinary.uploader.destroy(key, { resource_type: resourceType });
            return { deleted: res.result === 'ok' || res.result === 'not found', result: res.result };
        } catch (err) {
            logger.error(`[CloudinaryAdapter] Delete failed for ${key}:`, err.message);
            throw err;
        }
    }

    /**
     * Get transformation/public URL
     */
    getPublicUrl({ key, resourceType = 'auto', transformation = [] }) {
        return cloudinary.url(key, {
            secure: true,
            resource_type: resourceType,
            transformation: transformation.length ? transformation : undefined
        });
    }

    /**
     * Health check
     */
    async healthCheck() {
        try {
            const res = await cloudinary.api.ping();
            return { ok: res.status === 'ok', provider: 'cloudinary' };
        } catch (err) {
            return { ok: false, error: err.message, provider: 'cloudinary' };
        }
    }
}

module.exports = CloudinaryAdapter;
