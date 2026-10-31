const pool = require('../config/database');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');
const cloudinary = require('cloudinary').v2;
const logger = require('../utils/logger');

class MediaService {
    /**
     * Registers a newly uploaded media asset in the registry.
     * Optionally generates a local thumbnail cache.
     */
    static async registerMedia({
        ownerId,
        category,
        cloudinaryPublicId,
        secureUrl,
        thumbnailUrl = null,
        lifecycleState = 'active',
        expiresAt = null,
        isReusable = false,
        referencedByFeatures = [],
        fileSizeBytes = 0,
        hashChecksum = null,
        resolution = null
    }) {
        const mediaId = crypto.randomUUID();
        
        // Use provided thumbnail_url or generate one
        let finalThumbnailUrl = thumbnailUrl;
        
        // Generate a local template for heavy feed rendering if no thumbnail provided
        let localTemplatePath = null;
        if (secureUrl && !finalThumbnailUrl && cloudinaryPublicId && !cloudinaryPublicId.startsWith('url_import_') && category !== 'message') {
            try {
                // Determine resource type based on URL extension
                const isVideo = secureUrl.match(/\.(mp4|webm|mov|avi)$/i);
                
                // Construct Cloudinary transformation URL for tiny preview
                // format: auto, quality: low, width: 200, crop: fill
                let thumbUrl = cloudinary.url(cloudinaryPublicId, {
                    resource_type: isVideo ? 'video' : 'image',
                    transformation: [
                        { width: 200, crop: 'fill', gravity: 'auto' },
                        { fetch_format: 'auto', quality: 'low' }
                    ]
                });

                // If it's a video, get the jpg poster frame
                if (isVideo) {
                    thumbUrl = thumbUrl.replace(/\.(mp4|webm|mov|avi)$/i, '.jpg');
                }

                const fileName = `thumb_${mediaId}.jpg`;
                const cacheDir = path.join(__dirname, '../public/uploads/cache');
                
                if (!fs.existsSync(cacheDir)) {
                    fs.mkdirSync(cacheDir, { recursive: true });
                }

                const filePath = path.join(cacheDir, fileName);
                
                // Download in background (non-blocking)
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

        await pool.query(
            `INSERT INTO media_registry (
                media_id, owner_id, category, cloudinary_public_id, secure_url, thumbnail_url,
                lifecycle_state, expires_at, is_reusable, referenced_by_features, 
                file_size_bytes, hash_checksum, local_template_path, last_accessed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                mediaId, ownerId, category, cloudinaryPublicId, secureUrl, finalThumbnailUrl,
                lifecycleState, expiresAt, isReusable, JSON.stringify(referencedByFeatures),
                fileSizeBytes, hashChecksum, localTemplatePath
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
            `SELECT * FROM media_registry WHERE owner_id = ? AND hash_checksum = ? LIMIT 1`,
            [ownerId, hashChecksum]
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
     * Escapes LIKE wildcards so a public id never accidentally matches
     * sibling assets (public id "posts/ab_c" must not match "posts/abXc").
     */
    static escapeLike(value) {
        return String(value).replace(/[|%_]/g, (ch) => '|' + ch);
    }

    /**
     * Pure helper: does this stored URL point at the given Cloudinary
     * public id? Version segments and transformation prefixes are
     * irrelevant (URLs are re-signed over time); the file extension is
     * stripped because registry public ids are stored without one.
     */
    static urlReferencesPublicId(url, publicId) {
        if (!url || typeof url !== 'string' || !publicId) return false;
        const ref = MediaService.extractCloudinaryRef(url);
        return !!ref && ref.publicId === publicId;
    }

    /**
     * Parses a Cloudinary secure_url into its registry public id.
     * Handles the documented shape
     *   https://res.cloudinary.com/<cloud>/<image|video|raw>/upload/v<version>/<folder>/<public_id>.<ext>
     * with or without the version segment (transformation segments before
     * the version are tolerated). Returns null for non-Cloudinary URLs
     * (data: URIs, remote hosts, local /uploads paths) so callers can skip
     * them safely. The returned public id omits the file extension to
     * match media_registry.cloudinary_public_id.
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

        // The version segment (v<digits>) sits after any transformation
        // prefix (so_5,du_10/...) and immediately before the public id —
        // Cloudinary's grammar allows exactly one version, so take the
        // FIRST match. A leading '/' is prepended so a version sitting in
        // the first segment also matches.
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
     * Checks whether any LIVE row still references a Cloudinary public id.
     * Covers posts.media_url, post_media.media_url, the story media columns
     * and media_registry.cloudinary_public_id rows — excluding registry
     * rows the caller is about to delete (they are not live references).
     * URL columns are matched by public-id containment so version segments
     * never matter; the match is intentionally conservative (a false
     * positive keeps the asset, a false negative would destroy bytes that
     * are still displayed somewhere).
     */
    static async isMediaUrlReferenced(publicId, excludeMediaIds = []) {
        if (!publicId) return false;

        const exclude = Array.isArray(excludeMediaIds) ? excludeMediaIds : [];
        const pattern = `%${MediaService.escapeLike(publicId)}%`;

        // 1. Registry rows for the same public id (exact column match),
        //    minus the rows the caller is deleting right now.
        let registryNotIn = '';
        const registryParams = [publicId];
        if (exclude.length > 0) {
            registryNotIn = ` AND media_id NOT IN (${exclude.map(() => '?').join(',')})`;
            registryParams.push(...exclude);
        }
        const [registry] = await pool.query(
            `SELECT 1 FROM media_registry WHERE cloudinary_public_id = ?${registryNotIn} LIMIT 1`,
            registryParams
        );
        if (registry.length > 0) return true;

        // 2. Live content rows — URL columns, matched on public id.
        const urlChecks = [
            [`SELECT 1 FROM posts WHERE media_url LIKE ? ESCAPE '|' LIMIT 1`, [pattern]],
            [`SELECT 1 FROM post_media WHERE media_url LIKE ? ESCAPE '|' LIMIT 1`, [pattern]],
            [`SELECT 1 FROM stories WHERE media_url LIKE ? ESCAPE '|' OR thumbnail_url LIKE ? ESCAPE '|' OR audio_url LIKE ? ESCAPE '|' LIMIT 1`, [pattern, pattern, pattern]]
        ];
        for (const [sql, params] of urlChecks) {
            const [rows] = await pool.query(sql, params);
            if (rows.length > 0) return true;
        }

        return false;
    }

    /**
     * Destroys Cloudinary assets for the given URLs and deletes their
     * media_registry rows — but ONLY when no other live row still
     * references them. Destructive steps are individually wrapped so one
     * failing asset never aborts the sweep or bubbles up into a
     * user-facing delete path. Returns { destroyed, kept, errors }.
     */
    static async deleteMediaForUrls(urls) {
        const summary = { destroyed: 0, kept: 0, errors: [] };
        if (!Array.isArray(urls)) return summary;

        // Dedupe on public id + resource type: the same asset may appear
        // as media_url and (derived) thumbnail_url of one story.
        const refs = new Map();
        for (const url of urls) {
            if (!url || typeof url !== 'string') continue;
            const ref = MediaService.extractCloudinaryRef(url);
            if (!ref) continue;
            const key = `${ref.publicId}|${ref.resourceType}`;
            if (!refs.has(key)) refs.set(key, ref);
        }

        for (const ref of refs.values()) {
            const { publicId, resourceType } = ref;
            try {
                // Registry rows carrying this public id are the deletion
                // candidates; they must not count as live references.
                const [registryRows] = await pool.query(
                    'SELECT media_id, cloudinary_public_id FROM media_registry WHERE cloudinary_public_id = ?',
                    [publicId]
                );
                const mediaIds = registryRows.map((row) => row.media_id);

                const referenced = await MediaService.isMediaUrlReferenced(publicId, mediaIds);
                if (referenced) {
                    summary.kept++;
                    logger.debug(`Media cleanup kept referenced asset ${publicId}`);
                    continue;
                }

                // Synthetic import markers ('url_import_...') are not real
                // Cloudinary assets — never call destroy on them.
                const isSynthetic = registryRows.some((row) => row.cloudinary_public_id.startsWith('url_import_'));
                if (!isSynthetic) {
                    try {
                        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
                    } catch (destroyErr) {
                        // Keep the registry row so a later sweep can retry.
                        summary.errors.push(`${publicId}: ${destroyErr.message}`);
                        logger.error(`Cloudinary destroy failed for ${publicId}:`, destroyErr.message);
                        continue;
                    }
                }
                summary.destroyed++;

                if (mediaIds.length > 0) {
                    await pool.query('DELETE FROM media_registry WHERE media_id IN (?)', [mediaIds]);
                }
            } catch (err) {
                summary.errors.push(`${publicId}: ${err.message}`);
                logger.error(`Media cleanup failed for ${publicId}:`, err.message);
            }
        }

        return summary;
    }
}

module.exports = MediaService;
