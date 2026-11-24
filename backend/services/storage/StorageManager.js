const crypto = require('crypto');
const path = require('path');
const CloudflareR2Adapter = require('./CloudflareR2Adapter');
const BackblazeB2Adapter = require('./BackblazeB2Adapter');
const CloudinaryAdapter = require('./CloudinaryAdapter');
const logger = require('../../utils/logger');

class StorageManager {
    constructor() {
        this.primaryProviderName = process.env.MEDIA_STORAGE_PRIMARY || 'r2';
        this.archiveProviderName = 'b2';

        this.adapters = {
            r2: new CloudflareR2Adapter(),
            b2: new BackblazeB2Adapter(),
            cloudinary: new CloudinaryAdapter()
        };
    }

    /**
     * Get specific adapter by name ('r2', 'b2', 'cloudinary')
     */
    getAdapter(name) {
        const normalized = (name || this.primaryProviderName).toLowerCase();
        const adapter = this.adapters[normalized];
        if (!adapter) {
            throw new Error(`Unknown storage provider: ${name}`);
        }
        return adapter;
    }

    /**
     * Get primary active adapter (defaults to Cloudflare R2)
     */
    getPrimaryAdapter() {
        return this.getAdapter(this.primaryProviderName);
    }

    /**
     * Get secondary cold/archive adapter (defaults to Backblaze B2)
     */
    getArchiveAdapter() {
        return this.getAdapter(this.archiveProviderName);
    }

    /**
     * Generate structured, deterministic object key:
     * media/{category}/{YYYY}/{MM}/{assetId}.{ext}
     */
    static generateObjectKey({ category = 'general', assetId, ext = 'bin', date = new Date() }) {
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const cleanExt = (ext || 'bin').replace(/^\./, '').toLowerCase();
        const cleanCategory = (category || 'general').toLowerCase().replace(/[^a-z0-9_-]/g, '');
        const id = assetId || crypto.randomUUID();

        return `media/${cleanCategory}/${year}/${month}/${id}.${cleanExt}`;
    }

    /**
     * Calculate SHA-256 checksum of a buffer or stream
     */
    static calculateChecksum(bufferOrStream) {
        if (Buffer.isBuffer(bufferOrStream)) {
            return crypto.createHash('sha256').update(bufferOrStream).digest('hex');
        }
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            bufferOrStream.on('data', chunk => hash.update(chunk));
            bufferOrStream.on('end', () => resolve(hash.digest('hex')));
            bufferOrStream.on('error', reject);
        });
    }

    /**
     * Upload an asset directly to active primary storage (R2)
     */
    async uploadActiveMedia({ 
        key, 
        body, 
        contentType, 
        category = 'general', 
        assetId, 
        ext, 
        metadata = {},
        ownerId
    }) {
        const objectKey = key || StorageManager.generateObjectKey({ category, assetId, ext });
        const adapter = this.getPrimaryAdapter();

        let sha256 = null;
        if (Buffer.isBuffer(body)) {
            sha256 = StorageManager.calculateChecksum(body);
        }

        const uploadResult = await adapter.uploadObject({
            key: objectKey,
            body,
            contentType,
            metadata: {
                ...metadata,
                category,
                ownerId: ownerId || '',
                uploadedAt: new Date().toISOString()
            }
        });

        return {
            ...uploadResult,
            provider: this.primaryProviderName,
            sha256: sha256 || uploadResult.sha256
        };
    }

    /**
     * Transfer an asset between tiers (e.g. active R2 -> cold B2)
     * Authoritative transfer: copy, verify checksum, update DB, then delete source
     */
    async transferTier({ 
        sourceProvider, 
        targetProvider, 
        sourceKey, 
        targetKey, 
        expectedSha256,
        contentType 
    }) {
        const srcAdapter = this.getAdapter(sourceProvider);
        const tgtAdapter = this.getAdapter(targetProvider);

        logger.info(`[StorageManager] Initiating tier transfer: ${sourceProvider}:${sourceKey} -> ${targetProvider}:${targetKey}`);

        // 1. Download stream from source
        const download = await srcAdapter.downloadObject({ key: sourceKey });

        // Buffer the stream for checksum verification
        const chunks = [];
        for await (const chunk of download.stream) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        const downloadedSha256 = StorageManager.calculateChecksum(buffer);

        if (expectedSha256 && downloadedSha256 !== expectedSha256) {
            throw new Error(`Checksum mismatch during download: expected ${expectedSha256}, got ${downloadedSha256}`);
        }

        // 2. Upload to destination
        const uploadRes = await tgtAdapter.uploadObject({
            key: targetKey || sourceKey,
            body: buffer,
            contentType: contentType || download.contentType
        });

        // 3. Verify destination
        const head = await tgtAdapter.headObject({ key: targetKey || sourceKey });
        if (!head.exists) {
            throw new Error(`Verification failed: target object ${targetKey || sourceKey} does not exist on ${targetProvider}`);
        }

        // 4. Source deletion is only performed after caller commits database update!
        return {
            sourceProvider,
            targetProvider,
            sourceKey,
            targetKey: targetKey || sourceKey,
            sha256: downloadedSha256,
            size: buffer.length,
            publicUrl: uploadRes.publicUrl,
            bucket: uploadRes.bucket
        };
    }

    /**
     * Delete media permanently from specified provider
     */
    async deleteMedia({ provider, key, bucket, resourceType }) {
        const adapter = this.getAdapter(provider);
        return await adapter.deleteObject({ key, bucket, resourceType });
    }

    /**
     * Construct delivery/public URL
     */
    getPublicUrl({ provider, key, bucket }) {
        const adapter = this.getAdapter(provider);
        return adapter.getPublicUrl({ key, bucket });
    }

    /**
     * Health check all configured storage providers
     */
    async healthCheckAll() {
        const results = {};
        for (const [name, adapter] of Object.entries(this.adapters)) {
            try {
                results[name] = await adapter.healthCheck();
            } catch (err) {
                results[name] = { ok: false, error: err.message, provider: name };
            }
        }
        return results;
    }
}

// Export singleton instance as well as class
const storageManager = new StorageManager();
module.exports = storageManager;
module.exports.StorageManager = StorageManager;
