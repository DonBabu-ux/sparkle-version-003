/**
 * StorageProvider Interface / Base Class
 * Defines the contract that any storage adapter (Cloudflare R2, Backblaze B2, Cloudinary) must adhere to.
 */
class StorageProvider {
    constructor(name) {
        this.name = name;
    }

    /**
     * Upload an object (Buffer, Readable Stream, or Uint8Array)
     * @param {Object} params
     * @param {string} params.key - Object key (path in bucket)
     * @param {Buffer|import('stream').Readable|Uint8Array} params.body - Payload
     * @param {string} params.contentType - MIME type
     * @param {Object} [params.metadata] - Key-value metadata
     * @param {string} [params.bucket] - Target bucket override
     * @returns {Promise<{ key: string, bucket: string, publicUrl: string, etag?: string, size?: number, sha256?: string }>}
     */
    async uploadObject(params) {
        throw new Error(`uploadObject not implemented in ${this.name}`);
    }

    /**
     * Download an object as a stream
     * @param {Object} params
     * @param {string} params.key
     * @param {string} [params.bucket]
     * @returns {Promise<{ stream: import('stream').Readable, contentType: string, contentLength: number, etag?: string }>}
     */
    async downloadObject(params) {
        throw new Error(`downloadObject not implemented in ${this.name}`);
    }

    /**
     * Retrieve metadata / verify existence
     * @param {Object} params
     * @param {string} params.key
     * @param {string} [params.bucket]
     * @returns {Promise<{ exists: boolean, contentLength?: number, contentType?: string, etag?: string, lastModified?: Date, metadata?: Object }>}
     */
    async headObject(params) {
        throw new Error(`headObject not implemented in ${this.name}`);
    }

    /**
     * Delete an object permanently
     * @param {Object} params
     * @param {string} params.key
     * @param {string} [params.bucket]
     * @returns {Promise<{ deleted: boolean }>}
     */
    async deleteObject(params) {
        throw new Error(`deleteObject not implemented in ${this.name}`);
    }

    /**
     * Generate presigned URL for direct client upload
     * @param {Object} params
     * @param {string} params.key
     * @param {string} params.contentType
     * @param {number} [params.expiresInSeconds=3600]
     * @param {string} [params.bucket]
     * @returns {Promise<{ uploadUrl: string, key: string, publicUrl: string }>}
     */
    async getSignedUploadUrl(params) {
        throw new Error(`getSignedUploadUrl not implemented in ${this.name}`);
    }

    /**
     * Generate presigned URL for secure download/streaming
     * @param {Object} params
     * @param {string} params.key
     * @param {number} [params.expiresInSeconds=3600]
     * @param {string} [params.bucket]
     * @returns {Promise<string>}
     */
    async getSignedDownloadUrl(params) {
        throw new Error(`getSignedDownloadUrl not implemented in ${this.name}`);
    }

    /**
     * Get public or CDN delivery URL for this object
     * @param {Object} params
     * @param {string} params.key
     * @param {string} [params.bucket]
     * @returns {string}
     */
    getPublicUrl(params) {
        throw new Error(`getPublicUrl not implemented in ${this.name}`);
    }

    /**
     * Check if adapter is operational and reachable
     * @returns {Promise<{ ok: boolean, message?: string }>}
     */
    async healthCheck() {
        throw new Error(`healthCheck not implemented in ${this.name}`);
    }
}

module.exports = StorageProvider;
