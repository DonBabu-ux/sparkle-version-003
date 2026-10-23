const crypto = require('crypto');
const db = require('../config/database');
const logger = require('../utils/logger');
const { isSafeMediaUrl } = require('../utils/safeUrl');

class CanonicalAssetService {
    /**
     * Determine provider and canonical ID from URL or metadata
     */
    static parseAssetIdentity(url, metadata = {}) {
        if (!url || typeof url !== 'string') {
            return null;
        }

        const trimmedUrl = url.trim();
        // Check safe media URL
        if (!isSafeMediaUrl(trimmedUrl)) {
            const err = new Error('Invalid media asset URL');
            err.code = 'INVALID_MEDIA_URL';
            throw err;
        }

        let parsed;
        try {
            parsed = new URL(trimmedUrl);
        } catch {
            return null;
        }

        const host = String(parsed.hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
        if (
            host === 'localhost' || host === '::1' || host === '0.0.0.0' ||
            host.endsWith('.local') || host.endsWith('.internal') ||
            /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) || /^169\.254\./.test(host)
        ) {
            const err = new Error('Invalid media asset URL: internal or loopback host rejected');
            err.code = 'INVALID_MEDIA_URL';
            throw err;
        }

        let provider = metadata.provider || 'unknown';
        let providerMediaId = metadata.providerId || metadata.provider_media_id || null;

        // Detect Giphy
        if (parsed.hostname.includes('giphy.com')) {
            provider = 'giphy';
            if (!providerMediaId) {
                // Examples: /media/<id>/200.gif or /media/<id>/giphy.gif
                const match = parsed.pathname.match(/\/media\/([a-zA-Z0-9_\-]+)\//);
                if (match && match[1]) {
                    providerMediaId = match[1];
                }
            }
        } else if (parsed.hostname.includes('tenor.com')) {
            provider = 'tenor';
        }

        // Canonical URL: base without tracking query params
        const canonicalUrl = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;

        // Stable asset ID
        let assetId;
        if (providerMediaId) {
            assetId = `${provider}:${providerMediaId}`;
        } else {
            const hash = crypto.createHash('sha256').update(canonicalUrl).digest('hex').slice(0, 32);
            assetId = `${provider}:${hash}`;
        }

        return {
            assetId,
            provider,
            providerMediaId,
            canonicalUrl,
            originalUrl: trimmedUrl
        };
    }

    /**
     * Get or create canonical media asset record
     */
    static async getOrCreateCanonicalAsset({ url, mediaType = 'gif', metadata = null }) {
        const metaObj = typeof metadata === 'string' ? (() => {
            try { return JSON.parse(metadata); } catch { return {}; }
        })() : (metadata || {});

        const identity = this.parseAssetIdentity(url, metaObj);
        if (!identity) {
            return {
                assetId: null,
                mediaUrl: url,
                mediaType
            };
        }

        const { assetId, provider, providerMediaId, canonicalUrl } = identity;

        try {
            // Check if existing
            const [existing] = await db.query(
                'SELECT asset_id, media_url, media_type, metadata FROM canonical_media_assets WHERE asset_id = ?',
                [assetId]
            );

            if (existing && existing.length > 0) {
                return {
                    assetId: existing[0].asset_id,
                    mediaUrl: existing[0].media_url,
                    mediaType: existing[0].media_type,
                    isReused: true
                };
            }

            // Insert new canonical asset
            const metaJson = JSON.stringify({
                ...metaObj,
                provider,
                providerMediaId
            });

            await db.query(`
                INSERT INTO canonical_media_assets (asset_id, provider, provider_media_id, media_url, media_type, metadata)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE media_url = VALUES(media_url)
            `, [assetId, provider, providerMediaId, canonicalUrl, mediaType, metaJson]);

            return {
                assetId,
                mediaUrl: canonicalUrl,
                mediaType,
                isReused: false
            };
        } catch (err) {
            logger.warn('[CanonicalAssetService] Database error, falling back to URL:', err.message);
            return {
                assetId,
                mediaUrl: canonicalUrl || url,
                mediaType,
                isReused: false
            };
        }
    }
}

module.exports = CanonicalAssetService;
