const pool = require('../config/database');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');
const cloudinary = require('cloudinary').v2;
const logger = require('../utils/logger');
const storageManager = require('./storage/StorageManager');
const MediaResolverService = require('./mediaResolver.service');

class MediaService {
    /**
     * Registers a newly uploaded media asset in the registry.
     * Supports both Cloudflare R2 and legacy Cloudinary.
     */
    static async registerMedia({
        ownerId,
        category,
        cloudinaryPublicId = null,
        secureUrl,
        thumbnailUrl = null,
        lifecycleState = 'active',
        expiresAt = null,
        isReusable = false,
        referencedByFeatures = [],
        fileSizeBytes = 0,
        hashChecksum = null,
        resolution = null,
        storageProvider = 'r2',
        bucketName = null,
        objectKey = null,
        mimeType = null,
        checksumSha256 = null,
        width = null,
        height = null,
        durationSeconds = null
    }) {
        const mediaId = crypto.randomUUID();
        
        // Use provided thumbnail_url or fallback
        let finalThumbnailUrl = thumbnailUrl;
        let localTemplatePath = null;

        // If Cloudinary legacy thumbnail generation was requested
        if (secureUrl && !finalThumbnailUrl && cloudinaryPublicId && !cloudinaryPublicId.startsWith('url_import_') && category !== 'message') {
            try {
                const isVideo = secureUrl.match(/\.(mp4|webm|mov|avi)$/i);
                let thumbUrl = cloudinary.url(cloudinaryPublicId, {
                    resource_type: isVideo ? 'video' : 'image',
                    transformation: [
                        { width: 200, crop: 'fill', gravity: 'auto' },
                        { fetch_format: 'auto', quality: 'low' }
                    ]
                });

                if (isVideo) {
                    thumbUrl = thumbUrl.replace(/\.(mp4|webm|mov|avi)$/i, '.jpg');
                }

                const fileName = `thumb_${mediaId}.jpg`;
                const cacheDir = path.join(__dirname, '../public/uploads/cache');
                
                if (!fs.existsSync(cacheDir)) {
                    fs.mkdirSync(cacheDir, { recursive: true });
                }

                const filePath = path.join(cacheDir, fileName);
                
                https.get(thumbUrl, (response) => {
                    if (response.statusCode === 200) {
                        const fileStream = fs.createWriteStream(filePath);
                        response.pipe(fileStream);
                    }
                }).on('error', (e) => console.error('Failed to cache thumb:', e.message));

                localTemplatePath = `/uploads/cache/${fileName}`;
            } catch (err) {
                console.error('Local template generation failed:', err.message);
            }
        }

        const effectiveBucket = bucketName || (storageProvider === 'r2' ? process.env.R2_BUCKET_NAME : null);

        await pool.query(
            `INSERT INTO media_registry (
                media_id, owner_id, storage_provider, bucket_name, object_key, mime_type,
                category, cloudinary_public_id, secure_url, thumbnail_url,
                lifecycle_state, expires_at, is_reusable, referenced_by_features, 
                file_size_bytes, hash_checksum, checksum_sha256, width, height, duration_seconds,
                local_template_path, last_accessed_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
            [
                mediaId, ownerId, storageProvider, effectiveBucket, objectKey, mimeType,
                category, cloudinaryPublicId, secureUrl, finalThumbnailUrl,
                lifecycleState, expiresAt, isReusable, JSON.stringify(referencedByFeatures),
                fileSizeBytes, hashChecksum, checksumSha256, width, height, durationSeconds,
                localTemplatePath
            ]
        );
        
        return mediaId;
    }

    /**
     * Checks if a duplicate file already exists for the same user.
     */
    static async findDuplicate(ownerId, hashChecksum) {
        if (!hashChecksum) return null;
        
        const [rows] = await pool.query(
            `SELECT * FROM media_registry WHERE owner_id = ? AND (hash_checksum = ? OR checksum_sha256 = ?) LIMIT 1`,
            [ownerId, hashChecksum, hashChecksum]
        );
        
        return rows[0] || null;
    }

    /**
     * Updates the lifecycle state and referenced features of a media asset.
     */
    static async updateLifecycle(mediaId, { lifecycleState, referencedByFeatures }) {
        let updateQuery = 'UPDATE media_registry SET updated_at = NOW()';
        const params = [];
        
        if (lifecycleState) {
            updateQuery += ', lifecycle_state = ?';
            params.push(lifecycleState);
        }
        
        if (referencedByFeatures) {
            updateQuery += ', referenced_by_features = ?';
            params.push(JSON.stringify(referencedByFeatures));
        }
        
        updateQuery += ' WHERE media_id = ?';
        params.push(mediaId);
        
        await pool.query(updateQuery, params);
    }

    /**
     * Escapes LIKE wildcards
     */
    static escapeLike(value) {
        return String(value).replace(/[|%_]/g, (ch) => '|' + ch);
    }

    /**
     * Pure helper: does this stored URL point at the given Cloudinary public id?
     */
    static urlReferencesPublicId(url, publicId) {
        if (!url || typeof url !== 'string' || !publicId) return false;
        const ref = MediaService.extractCloudinaryRef(url);
        return !!ref && ref.publicId === publicId;
    }

    /**
     * Parses a Cloudinary secure_url into its registry public id.
     */
    static extractCloudinaryRef(url) {
        if (!url || typeof url !== 'string') return null;
        const trimmed = url.trim();
        if (!trimmed || trimmed.startsWith('data:')) return null;

        const match = /^https?:\/\/res\.cloudinary\.com\/[^/]+\/(image|video|raw)\/upload\/(.+)$/i.exec(trimmed);
        if (!match) return null;

        const resourceType = match[1].toLowerCase();
        let rest = match[2];
        let version = null;

        const versionMatch = /\/v(\d+)\//.exec(`/${rest}`);
        if (versionMatch) {
            version = versionMatch[1];
            rest = `/${rest}`.slice(versionMatch.index + versionMatch[0].length);
        }

        const publicId = rest.replace(/\.[A-Za-z0-9]+$/, '');
        if (!publicId) return null;

        return { publicId, resourceType, version };
    }

    /**
     * Checks whether any LIVE row still references a Cloudinary public id or R2 key.
     */
    static async isMediaUrlReferenced(identifier, excludeMediaIds = []) {
        if (!identifier) return false;

        const exclude = Array.isArray(excludeMediaIds) ? excludeMediaIds : [];
        const pattern = `%${MediaService.escapeLike(identifier)}%`;

        let registryNotIn = '';
        const registryParams = [identifier, identifier];
        if (exclude.length > 0) {
            registryNotIn = ` AND media_id NOT IN (${exclude.map(() => '?').join(',')})`;
            registryParams.push(...exclude);
        }
        const [registry] = await pool.query(
            `SELECT 1 FROM media_registry WHERE (cloudinary_public_id = ? OR object_key = ?)${registryNotIn} LIMIT 1`,
            registryParams
        );
        if (registry.length > 0) return true;

        // Content table reference check
        const urlChecks = [
            [`SELECT 1 FROM posts WHERE media_url LIKE ? ESCAPE '|' LIMIT 1`, [pattern]],
            [`SELECT 1 FROM post_media WHERE media_url LIKE ? ESCAPE '|' LIMIT 1`, [pattern]],
            [`SELECT 1 FROM stories WHERE media_url LIKE ? ESCAPE '|' OR thumbnail_url LIKE ? ESCAPE '|' OR audio_url LIKE ? ESCAPE '|' LIMIT 1`, [pattern, pattern, pattern]],
            [`SELECT 1 FROM moments WHERE media_url LIKE ? ESCAPE '|' OR thumbnail_url LIKE ? ESCAPE '|' LIMIT 1`, [pattern, pattern]]
        ];
        for (const [sql, params] of urlChecks) {
            try {
                const [rows] = await pool.query(sql, params);
                if (rows.length > 0) return true;
            } catch (err) {
                // Ignore missing tables
            }
        }

        return false;
    }

    /**
     * Destroys media assets across providers (R2, B2, Cloudinary)
     * and deletes their media_registry rows ONLY when unreferenced.
     */
    static async deleteMediaForUrls(urls) {
        const summary = { destroyed: 0, kept: 0, errors: [] };
        if (!Array.isArray(urls)) return summary;

        for (const url of urls) {
            if (!url || typeof url !== 'string') continue;

            try {
                // Find matching registry rows
                const [rows] = await pool.query(
                    'SELECT * FROM media_registry WHERE secure_url = ? OR object_key = ? OR cloudinary_public_id = ?',
                    [url, url, url]
                );

                if (rows.length === 0) {
                    // Check if it's a Cloudinary URL not in registry
                    const ref = MediaService.extractCloudinaryRef(url);
                    if (ref) {
                        const referenced = await MediaService.isMediaUrlReferenced(ref.publicId);
                        if (!referenced) {
                            try {
                                await cloudinary.uploader.destroy(ref.publicId, { resource_type: ref.resourceType });
                                summary.destroyed++;
                            } catch (e) {
                                summary.errors.push(`${ref.publicId}: ${e.message}`);
                            }
                        } else {
                            summary.kept++;
                        }
                    }
                    continue;
                }

                for (const row of rows) {
                    const identifier = row.object_key || row.cloudinary_public_id;
                    const referenced = await MediaService.isMediaUrlReferenced(identifier, [row.media_id]);

                    if (referenced) {
                        summary.kept++;
                        logger.debug(`Media cleanup kept referenced asset ${identifier}`);
                        continue;
                    }

                    // Delete from authoritative provider
                    try {
                        if (row.storage_provider === 'r2' && row.object_key) {
                            await storageManager.getAdapter('r2').deleteObject({ key: row.object_key, bucket: row.bucket_name });
                        } else if (row.storage_provider === 'b2' && row.object_key) {
                            await storageManager.getAdapter('b2').deleteObject({ key: row.object_key, bucket: row.bucket_name });
                        } else if (row.cloudinary_public_id && !row.cloudinary_public_id.startsWith('url_import_')) {
                            const isVideo = row.secure_url && row.secure_url.match(/\.(mp4|webm|mov|avi)$/i);
                            await cloudinary.uploader.destroy(row.cloudinary_public_id, { resource_type: isVideo ? 'video' : 'image' });
                        }

                        await pool.query('DELETE FROM media_registry WHERE media_id = ?', [row.media_id]);
                        summary.destroyed++;
                    } catch (delErr) {
                        summary.errors.push(`${identifier}: ${delErr.message}`);
                        logger.error(`Media delete failed for ${identifier}:`, delErr.message);
                    }
                }
            } catch (err) {
                summary.errors.push(`${url}: ${err.message}`);
                logger.error(`Media sweep error for ${url}:`, err.message);
            }
        }

        return summary;
    }
}

module.exports = MediaService;
