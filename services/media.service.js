const pool = require('../config/database');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');
const cloudinary = require('cloudinary').v2;

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
        hashChecksum = null
    }) {
        const mediaId = crypto.randomUUID();
        
        // Generate a local template for heavy feed rendering
        let localTemplatePath = null;
        if (secureUrl && cloudinaryPublicId && !cloudinaryPublicId.startsWith('url_import_') && category !== 'message') {
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
                mediaId, ownerId, category, cloudinaryPublicId, secureUrl, thumbnailUrl,
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
}

module.exports = MediaService;
