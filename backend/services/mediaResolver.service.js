/**
 * Central Media URL Resolver Service
 * Resolves any media asset, URL, or registry record to its authoritative delivery URL.
 * Handles Cloudflare R2 (Primary CDN), Backblaze B2, and legacy Cloudinary fallback.
 */
const storageManager = require('./storage/StorageManager');

class MediaResolverService {
    /**
     * Resolve a media asset record or URL string to a public CDN/delivery URL.
     * @param {Object|string} input - Media record object or raw URL string
     * @param {Object} [options]
     * @param {string} [options.variant] - 'original' | 'thumbnail' | 'avatar' | 'feed'
     * @returns {string}
     */
    static resolve(input, options = {}) {
        if (!input) return '';

        // If input is a string (URL or object key)
        if (typeof input === 'string') {
            const trimmed = input.trim();
            if (!trimmed) return '';

            // If already an absolute HTTP/HTTPS URL
            if (/^https?:\/\//i.test(trimmed)) {
                // Check if it's already an R2 URL
                const r2Domain = (process.env.R2_PUBLIC_DOMAIN || '').replace(/\/+$/, '');
                if (r2Domain && trimmed.startsWith(r2Domain)) {
                    return trimmed;
                }
                // Check if it's a legacy Cloudinary URL
                // We leave it as-is or let the client/CDN serve it until migrated
                return trimmed;
            }

            // If it's an object key (e.g. media/posts/2026/11/abc.jpg)
            if (trimmed.startsWith('media/') || trimmed.startsWith('uploads/')) {
                return storageManager.getPublicUrl({
                    provider: 'r2',
                    key: trimmed
                });
            }

            return trimmed;
        }

        // If input is a media_registry database row
        const {
            storage_provider,
            object_key,
            secure_url,
            thumbnail_url,
            cloudinary_public_id,
            category
        } = input;

        // If thumbnail variant is requested and available
        if (options.variant === 'thumbnail' && thumbnail_url) {
            return thumbnail_url;
        }

        // 1. Authoritative Cloudflare R2
        if (storage_provider === 'r2' && object_key) {
            return storageManager.getPublicUrl({
                provider: 'r2',
                key: object_key
            });
        }

        // 2. Authoritative Backblaze B2 (cold / archive)
        if (storage_provider === 'b2' && object_key) {
            return storageManager.getPublicUrl({
                provider: 'b2',
                key: object_key
            });
        }

        // 3. Fallback to secure_url if stored
        if (secure_url) {
            return secure_url;
        }

        // 4. Legacy Cloudinary resolution via public_id
        if (cloudinary_public_id) {
            return storageManager.getPublicUrl({
                provider: 'cloudinary',
                key: cloudinary_public_id
            });
        }

        return '';
    }

    /**
     * Resolves an array of media objects or URLs
     */
    static resolveMany(items, options = {}) {
        if (!Array.isArray(items)) return [];
        return items.map(item => MediaResolverService.resolve(item, options));
    }
}

module.exports = MediaResolverService;
