const pool = require('../config/database');
const logger = require('../utils/logger');
const sessionInterestService = require('../services/session-interest.service');
const momentsRankingService = require('../services/moments-ranking.service');

let tablesEnsured = false;

const ensureMomentTables = async () => {
    if (tablesEnsured) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS moment_likes (
                moment_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (moment_id, user_id),
                INDEX idx_ml_user (user_id),
                INDEX idx_ml_moment (moment_id)
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS moment_comments (
                comment_id CHAR(36) PRIMARY KEY,
                moment_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                parent_comment_id CHAR(36) DEFAULT NULL,
                content TEXT NOT NULL,
                like_count INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_mc_moment (moment_id),
                INDEX idx_mc_parent (parent_comment_id)
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS moment_comment_likes (
                comment_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (comment_id, user_id)
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS saved_moments (
                moment_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (moment_id, user_id),
                INDEX idx_sm_user (user_id)
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS moment_hashtags (
                id INT AUTO_INCREMENT PRIMARY KEY,
                moment_id CHAR(36) NOT NULL,
                hashtag VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_mh_moment (moment_id),
                INDEX idx_mh_hashtag (hashtag)
            )
        `);
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS user_interests (
                        user_id CHAR(36) NOT NULL,
                        category VARCHAR(50) NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (user_id, category)
                    )
                `);
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS search_history (
                        id CHAR(36) NOT NULL,
                        user_id CHAR(36) NOT NULL,
                        query VARCHAR(255) NOT NULL,
                        searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (id),
                        UNIQUE KEY unique_user_query (user_id, query),
                        INDEX idx_sh_user (user_id)
                    )
                `);
                tablesEnsured = true;
                logger.info('Moment tables and extensions verified/created');
    } catch (e) {
        logger.warn('Could not ensure moment tables: ' + e.message);
    }
};

let columnsEnsured = false;

const ensureMomentColumns = async () => {
    if (columnsEnsured) return;
    
    // Check 'moments' table
    const momentsCols = [
        { name: 'like_count', def: 'INT DEFAULT 0' },
        { name: 'comment_count', def: 'INT DEFAULT 0' },
        { name: 'share_count', def: 'INT DEFAULT 0' },
        { name: 'view_count', def: 'INT DEFAULT 0' },
        { name: 'category', def: 'VARCHAR(50) DEFAULT NULL' },
        { name: 'media_url', def: 'VARCHAR(500) DEFAULT NULL' },
        { name: 'media_type', def: 'VARCHAR(50) DEFAULT "video"' },
        { name: 'is_live', def: 'TINYINT(1) DEFAULT 0' },
        { name: 'completion_rate', def: 'DECIMAL(5,4) DEFAULT 1.0000' },
        { name: 'quality_score', def: 'DECIMAL(5,4) DEFAULT 1.0000' },
        { name: 'streaming_url', def: 'VARCHAR(500) DEFAULT NULL' },
        { name: 'thumbnail_url', def: 'VARCHAR(500) DEFAULT NULL' },
        { name: 'resolution', def: 'VARCHAR(50) DEFAULT "1080p"' },
        { name: 'bitrate', def: 'INT DEFAULT 0' },
        { name: 'deleted_at', def: 'TIMESTAMP NULL DEFAULT NULL' }
    ];
    // Check 'moment_comments' table
    const commentCols = [
        { name: 'parent_comment_id', def: 'CHAR(36) DEFAULT NULL' },
        { name: 'like_count', def: 'INT DEFAULT 0' }
    ];

    const ensureCols = async (table, cols) => {
        const [rows] = await pool.query(`SHOW COLUMNS FROM \`${table}\``);
        const have = new Set((Array.isArray(rows) ? rows : []).map(r => r.Field));
        for (const col of cols) {
            if (have.has(col.name)) continue;
            await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col.name}\` ${col.def}`);
            logger.info(`Added column ${table}.${col.name}`);
        }
    };
    await ensureCols('moments', momentsCols);
    await ensureCols('moment_comments', commentCols);

    columnsEnsured = true;
};

