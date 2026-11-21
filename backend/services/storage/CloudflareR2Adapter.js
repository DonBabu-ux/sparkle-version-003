const { 
    S3Client, 
    PutObjectCommand, 
    GetObjectCommand, 
    HeadObjectCommand, 
    DeleteObjectCommand, 
    ListObjectsV2Command 
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const StorageProvider = require('./StorageProvider.interface');
const logger = require('../../utils/logger');

class CloudflareR2Adapter extends StorageProvider {
    constructor(config = {}) {
        super('cloudflare_r2');

        this.accountId = config.accountId || process.env.R2_ACCOUNT_ID;
        this.accessKeyId = config.accessKeyId || process.env.R2_ACCESS_KEY_ID;
        this.secretAccessKey = config.secretAccessKey || process.env.R2_SECRET_ACCESS_KEY;
        this.bucket = config.bucket || process.env.R2_BUCKET_NAME || 'sparkle-media';
        this.publicDomain = (config.publicDomain || process.env.R2_PUBLIC_DOMAIN || '').replace(/\/+$/, '');

        const endpoint = config.endpoint || process.env.R2_ENDPOINT || 
            (this.accountId ? `https://${this.accountId}.r2.cloudflarestorage.com` : null);

        if (!this.accessKeyId || !this.secretAccessKey || !endpoint) {
            logger.warn('[CloudflareR2Adapter] Missing credentials or endpoint. R2 client might fail initialization.');
        }

        this.client = new S3Client({
            region: 'auto',
            endpoint: endpoint,
            credentials: {
                accessKeyId: this.accessKeyId,
                secretAccessKey: this.secretAccessKey
            }
        });
    }

    /**
     * Upload an object into Cloudflare R2
     */
    async uploadObject({ key, body, contentType, metadata = {}, bucket }) {
        const targetBucket = bucket || this.bucket;
        let sha256 = null;
        let size = null;

        if (Buffer.isBuffer(body)) {
            size = body.length;
            sha256 = crypto.createHash('sha256').update(body).digest('hex');
        }

        const command = new PutObjectCommand({
            Bucket: targetBucket,
            Key: key,
            Body: body,
            ContentType: contentType || 'application/octet-stream',
            Metadata: {
                ...metadata,
                ...(sha256 ? { 'sha256-checksum': sha256 } : {})
            }
        });

        const res = await this.client.send(command);
        const publicUrl = this.getPublicUrl({ key, bucket: targetBucket });

        return {
            key,
            bucket: targetBucket,
            publicUrl,
            etag: res.ETag ? res.ETag.replace(/"/g, '') : null,
            size,
            sha256
        };
    }

    /**
     * Download an object from Cloudflare R2
     */
    async downloadObject({ key, bucket }) {
        const targetBucket = bucket || this.bucket;
        const command = new GetObjectCommand({
            Bucket: targetBucket,
            Key: key
        });

        const res = await this.client.send(command);
        return {
            stream: res.Body,
            contentType: res.ContentType,
            contentLength: res.ContentLength,
            etag: res.ETag ? res.ETag.replace(/"/g, '') : null,
            metadata: res.Metadata || {}
        };
    }

    /**
     * Check if an object exists and return its metadata
     */
    async headObject({ key, bucket }) {
        const targetBucket = bucket || this.bucket;
        try {
            const command = new HeadObjectCommand({
                Bucket: targetBucket,
                Key: key
            });
            const res = await this.client.send(command);
            return {
                exists: true,
                contentLength: res.ContentLength,
                contentType: res.ContentType,
                etag: res.ETag ? res.ETag.replace(/"/g, '') : null,
                lastModified: res.LastModified,
                metadata: res.Metadata || {},
                sha256: res.Metadata ? res.Metadata['sha256-checksum'] : null
            };
        } catch (err) {
            if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
                return { exists: false };
            }
            throw err;
        }
    }

    /**
     * Delete an object from Cloudflare R2
     */
    async deleteObject({ key, bucket }) {
        const targetBucket = bucket || this.bucket;
        const command = new DeleteObjectCommand({
            Bucket: targetBucket,
            Key: key
        });
        await this.client.send(command);
        return { deleted: true, key, bucket: targetBucket };
    }

    /**
     * Create presigned URL for direct frontend/client upload to R2
     */
    async getSignedUploadUrl({ key, contentType, expiresInSeconds = 3600, bucket }) {
        const targetBucket = bucket || this.bucket;
        const command = new PutObjectCommand({
            Bucket: targetBucket,
            Key: key,
            ContentType: contentType || 'application/octet-stream'
        });

        const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
        const publicUrl = this.getPublicUrl({ key, bucket: targetBucket });

        return { uploadUrl, key, publicUrl };
    }

    /**
     * Create presigned URL for downloading/streaming
     */
    async getSignedDownloadUrl({ key, expiresInSeconds = 3600, bucket }) {
        const targetBucket = bucket || this.bucket;
        const command = new GetObjectCommand({
            Bucket: targetBucket,
            Key: key
        });

        return await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    }

    /**
     * Construct public CDN URL for an object
     */
    getPublicUrl({ key, bucket }) {
        const targetBucket = bucket || this.bucket;
        const cleanKey = key.replace(/^\/+/, '');
        if (this.publicDomain) {
            return `${this.publicDomain}/${cleanKey}`;
        }
        // Fallback to R2 standard dev/storage URL format
        if (this.accountId) {
            return `https://${this.accountId}.r2.cloudflarestorage.com/${targetBucket}/${cleanKey}`;
        }
        return `/${targetBucket}/${cleanKey}`;
    }

    /**
     * Health check verifying connectivity and credentials
     */
    async healthCheck() {
        try {
            const command = new ListObjectsV2Command({
                Bucket: this.bucket,
                MaxKeys: 1
            });
            await this.client.send(command);
            return { ok: true, bucket: this.bucket, provider: 'cloudflare_r2' };
        } catch (err) {
            logger.error('[CloudflareR2Adapter] Health check failed:', err.message);
            return { ok: false, error: err.message, provider: 'cloudflare_r2' };
        }
    }
}

module.exports = CloudflareR2Adapter;
