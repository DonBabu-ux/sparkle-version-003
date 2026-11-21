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

class BackblazeB2Adapter extends StorageProvider {
    constructor(config = {}) {
        super('backblaze_b2');

        this.keyId = config.keyId || process.env.B2_APPLICATION_KEY_ID;
        this.applicationKey = config.applicationKey || process.env.B2_APPLICATION_KEY;
        this.bucket = config.bucket || process.env.B2_BUCKET_NAME || 'sparkle-media-archive';
        this.endpoint = config.endpoint || process.env.B2_ENDPOINT || 'https://s3.us-west-004.backblazeb2.com';
        this.publicDomain = (config.publicDomain || process.env.B2_PUBLIC_DOMAIN || '').replace(/\/+$/, '');

        // Extract region from endpoint if present (e.g., s3.us-west-004.backblazeb2.com -> us-west-004)
        const regionMatch = this.endpoint.match(/s3\.([a-z0-9-]+)\.backblazeb2\.com/i);
        this.region = regionMatch ? regionMatch[1] : (config.region || 'us-west-004');

        if (!this.keyId || !this.applicationKey) {
            logger.warn('[BackblazeB2Adapter] Missing B2 credentials. B2 client will fail when called.');
        }

        this.client = new S3Client({
            region: this.region,
            endpoint: this.endpoint,
            credentials: {
                accessKeyId: this.keyId || 'dummy',
                secretAccessKey: this.applicationKey || 'dummy'
            }
        });
    }

    /**
     * Upload an object into Backblaze B2 (archive tier)
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
     * Download an object from Backblaze B2
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
     * Head object metadata
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
     * Delete an object from Backblaze B2
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
     * Signed download URL from B2
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
     * Get URL for B2
     */
    getPublicUrl({ key, bucket }) {
        const targetBucket = bucket || this.bucket;
        const cleanKey = key.replace(/^\/+/, '');
        if (this.publicDomain) {
            return `${this.publicDomain}/${cleanKey}`;
        }
        return `${this.endpoint}/${targetBucket}/${cleanKey}`;
    }

    /**
     * Health check
     */
    async healthCheck() {
        if (!this.keyId || !this.applicationKey) {
            return { ok: false, error: 'Missing B2 credentials', provider: 'backblaze_b2' };
        }
        try {
            const command = new ListObjectsV2Command({
                Bucket: this.bucket,
                MaxKeys: 1
            });
            await this.client.send(command);
            return { ok: true, bucket: this.bucket, provider: 'backblaze_b2' };
        } catch (err) {
            return { ok: false, error: err.message, provider: 'backblaze_b2' };
        }
    }
}

module.exports = BackblazeB2Adapter;