const getMomentById = async (req, res) => {
    try {
        const { id } = req.params;
        const [moments] = await pool.query(`
            SELECT 
                m.*,
                u.username,
                u.name as user_name,
                u.avatar_url,
                (SELECT COUNT(*) FROM moment_likes WHERE moment_id = m.moment_id AND user_id = ?) as is_liked,
                (SELECT COUNT(*) FROM saved_moments WHERE moment_id = m.moment_id AND user_id = ?) as is_saved,
                (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = m.user_id) as is_following
            FROM moments m 
            JOIN users u ON m.user_id = u.user_id 
            WHERE m.moment_id = ?
        `, [req.user?.user_id, req.user?.user_id, req.user?.user_id, id]);

        if (moments.length === 0) {
            return res.status(404).json({ error: 'Moment not found' });
        }

        res.json({ success: true, moment: moments[0] });
    } catch (error) {
        logger.error('Error loading moment detail:', error);
        res.status(500).json({ error: 'Failed to load moment' });
    }
}

const getMomentsStream = async (req, res) => {
    try {
        // Tables/columns are guaranteed by prewarm() at server start — no need to re-check here.
        const { page = 0, limit = 8, query, type, refresh } = req.query;
        const limitNum = Math.min(parseInt(limit, 10) || 8, 20);
        const currentUserId = req.user.user_id;
        const pageNum = parseInt(page, 10) || 0;
        const offset = pageNum * limitNum;
        // refresh=true bypasses the 30s per-user cache → full reshuffle
        const forceRefresh = refresh === 'true' || refresh === '1';

        // Capture Search Intent as Interest (SIV Signal)
        if (query) {
            sessionInterestService.recordEvent(currentUserId, null, {
                type: 'search',
                value: 1,
                category: query
            }).catch(err => logger.error('Search Intent Error:', err));
        }

        // Pool generation is always non-blocking background work
        momentsRankingService.generateCandidatePools().catch(err => logger.error('Pool Gen Error:', err));

        const finalMoments = await momentsRankingService.getRankedFeed(
            currentUserId, limitNum, { query, type, offset, refresh: forceRefresh }
        );

        // ── New-user fallback: if ranked feed is empty, serve the discover feed ──
        // This guarantees the Moments page is never blank on first open.
        let momentsToReturn = finalMoments;
        if (!momentsToReturn || momentsToReturn.length === 0) {
            try {
                const discoverService = require('../services/discover.service');
                const fallback = await discoverService.getFeed(currentUserId, { page: pageNum, pageSize: limitNum });
                if (fallback && fallback.items && fallback.items.length > 0) {
                    // Normalise discover items to the same shape the frontend expects
                    momentsToReturn = fallback.items.map(item => ({
                        moment_id:     item.moment_id,
                        user_id:       item.user_id,
                        username:      item.username,
                        user_name:     item.user_name,
                        avatar_url:    item.avatar_url,
                        is_verified:   item.is_verified,
                        caption:       item.caption,
                        media_url:     item.media_url,
                        streaming_url: item.streaming_url,
                        thumbnail_url: item.thumbnail_url,
                        media_type:    item.media_type,
                        like_count:    item.like_count || 0,
                        comment_count: item.comment_count || 0,
                        share_count:   item.share_count || 0,
                        view_count:    item.view_count || 0,
                        created_at:    item.created_at,
                        is_liked:      false,
                        is_saved:      false,
                        is_following:  false,
                        _discover_fallback: true
                    }));
                }
            } catch (fbErr) {
                logger.warn('[MomentsStream] Discover fallback failed:', fbErr.message);
            }
        }

        res.json({
            moments: momentsToReturn,
            sivActive: true,
            pagination: { page: pageNum, limit: limitNum, total: momentsToReturn.length, hasMore: momentsToReturn.length === limitNum }
        });

    } catch (error) {
        logger.error('Moments Stream Error:', error);
        res.status(500).json({ error: error.message });
    }
};


const sparkMoment = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.user_id;

        // Check if already sparks
        const [existing] = await pool.query(
            'SELECT * FROM moment_likes WHERE moment_id = ? AND user_id = ?',
            [id, userId]
        );

        let action;
        if (existing.length > 0) {
            // Unlike
            await pool.query(
                'DELETE FROM moment_likes WHERE moment_id = ? AND user_id = ?',
                [id, userId]
            );
            await pool.query(
                'UPDATE moments SET like_count = like_count - 1 WHERE moment_id = ?',
                [id]
            );
            action = 'unliked';
        } else {
            // Like
            await pool.query(
                'INSERT INTO moment_likes (moment_id, user_id) VALUES (?, ?)',
                [id, userId]
            );
            await pool.query(
                'UPDATE moments SET like_count = like_count + 1 WHERE moment_id = ?',
                [id]
            );
            action = 'liked';

            // Create notification for moment owner
            try {
                const [moment] = await pool.query(
                    'SELECT user_id FROM moments WHERE moment_id = ?',
                    [id]
                );
                if (moment[0] && moment[0].user_id !== userId) {
                    const notificationId = require('crypto').randomUUID();
                    await pool.query(
                        `INSERT INTO notifications 
                        (notification_id, user_id, type, title, content, related_id, related_type, actor_id, action_url) 
                        VALUES (?, ?, 'spark', 'Moment Sparked!', 'Someone sparked your moment.', ?, 'moment', ?, CONCAT('/moments/', ?))`,
                        [notificationId, moment[0].user_id, id, userId, id]
                    );
                }
            } catch (notiError) {
                console.error('Notification Error:', notiError.message);
            }
        }

        const [result] = await pool.query(
            'SELECT like_count FROM moments WHERE moment_id = ?',
            [id]
        );

        res.json({
            status: 'success',
            action,
            likes: result[0] ? result[0].like_count : 0
        });
    } catch (error) {
        logger.error('Spark Moment Error:', error);
        res.status(500).json({ error: error.message });
    }
};

const createMoment = async (req, res) => {
    try {
        const { caption, category = 'general' } = req.body;
        
        // SUPPORT BOTH SINGLE AND ARRAY UPLOADS (Fix for redirected post requests)
        let media_url = req.body.media_url || req.body.video_url || null;
        let detected_mimetype = null;

        if (req.file) {
            media_url = req.file.path;
            detected_mimetype = req.file.mimetype;
        } else if (req.files) {
            // Handle array or fields
            const fileArray = Array.isArray(req.files) ? req.files : (req.files.media || req.files.video || []);
            if (fileArray.length > 0) {
                media_url = fileArray[0].path;
                detected_mimetype = fileArray[0].mimetype;
            }
        }

        const userId = req.user.user_id || req.user.userId;

        if (!media_url) {
            console.error('❌ Moment Creation Failed: No media_url found in req.file, req.files, or req.body');
            return res.status(400).json({ error: 'Media is required' });
        }

        const momentId = require('crypto').randomUUID();
        const media_type = detected_mimetype ? detected_mimetype.split('/')[0] : (media_url.includes('video') ? 'video' : 'image');

        // Cloudinary's `fetch_format: auto` can return a transport-stream (.ts)
        // or other non-container extension on some uploads. Persisting that URL
        // verbatim leaves the player with a 0-byte response and "media
        // unavailable". Normalise the delivery URL back to the source container.
        const MOMENT_VIDEO_EXTENSIONS = /\.(mp4|mov|avi|webm|mkv)$/i;
        if (media_type === 'video' && !MOMENT_VIDEO_EXTENSIONS.test(media_url)) {
            media_url = media_url.replace(/\.[^/.]+$/, '.mp4');
        }

        // Extract HD/Streaming URLs from Cloudinary metadata
        let streaming_url = null;
        let thumbnail_url = null;
        
        if (req.file && req.file.mimetype.startsWith('video/')) {
            // HLS Streaming URL (requires .m3u8 extension)
            streaming_url = media_url.replace(/\.[^/.]+$/, '.m3u8');
            // HD Thumbnail (from eager jpg transformation)
            thumbnail_url = media_url.replace(/\.[^/.]+$/, '.jpg');
        }

        // Extract hashtags (Max 5)
        const tags = caption ? (caption.match(/#[a-zA-Z0-9_]+/g) || []) : [];
        const hashtags = [...new Set(tags.map(t => t.toLowerCase()))].slice(0, 5);

        // Register media in Cloudinary Architecture
        if (req.file) {
            try {
                const MediaService = require('../services/media.service');
                const crypto = require('crypto');
                const fileSizeBytes = req.file.size || 0;
                const hashChecksum = crypto.createHash('md5').update(`${userId}-${fileSizeBytes}-${req.file.originalname}`).digest('hex');
                MediaService.registerMedia({
                    ownerId: userId,
                    category: 'moment',
                    cloudinaryPublicId: req.file.filename,
                    secureUrl: req.file.path,
                    lifecycleState: 'active',
                    isReusable: true, // moments are generally permanent or reusable
                    fileSizeBytes: fileSizeBytes,
                    hashChecksum: hashChecksum,
                    referencedByFeatures: ['moments']
                }).catch(err => console.error('Media registry fail:', err));
            } catch (err) {
                console.error('Failed to import or register media:', err.message);
            }
        }

        // Start transaction
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Insert moment
            await connection.query(
                `INSERT INTO moments 
                (moment_id, user_id, caption, media_url, streaming_url, thumbnail_url, media_type, category, like_count, comment_count, share_count) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)`,
                [momentId, userId, caption || '', media_url, streaming_url, thumbnail_url, media_type, category]
            );

            // Insert hashtags
            for (const tag of hashtags) {
                await connection.query(
                    'INSERT INTO moment_hashtags (moment_id, hashtag) VALUES (?, ?)',
                    [momentId, tag.toLowerCase()]
                );
            }

            await connection.commit();

            // Get created moment with user details
            const [newMoment] = await pool.query(
                `SELECT m.*, u.username, u.name as user_name, u.avatar_url 
                FROM moments m 
                JOIN users u ON m.user_id = u.user_id 
                WHERE m.moment_id = ?`,
                [momentId]
            );

            res.status(201).json({
                status: 'success',
                message: 'Moment created',
                moment: newMoment[0]
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        logger.error('Create Moment Error:', error);
        res.status(500).json({ error: error.message });
    }
};

const saveMoment = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.user_id;

        const [existing] = await pool.query(
            'SELECT * FROM saved_moments WHERE moment_id = ? AND user_id = ?',
            [id, userId]
        );

        if (existing.length > 0) {
            await pool.query(
                'DELETE FROM saved_moments WHERE moment_id = ? AND user_id = ?',
                [id, userId]
            );
            res.json({ status: 'success', action: 'unsaved' });
        } else {
            await pool.query(
                'INSERT INTO saved_moments (moment_id, user_id) VALUES (?, ?)',
                [id, userId]
            );
            res.json({ status: 'success', action: 'saved' });
        }
    } catch (error) {
        logger.error('Save Moment Error:', error);
        res.status(500).json({ error: error.message });
    }
};

const addComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { comment, parentId } = req.body;
        const userId = req.user.user_id;

        const commentId = require('crypto').randomUUID();
        const pid = parentId || null;

        await pool.query(
            `INSERT INTO moment_comments 
            (comment_id, moment_id, user_id, content, parent_comment_id) 
            VALUES (?, ?, ?, ?, ?)`,
            [commentId, id, userId, comment, pid]
        );

        await pool.query(
            'UPDATE moments SET comment_count = comment_count + 1 WHERE moment_id = ?',
            [id]
        );

        // Get comment with user details
        const [newComment] = await pool.query(
            `SELECT c.*, u.username, u.avatar_url 
            FROM moment_comments c 
            JOIN users u ON c.user_id = u.user_id 
            WHERE c.comment_id = ?`,
            [commentId]
        );

        // Create notification for moment owner
        const [moment] = await pool.query('SELECT user_id FROM moments WHERE moment_id = ?', [id]);
        if (moment[0] && moment[0].user_id !== userId) {
            await pool.query(
                `INSERT INTO notifications 
                (notification_id, user_id, type, title, content, related_id, related_type, actor_id, action_url) 
                VALUES (UUID(), ?, 'comment', 'New Comment', 'Someone commented on your moment.', ?, 'moment', ?, CONCAT('/moments/', ?))`,
                [moment[0].user_id, id, userId, id]
            );
        }

        res.status(201).json({
            status: 'success',
            comment: newComment[0]
        });
    } catch (error) {
        logger.error('Add Comment Error:', error);
        res.status(500).json({ error: error.message });
    }
};

const getComments = async (req, res) => {
    try {
        const { id } = req.params;
        const currentUserId = req.user.user_id;

        const [allComments] = await pool.query(
            `SELECT c.*, u.username, u.avatar_url,
                    (SELECT COUNT(*) FROM moment_comment_likes mcl WHERE mcl.comment_id = c.comment_id AND mcl.user_id = ?) as is_liked
            FROM moment_comments c 
            JOIN users u ON c.user_id = u.user_id 
            WHERE c.moment_id = ? 
            ORDER BY c.created_at ASC`,
            [currentUserId, id]
        );

        const commentMap = {};
        const roots = [];

        allComments.forEach(c => {
            c.replies = [];
            commentMap[c.comment_id] = c;
        });

        allComments.forEach(c => {
            if (c.parent_comment_id && commentMap[c.parent_comment_id]) {
                commentMap[c.parent_comment_id].replies.push(c);
            } else {
                roots.push(c);
            }
        });

        res.json({
            status: 'success',
            comments: roots.reverse() // Newest on top
        });
    } catch (error) {
        logger.error('Get Comments Error:', error);
        res.status(500).json({ error: error.message });
    }
};

const likeComment = async (req, res) => {
    try {
        const { id } = req.params; // comment_id
        const userId = req.user.user_id;

        const [existing] = await pool.query(
            'SELECT * FROM moment_comment_likes WHERE comment_id = ? AND user_id = ?',
            [id, userId]
        );

        let action = '';
        if (existing.length > 0) {
            await pool.query('DELETE FROM moment_comment_likes WHERE comment_id = ? AND user_id = ?', [id, userId]);
            await pool.query('UPDATE moment_comments SET like_count = GREATEST(like_count - 1, 0) WHERE comment_id = ?', [id]);
            action = 'unliked';
        } else {
            await pool.query('INSERT INTO moment_comment_likes (comment_id, user_id) VALUES (?, ?)', [id, userId]);
            await pool.query('UPDATE moment_comments SET like_count = like_count + 1 WHERE comment_id = ?', [id]);
            action = 'liked';
        }

        const [updated] = await pool.query('SELECT like_count FROM moment_comments WHERE comment_id = ?', [id]);
        res.json({ 
            success: true, 
            action, 
            likes: updated[0]?.like_count || 0 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const followUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.user_id;

        if (userId === currentUserId) {
            return res.status(400).json({ error: 'Cannot follow yourself' });
        }

        const [existing] = await pool.query(
            'SELECT * FROM follows WHERE follower_id = ? AND following_id = ?',
            [currentUserId, userId]
        );

        if (existing.length > 0) {
            await pool.query(
                'DELETE FROM follows WHERE follower_id = ? AND following_id = ?',
                [currentUserId, userId]
            );
            res.json({ status: 'success', action: 'unfollowed' });
        } else {
            await pool.query(
                'INSERT INTO follows (follower_id, following_id) VALUES (?, ?)',
                [currentUserId, userId]
            );

            // Create notification
            await pool.query(
                `INSERT INTO notifications 
                (notification_id, user_id, type, title, content, related_id, related_type, actor_id, action_url) 
                VALUES (UUID(), ?, 'follow', 'New Follower', 'Someone started following you.', ?, 'user', ?, '/connect')`,
                [userId, currentUserId, currentUserId]
            );

            res.json({ status: 'success', action: 'followed' });
        }
    } catch (error) {
        logger.error('Follow User Error:', error);
        res.status(500).json({ error: error.message });
    }
};

const trackShare = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query(
            'UPDATE moments SET share_count = share_count + 1 WHERE moment_id = ?',
            [id]
        );
        res.json({ status: 'success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getShareData = async (req, res) => {
    try {
        const { id } = req.params;
        const [moments] = await pool.query(`
            SELECT m.*, u.username, u.name 
            FROM moments m 
            JOIN users u ON m.user_id = u.user_id 
            WHERE m.moment_id = ?
        `, [id]);

        if (moments.length === 0) {
            return res.status(404).json({ error: 'Moment not found' });
        }

        const moment = moments[0];
        res.json({
            title: `${moment.name} (@${moment.username}) on Sparkle`,
            description: moment.caption || 'Check out this moment on Sparkle!',
            image: moment.media_url.startsWith('http') ? moment.media_url : `${req.protocol}://${req.get('host')}${moment.media_url}`,
            url: `${req.protocol}://${req.get('host')}/moments/${id}`,
            type: 'video.moment'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const trackView = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query(
            'UPDATE moments SET view_count = view_count + 1 WHERE moment_id = ?',
            [id]
        );
        res.json({ status: 'success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Telemetry endpoint for behavioral tracking
 */
const trackEngagement = async (req, res) => {
    try {
        const { id } = req.params;
        const { type, value, category } = req.body;
        const userId = req.user.user_id;

        await sessionInterestService.recordEvent(userId, id, { type, value, category });
        
        // Also perform the standard count increment if applicable
        if (type === 'share') {
            await pool.query('UPDATE moments SET share_count = share_count + 1 WHERE moment_id = ?', [id]);
        }

        res.json({ status: 'success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Creator dashboard: the signed-in user's own moments with engagement stats.
 * Read-only. Soft-deleted rows are excluded — a takedown removes it from the
 * creator's dashboard, not from the database.
 */
const getMyMoments = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const page = Math.max(parseInt(req.query.page, 10) || 0, 0);
        const limit = Math.min(parseInt(req.query.limit, 10) || 12, 50);
        const offset = page * limit;

        // Single round-trip: the page plus real lifetime aggregates. The
        // dashboard previously summed the returned rows client-side, which
        // silently under-reported the moment anyone passed the page limit.
        const [rows] = await pool.query(
            `SELECT moment_id, caption, media_url, thumbnail_url, media_type,
                    like_count, comment_count, share_count, view_count, created_at,
                    COUNT(*) OVER ()          AS total_count,
                    SUM(like_count)    OVER () AS total_likes,
                    SUM(comment_count) OVER () AS total_comments,
                    SUM(share_count)   OVER () AS total_shares,
                    SUM(view_count)    OVER () AS total_views
               FROM moments
              WHERE user_id = ? AND deleted_at IS NULL
              ORDER BY created_at DESC
              LIMIT ? OFFSET ?`,
            [userId, limit, offset]
        );

        const first = rows?.[0];

        // Recently taken-down moments for the restore UI.
        const [deletedRows] = await pool.query(
            `SELECT moment_id, caption, thumbnail_url, media_type, deleted_at
               FROM moments
              WHERE user_id = ? AND deleted_at IS NOT NULL
              ORDER BY deleted_at DESC
              LIMIT 25`, [userId]
        );

        res.json({
            success: true,
            moments: rows || [],
            deleted: deletedRows || [],
            total: first?.total_count || 0,
            totals: {
                views: first?.total_views || 0,
                sparks: first?.total_likes || 0,
                comments: first?.total_comments || 0,
                shares: first?.total_shares || 0
            },
            page,
            limit
        });
    } catch (error) {
        logger.error('[Moments] getMyMoments failed:', error.message);
        res.status(500).json({ error: 'Failed to load your moments' });
    }
};

/**
 * Takedown. Soft-delete: sets deleted_at, keeps the row and the media file so
 * the action is recoverable. Hard-deleting user content on a single request
 * with no restore path is not something to do by default.
 */
const deleteMoment = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const { id } = req.params;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // Ownership check is part of the WHERE clause, so a moment belonging to
        // someone else updates zero rows and reports not-found rather than
        // leaking its existence.
        const [result] = await pool.query(
            `UPDATE moments SET deleted_at = NOW()
              WHERE moment_id = ? AND user_id = ? AND deleted_at IS NULL`,
            [id, userId]
        );

        if (!result || result.affectedRows === 0) {
            return res.status(404).json({ error: 'Moment not found or already taken down' });
        }

        // Best-effort cache invalidation — a stale ranked feed serving a taken-down
        // moment is the visible bug, so clear it. Never fails the request.
        try {
            const momentsRankingService = require('../services/momentsRanking.service');
            await momentsRankingService.invalidateFeedForOwner?.(userId);
        } catch (_) { /* cache is an optimisation; takedown already succeeded */ }

        res.json({ success: true, message: 'Moment taken down' });
    } catch (error) {
        logger.error('[Moments] deleteMoment failed:', error.message);
        res.status(500).json({ error: 'Failed to take down moment' });
    }
};

/** Undo a takedown — restores the moment to the creator's dashboard. */
const restoreMoment = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const { id } = req.params;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const [result] = await pool.query(
            `UPDATE moments SET deleted_at = NULL
              WHERE moment_id = ? AND user_id = ? AND deleted_at IS NOT NULL`,
            [id, userId]
        );

        if (!result || result.affectedRows === 0) {
            return res.status(404).json({ error: 'Moment not found or not taken down' });
        }

        try {
            const momentsRankingService = require('../services/momentsRanking.service');
            await momentsRankingService.invalidateFeedForOwner?.(userId);
        } catch (_) { /* non-fatal */ }

        res.json({ success: true, message: 'Moment restored' });
    } catch (error) {
        logger.error('[Moments] restoreMoment failed:', error.message);
        res.status(500).json({ error: 'Failed to restore moment' });
    }
};

/**
 * Called once at server startup to run migrations and pre-warm the feed cache.
 * Keeps the hot API path clean of setup overhead.
 */
const prewarm = async () => {
    try {
        await ensureMomentTables();
        await ensureMomentColumns();
        // Kick off pool generation in background (non-blocking)
        momentsRankingService.generateCandidatePools(true).catch(() => {});
        logger.info('Moments prewarm complete.');
    } catch (e) {
        logger.warn('Moments prewarm error: ' + e.message);
    }
};

module.exports = {
    getMomentsStream,
    createMoment,
    sparkMoment,
    saveMoment,
    addComment,
    getComments,
    followUser,
    trackShare,
    trackView,
    trackEngagement,
    getShareData,
    likeComment,
    getMomentById,
    getMyMoments,
    deleteMoment,
    restoreMoment,
    prewarm
};
