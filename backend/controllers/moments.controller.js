const pool = require('../config/database');
const logger = require('../utils/logger');
const sessionInterestService = require('../services/session-interest.service');
const momentsRankingService = require('../services/moments-ranking.service');
const visibility = require('../services/reels-visibility.service');
const NotificationService = require('../services/notification.service');
const notificationController = require('./notification.controller');
const { transaction } = require('../utils/database/transaction');
const { STORY_AUDIENCES } = require('../services/story-audience.service');

const VALID_AUDIENCES = new Set(['public', 'friends', 'close_friends', 'only_me']);

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
                updated_at TIMESTAMP NULL DEFAULT NULL,
                is_deleted TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_mc_moment (moment_id),
                INDEX idx_mc_parent (parent_comment_id),
                INDEX idx_mc_is_deleted (is_deleted)
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
        // Viewer history: one row per (moment, viewer); rows older than 30
        // days are purged opportunistically and never returned by the API.
        await pool.query(`
            CREATE TABLE IF NOT EXISTS moment_views (
                moment_id CHAR(36) NOT NULL,
                viewer_id CHAR(36) NOT NULL,
                viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (moment_id, viewer_id),
                INDEX idx_mv_viewed (viewed_at),
                INDEX idx_mv_viewer (viewer_id)
            )
        `);
        // Owner-created stickers extracted from their own reels.
        await pool.query(`
            CREATE TABLE IF NOT EXISTS saved_stickers (
                sticker_id CHAR(36) PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                moment_id CHAR(36) DEFAULT NULL,
                image_data MEDIUMTEXT NOT NULL,
                caption VARCHAR(140) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_ss_user (user_id, created_at)
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
        await pool.query(`
            CREATE TABLE IF NOT EXISTS moment_comment_moderation_log (
                id CHAR(36) PRIMARY KEY,
                reel_id CHAR(36) NOT NULL,
                comment_id CHAR(36) NOT NULL,
                reply_id CHAR(36) DEFAULT NULL,
                moderator_id CHAR(36) NOT NULL,
                comment_author_id CHAR(36) NOT NULL,
                moderation_reason VARCHAR(100) NOT NULL,
                reason_details TEXT DEFAULT NULL,
                action VARCHAR(50) NOT NULL DEFAULT 'delete',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_mcml_reel (reel_id),
                INDEX idx_mcml_comment (comment_id),
                INDEX idx_mcml_moderator (moderator_id),
                INDEX idx_mcml_author (comment_author_id)
            )
        `);
        // Reporting is separate from creator moderation: reports never delete
        // content, they only queue it for platform review (admin/moderator).
        await pool.query(`
            CREATE TABLE IF NOT EXISTS moment_comment_reports (
                report_id CHAR(36) PRIMARY KEY,
                comment_id CHAR(36) NOT NULL,
                moment_id CHAR(36) NOT NULL,
                reporter_id CHAR(36) NOT NULL,
                reason VARCHAR(500) NOT NULL,
                status ENUM('pending','reviewed','resolved','dismissed') NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_mcr_comment_reporter (comment_id, reporter_id),
                INDEX idx_mcr_moment (moment_id),
                INDEX idx_mcr_status (status)
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
        { name: 'is_pinned', def: 'TINYINT(1) DEFAULT 0' },
        { name: 'deleted_at', def: 'TIMESTAMP NULL DEFAULT NULL' }
    ];
    // Check 'moment_comments' table
    const commentCols = [
        { name: 'parent_comment_id', def: 'CHAR(36) DEFAULT NULL' },
        { name: 'like_count', def: 'INT DEFAULT 0' },
        { name: 'updated_at', def: 'TIMESTAMP NULL DEFAULT NULL' },
        { name: 'is_deleted', def: 'TINYINT(1) DEFAULT 0' }
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

/**
 * Idempotent schema guard for the comment feature (soft-delete columns,
 * moderation audit log, comment reports). Both ensure* helpers short-circuit
 * on module-level flags after the first successful run, so calling this per
 * comment request costs nothing at steady state and self-heals if the
 * boot-time prewarm failed (e.g. DB briefly unavailable).
 */
const ensureCommentSchema = async () => {
    await ensureMomentTables();
    await ensureMomentColumns();
};

const getMomentById = async (req, res) => {
    try {
        const { id } = req.params;
        const viewerId = req.user?.user_id;
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
            WHERE m.moment_id = ? AND m.deleted_at IS NULL
        `, [viewerId, viewerId, viewerId, id]);

        if (moments.length === 0) {
            return res.status(404).json({ error: 'Moment not found' });
        }

        // Server-side audience enforcement — hiding rows in the client is not enough
        const allowed = await visibility.canViewMoment(moments[0], viewerId);
        if (!allowed) {
            return res.status(404).json({ error: 'Moment not found' });
        }

        res.json({
            success: true,
            moment: visibility.stripPrivateFields(moments[0], { isOwner: String(moments[0].user_id) === String(viewerId) }),
        });
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
                        audience:      item.audience || 'public',
                        hide_from_user_ids: item.hide_from_user_ids || null,
                        show_only_user_ids: item.show_only_user_ids || null,
                        watermark:    item.watermark,
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

        // Final server-side audience pass — ranked pools may contain only
        // public rows, but friends/close-friends items coming from the
        // following pool must still be checked against the viewer's graph.
        try {
            momentsToReturn = await visibility.filterVisible(momentsToReturn || [], currentUserId);
        } catch (visErr) {
            logger.warn('[MomentsStream] visibility filter failed:', visErr.message);
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

/**
 * A single user's moments for profile REELS grids. Full audience enforcement
 * happens in filterVisible (owner sees everything; viewers get audience,
 * hide_from/show_only, close-friends, and block rules). Rows are stripped of
 * author-only fields before leaving the server.
 */
const getUserMoments = async (req, res) => {
    try {
        const targetUserId = req.params.userId;
        const currentUserId = req.user.user_id;
        const limit = Math.min(parseInt(req.query.limit, 10) || 30, 50);

        const [rows] = await pool.query(
            `SELECT m.*, u.username, u.name as user_name, u.avatar_url,
                    (SELECT COUNT(*) FROM moment_likes WHERE moment_id = m.moment_id AND user_id = ?) as is_liked,
                    (SELECT COUNT(*) FROM saved_moments WHERE moment_id = m.moment_id AND user_id = ?) as is_saved,
                    (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = m.user_id) as is_following
             FROM moments m
             JOIN users u ON m.user_id = u.user_id
             WHERE m.user_id = ? AND m.deleted_at IS NULL
             ORDER BY m.is_pinned DESC, m.created_at DESC
             LIMIT ?`,
            [currentUserId, currentUserId, currentUserId, targetUserId, limit]
        );

        const visible = await visibility.filterVisible(rows || [], currentUserId);
        res.json({
            moments: visible,
            pagination: { limit, total: visible.length, hasMore: (rows || []).length === limit },
        });
    } catch (error) {
        logger.error('User moments error:', error);
        res.status(500).json({ error: 'Failed to load moments' });
    }
};

/** Owner-only pin toggle for the profile Reels grid. */
const toggleMomentPin = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.user_id;
        const [rows] = await pool.query(
            'SELECT user_id, is_pinned FROM moments WHERE moment_id = ? AND deleted_at IS NULL',
            [id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Moment not found' });
        if (String(rows[0].user_id) !== String(userId)) {
            return res.status(403).json({ error: 'Only the creator can pin this reel' });
        }
        const next = Number(rows[0].is_pinned) === 1 ? 0 : 1;
        await pool.query('UPDATE moments SET is_pinned = ? WHERE moment_id = ?', [next, id]);
        res.json({ status: 'success', is_pinned: next });
    } catch (error) {
        logger.error('Toggle Moment Pin Error:', error);
        res.status(500).json({ error: error.message });
    }
};

const sparkMoment = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.user_id;

        // Gate on audience — never let invisible moments be (un)liked
        const [targetRows] = await pool.query(
            'SELECT * FROM moments WHERE moment_id = ? AND deleted_at IS NULL',
            [id]
        );
        if (!targetRows.length || !(await visibility.canViewMoment(targetRows[0], userId))) {
            return res.status(404).json({ error: 'Moment not found' });
        }

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

/**
 * Whether a request asked for the reel to be shared to the author's story.
 * The composer sends several truthy shapes depending on the platform.
 */
const wantsStoryShare = (v) =>
  v === '1' || v === 1 || v === true || v === 'true';

/**
 * Share an already-published moment to the author's story by reusing the
 * moment's uploaded media — no second upload.
 *
 * This is deliberately idempotent and lives outside every publish path's
 * transaction: a story failure must never roll the reel back, and a retried
 * publish must never leave a story unshared or shared twice.
 *
 * Returns true when a story exists for this moment, false when it does not.
 */
const shareMomentToStory = async (moment) => {
  // Already shared — nothing to do. This check is what makes a replayed
  // publish idempotent end to end rather than relying on the client to
  // re-upload, which it has no way to make idempotent.
  if (moment.shared_to_story === 1 || moment.shared_to_story === '1') {
    return true;
  }

  const mediaUrl = moment.media_url;
  if (!mediaUrl) return false;

  try {
    const storyId = require('crypto').randomUUID();
    const storyCaption = String(moment.title || moment.description || moment.caption || '').slice(0, 255) || null;
    const storyType = ['image', 'video', 'text'].includes(moment.media_type) ? moment.media_type : 'video';

    // Carry the moment's audience into the story so a followers/
    // close_friends/only_me reel does not become a PUBLIC story.
    // Moment vocabulary ('friends') maps onto story vocabulary
    // ('followers'); anything unrecognised falls back to public.
    const storyAudience = moment.audience === 'friends'
      ? 'followers'
      : (STORY_AUDIENCES.has(moment.audience) ? moment.audience : 'public');

    await pool.query(
      `INSERT INTO stories (story_id, user_id, media_url, media_type, caption, thumbnail_url, audience)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [storyId, moment.user_id, mediaUrl, storyType, storyCaption, moment.thumbnail_url, storyAudience]
    );
    await pool.query('UPDATE moments SET shared_to_story = 1 WHERE moment_id = ?', [moment.moment_id]);
    return true;
  } catch (storyErr) {
    logger.warn('[Moments] share-to-story insert failed: ' + storyErr.message);
    return false;
  }
};

const createMoment = async (req, res) => {
    try {
        const {
            caption, category = 'general',
            title = null, description = null,
            audience = 'public', comments_enabled = '1',
            overlays = null, clips_info = null, music_info = null,
            captions_info = null, duration_seconds = null,
            watermark = '0', idempotency_key = null,
            shared_to_story = '0',
        } = req.body;

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

        // Idempotency: a retried publish with the same key returns the
        // existing moment instead of creating a duplicate.
        const idemKey = idempotency_key ? String(idempotency_key).slice(0, 64) : null;
        if (idemKey) {
            const [existing] = await pool.query(
                'SELECT * FROM moments WHERE user_id = ? AND idempotency_key = ?',
                [userId, idemKey]
            );
    if (existing.length > 0) {
      // Complete the story share here rather than letting the client fall
      // back to a re-upload it cannot make idempotent. If the original
      // publish shared already this is a no-op; if its story insert failed,
      // this is where the retry finishes the job.
      const storyCreated = wantsStoryShare(shared_to_story)
        ? await shareMomentToStory(existing[0])
        : existing[0].shared_to_story === 1;

      return res.status(200).json({
        status: 'success',
        message: 'Moment already published (idempotent replay)',
        moment: storyCreated ? { ...existing[0], shared_to_story: 1 } : existing[0],
        story_created: storyCreated,
        deduplicated: true,
      });
    }
        }

        const safeAudience = VALID_AUDIENCES.has(audience) ? audience : 'public';
        const commentsOn = comments_enabled === '0' || comments_enabled === 0 || comments_enabled === false ? 0 : 1;
        const watermarkOn = watermark === '1' || watermark === 1 || watermark === true ? 1 : 0;

        const parseJsonField = (value) => {
            if (value == null || value === '') return null;
            try { return JSON.stringify(typeof value === 'string' ? JSON.parse(value) : value); }
            catch (_) { return null; }
        };

        // Per-moment exclusion lists travel inside the composer's overlays
        // payload — extract them into real columns so feed queries and
        // visibility.canView can enforce them without parsing big blobs.
        const sanitizeIdList = (list) => Array.isArray(list)
            ? [...new Set(list.map(String).filter(Boolean))].slice(0, 500)
            : [];
        let overlaysObj = null;
        if (overlays != null && overlays !== '') {
            try { overlaysObj = typeof overlays === 'string' ? JSON.parse(overlays) : overlays; }
            catch (_) { overlaysObj = null; }
        }
        const hideFromIds = sanitizeIdList(overlaysObj?.hide_from);
        const showOnlyIds = sanitizeIdList(overlaysObj?.show_only);

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
        
        if (req.file && (req.file.mimetype || '').startsWith('video/')) {
            // HLS Streaming URL (requires .m3u8 extension)
            streaming_url = media_url.replace(/\.[^/.]+$/, '.m3u8');
            // HD Thumbnail (from eager jpg transformation)
            thumbnail_url = media_url.replace(/\.[^/.]+$/, '.jpg');
        }

        // Extract hashtags (Max 5) — from explicit list or caption/description
        const explicitTags = Array.isArray(req.body.hashtags)
            ? req.body.hashtags
            : (typeof req.body.hashtags === 'string' ? req.body.hashtags.split(',') : []);
        const tagSource = `${caption || ''} ${description || ''} ${explicitTags.join(' ')}`;
        const tags = tagSource.match(/#[a-zA-Z0-9_]+/g) || explicitTags.map(t => `#${t}`);
        const hashtags = [...new Set(tags.map(t => t.toLowerCase().replace(/^#/, '#')))]
            .filter(t => t.length > 1)
            .slice(0, 5);

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
            // Insert moment (v2 columns are ensured by visibility.ensureTables at boot)
            await connection.query(
                `INSERT INTO moments 
                (moment_id, user_id, caption, title, description, media_url, streaming_url, thumbnail_url,
                 media_type, category, like_count, comment_count, share_count,
                 audience, comments_enabled, overlays, clips_info, music_info, captions_info,
                 duration_seconds, watermark, idempotency_key,
                 hide_from_user_ids, show_only_user_ids)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    momentId, userId, caption || '',
                    title ? String(title).slice(0, 250) : null,
                    description ? String(description).slice(0, 5000) : null,
                    media_url, streaming_url, thumbnail_url, media_type, category,
                    safeAudience, commentsOn,
                    parseJsonField(overlays),
                    parseJsonField(clips_info),
                    parseJsonField(music_info),
                    parseJsonField(captions_info),
                    duration_seconds != null && duration_seconds !== '' ? Number(duration_seconds) || null : null,
                    watermarkOn,
                    idemKey,
                    hideFromIds.length ? JSON.stringify(hideFromIds) : null,
                    showOnlyIds.length ? JSON.stringify(showOnlyIds) : null,
                ]
            );

            // Insert hashtags idempotently (INSERT IGNORE handles retried publishes)
            for (const tag of hashtags) {
                const clean = tag.replace(/^#/, '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 100);
                if (!clean) continue;
                await connection.query(
                    'INSERT IGNORE INTO moment_hashtags (id, moment_id, hashtag) VALUES (UUID(), ?, ?)',
                    [momentId, clean]
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

            // ── Share to story: reuse the moment's already-uploaded media ──
            // No second upload; a failure never fails the publish — the client
            // sees story_created=false and falls back to POST /stories.
            const storyCreated = wantsStoryShare(shared_to_story)
                ? await shareMomentToStory({
                    moment_id: momentId,
                    user_id: userId,
                    media_url,
                    media_type,
                    title,
                    description,
                    caption,
                    thumbnail_url,
                    audience: safeAudience,
                    shared_to_story: 0,
                  })
              : false;

            // ── moment_published notification ──
            // eventId is derived from the moment id so a retried publish
            // (idempotent replay) can never double-notify the author.
            try {
                await NotificationService.send({
                    type: 'moment',
                    priority: 'LOW',
                    recipients: [userId],
                    data: {
                        title: 'Reel published',
                        content: String(title || caption || 'Your reel is live on Sparkle').slice(0, 120),
                        url: `/moments/${momentId}`,
                    },
                    eventId: `moment-published:${momentId}`,
                });
            } catch (notifErr) {
                logger.warn('[Moments] moment_published notification failed: ' + notifErr.message);
            }

            res.status(201).json({
                status: 'success',
                message: 'Moment created',
                moment: storyCreated ? { ...newMoment[0], shared_to_story: 1 } : newMoment[0],
                story_created: storyCreated,
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        // Unique key race on idempotency_key → return the winner row
        if (error && (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) && req.body?.idempotency_key) {
            try {
                const userId = req.user.user_id || req.user.userId;
                const [existing] = await pool.query(
                    'SELECT * FROM moments WHERE user_id = ? AND idempotency_key = ?',
                    [userId, String(req.body.idempotency_key).slice(0, 64)]
                );
          if (existing.length > 0) {
            const storyCreated = wantsStoryShare(req.body.shared_to_story)
              ? await shareMomentToStory(existing[0])
              : existing[0].shared_to_story === 1;

            return res.status(200).json({
              status: 'success',
              message: 'Moment already published (idempotent replay)',
              moment: storyCreated ? { ...existing[0], shared_to_story: 1 } : existing[0],
              story_created: storyCreated,
              deduplicated: true,
            });
          }
            } catch (_) { /* fall through to generic error */ }
        }
        logger.error('Create Moment Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Owner-only privacy update for an existing reel: audience, hide-from and
 * show-only exclusions. Ownership is enforced in SQL (user_id = requester),
 * so another user can never mutate these fields even with a valid id.
 */
const updateMomentPrivacy = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.user_id;
        const { audience, hide_from, show_only } = req.body || {};

        if (audience !== undefined && !VALID_AUDIENCES.has(audience)) {
            return res.status(400).json({ error: 'Invalid audience value' });
        }

        const [rows] = await pool.query(
            'SELECT * FROM moments WHERE moment_id = ? AND deleted_at IS NULL',
            [id]
        );
        if (!rows.length) {
            return res.status(404).json({ error: 'Moment not found' });
        }
        if (String(rows[0].user_id) !== String(userId)) {
            return res.status(403).json({ error: 'Only the creator can change this reel\'s privacy' });
        }

        const current = rows[0];
        const nextAudience = audience !== undefined ? audience : (current.audience || 'public');
        const nextHide = Array.isArray(hide_from) ? visibility.parseIdList(hide_from) : visibility.parseIdList(current.hide_from_user_ids);
        const nextShow = Array.isArray(show_only) ? visibility.parseIdList(show_only) : visibility.parseIdList(current.show_only_user_ids);

        await pool.query(
            `UPDATE moments
             SET audience = ?, hide_from_user_ids = ?, show_only_user_ids = ?
             WHERE moment_id = ? AND user_id = ?`,
            [
                nextAudience,
                nextHide.length ? JSON.stringify(nextHide) : null,
                nextShow.length ? JSON.stringify(nextShow) : null,
                id,
                userId,
            ]
        );

        const [updated] = await pool.query('SELECT * FROM moments WHERE moment_id = ?', [id]);
        res.json({
            status: 'success',
            moment: visibility.stripPrivateFields(updated[0], { isOwner: true }),
        });
    } catch (error) {
        logger.error('Update Moment Privacy Error:', error);
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
            // Gate on audience — invisible moments cannot be saved
            const [targetRows] = await pool.query(
                'SELECT * FROM moments WHERE moment_id = ? AND deleted_at IS NULL',
                [id]
            );
            if (!targetRows.length || !(await visibility.canViewMoment(targetRows[0], userId))) {
                return res.status(404).json({ error: 'Moment not found' });
            }
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
        await ensureCommentSchema();

        // Enforce visibility + comments_enabled server-side
        const [targetRows] = await pool.query(
            'SELECT * FROM moments WHERE moment_id = ? AND deleted_at IS NULL',
            [id]
        );
        if (!targetRows.length) {
            return res.status(404).json({ error: 'Moment not found' });
        }
        const canComment = await visibility.canCommentOn(targetRows[0], userId);
        if (!canComment) {
            if (Number(targetRows[0].comments_enabled) === 0) {
                return res.status(403).json({ error: 'Comments are turned off for this reel' });
            }
            return res.status(404).json({ error: 'Moment not found' });
        }

        const commentId = require('crypto').randomUUID();

        // Validate the parent server-side: it must exist, belong to this same
        // reel and still be live. Replies-to-replies flatten onto the thread
        // root so the single-level tree can never grow orphaned grandchildren.
        let pid = null;
        if (parentId) {
            const [parentRows] = await pool.query(
                `SELECT comment_id, parent_comment_id FROM moment_comments
                 WHERE comment_id = ? AND moment_id = ? AND is_deleted = 0`,
                [parentId, id]
            );
            if (!parentRows.length) {
                return res.status(400).json({ error: 'Parent comment not found' });
            }
            pid = parentRows[0].parent_comment_id || parentRows[0].comment_id;
        }

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
        await ensureCommentSchema();

        // Comments are only readable on moments the viewer can see
        const [targetRows] = await pool.query(
            'SELECT * FROM moments WHERE moment_id = ? AND deleted_at IS NULL',
            [id]
        );
        if (!targetRows.length || !(await visibility.canViewMoment(targetRows[0], currentUserId))) {
            return res.status(404).json({ error: 'Moment not found' });
        }

        const [allComments] = await pool.query(
            `SELECT c.*, u.username, u.avatar_url,
                    (SELECT COUNT(*) FROM moment_comment_likes mcl WHERE mcl.comment_id = c.comment_id AND mcl.user_id = ?) as is_liked
            FROM moment_comments c 
            JOIN users u ON c.user_id = u.user_id 
            WHERE c.moment_id = ? AND c.is_deleted = 0
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
            comments: roots.reverse(), // Newest on top
            // Used by the client to decide whether the viewer may moderate
            // (never to authorize anything — the server re-checks every write).
            reel_owner_id: targetRows[0].user_id || null
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
            await pool.query('UPDATE moment_comments SET like_count = GREATEST(like_count - 1, 0), updated_at = updated_at WHERE comment_id = ?', [id]);
            action = 'unliked';
        } else {
            await pool.query('INSERT INTO moment_comment_likes (comment_id, user_id) VALUES (?, ?)', [id, userId]);
            await pool.query('UPDATE moment_comments SET like_count = like_count + 1, updated_at = updated_at WHERE comment_id = ?', [id]);
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

        // Share metadata carries the caption/title — keep it off invisible reels
        const viewerId = req.user?.user_id || req.user?.userId;
        if (!(await visibility.canViewMoment(moments[0], viewerId))) {
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

// In-memory throttle for the opportunistic 30-day viewer-history purge.
let lastViewPurgeAt = 0;

const trackView = async (req, res) => {
    try {
        const { id } = req.params;
        const viewerId = req.user.user_id;
        await ensureMomentTables();

        const [rows] = await pool.query(
            'SELECT * FROM moments WHERE moment_id = ? AND deleted_at IS NULL',
            [id]
        );
        if (!rows.length) {
            return res.status(404).json({ error: 'Moment not found' });
        }
        const momentRow = rows[0];

        // Owners reviewing their own reel never inflate the count.
        if (String(momentRow.user_id) === String(viewerId)) {
            return res.json({ status: 'success', counted: false });
        }

        // Visibility is enforced server-side — an excluded viewer cannot
        // record a view (and thus never appears in the viewers list).
        if (!(await visibility.canViewMoment(momentRow, viewerId))) {
            return res.status(403).json({ error: 'Not authorized to view this moment' });
        }

        // Dedup: exactly one history row per (moment, viewer); repeat views
        // only refresh the timestamp. affectedRows === 1 means an INSERT
        // (first view), === 2 means the ON DUPLICATE UPDATE ran.
        const [result] = await pool.query(
            `INSERT INTO moment_views (moment_id, viewer_id, viewed_at) VALUES (?, ?, NOW())
             ON DUPLICATE KEY UPDATE viewed_at = NOW()`,
            [id, viewerId]
        );
        if (result.affectedRows === 1) {
            await pool.query(
                'UPDATE moments SET view_count = view_count + 1 WHERE moment_id = ?',
                [id]
            );
        }

        // Opportunistic 30-day retention purge (at most once per hour, best-effort).
        const now = Date.now();
        if (now - lastViewPurgeAt > 60 * 60 * 1000) {
            lastViewPurgeAt = now;
            void pool.query(
                'DELETE FROM moment_views WHERE viewed_at < DATE_SUB(NOW(), INTERVAL 30 DAY)'
            ).catch(() => { /* best-effort; next view retries */ });
        }

        res.json({ status: 'success', counted: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Owner-only viewer list. The 30-day retention window is enforced in SQL
 * here (in addition to the background purge), so history older than the
 * window can never be surfaced by the client.
 */
const getMomentViewers = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.user_id;
        await ensureMomentTables();

        const [rows] = await pool.query(
            'SELECT user_id FROM moments WHERE moment_id = ? AND deleted_at IS NULL',
            [id]
        );
        if (!rows.length) {
            return res.status(404).json({ error: 'Moment not found' });
        }
        if (String(rows[0].user_id) !== String(userId)) {
            return res.status(403).json({ error: 'Only the creator can see who viewed this reel' });
        }

        const [viewers] = await pool.query(
            `SELECT v.viewer_id, u.username, u.name, u.avatar_url, v.viewed_at
             FROM moment_views v
             JOIN users u ON u.user_id = v.viewer_id
             WHERE v.moment_id = ?
               AND v.viewed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
             ORDER BY v.viewed_at DESC
             LIMIT 50`,
            [id]
        );
        res.json({ status: 'success', viewers });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ── Saved stickers (created from the owner's reels) ──────────────────────────

const MAX_STICKER_BYTES = 500 * 1024; // ~500KB base64 cap per sticker

/** Save a sticker (a rendered frame from one of the caller's own reels). */
const saveSticker = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { moment_id, image_data, caption } = req.body || {};

        if (!image_data || typeof image_data !== 'string' || !image_data.startsWith('data:image/')) {
            return res.status(400).json({ error: 'image_data must be a data:image/... URL' });
        }
        if (image_data.length > MAX_STICKER_BYTES) {
            return res.status(413).json({ error: 'Sticker image is too large (max ~500KB).' });
        }

        // Only the owner may turn one of their reels into a sticker.
        if (moment_id) {
            const [rows] = await pool.query(
                'SELECT user_id FROM moments WHERE moment_id = ? AND deleted_at IS NULL',
                [moment_id]
            );
            if (!rows.length) return res.status(404).json({ error: 'Moment not found' });
            if (String(rows[0].user_id) !== String(userId)) {
                return res.status(403).json({ error: 'You can only create stickers from your own reels' });
            }
        }

        const stickerId = require('crypto').randomUUID();
        await pool.query(
            `INSERT INTO saved_stickers (sticker_id, user_id, moment_id, image_data, caption)
             VALUES (?, ?, ?, ?, ?)`,
            [stickerId, userId, moment_id || null, image_data, caption ? String(caption).slice(0, 140) : null]
        );
        res.status(201).json({
            status: 'success',
            sticker: { sticker_id: stickerId, moment_id: moment_id || null, caption: caption || null, image_data },
        });
    } catch (error) {
        logger.error('Save Sticker Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/** List the caller's saved stickers (most recent first). */
const listStickers = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const [stickers] = await pool.query(
            `SELECT sticker_id, moment_id, caption, image_data, created_at
             FROM saved_stickers
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT 50`,
            [userId]
        );
        res.json({ status: 'success', stickers });
    } catch (error) {
        logger.error('List Stickers Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/** Delete one of the caller's saved stickers. */
const deleteSticker = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { id } = req.params;
        const [result] = await pool.query(
            'DELETE FROM saved_stickers WHERE sticker_id = ? AND user_id = ?',
            [id, userId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Sticker not found' });
        }
        res.json({ status: 'success' });
    } catch (error) {
        logger.error('Delete Sticker Error:', error);
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
        await visibility.ensureTables();
        // Kick off pool generation in background (non-blocking)
        momentsRankingService.generateCandidatePools(true).catch(() => {});
        logger.info('Moments prewarm complete.');
    } catch (e) {
        logger.warn('Moments prewarm error: ' + e.message);
    }
};

/**
 * Personalised "You May Like" suggestions for the Moments search drawer.
 *
 * Algorithm — a weighted, per-viewer engagement score over real activity:
 *   • 40 pts  recency  — creators who posted a moment in the last 24h
 *   • 25 pts  affinity — creators the viewer's followees also follow
 *   • 20 pts  popularity — log-scaled follower count (diminishing returns)
 *   • 10 pts  content   — creators who use hashtags the viewer has watched
 *   •  5 pts  freshness — small seeded jitter so the list rotates hourly
 *
 * Everything is computed in SQL over the caller's real graph, then ranked in
 * JS. No mock data: an empty campus simply yields an empty list.
 */
const getMomentSuggestions = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 6, 1), 12);

        const [rows] = await pool.query(`
            SELECT
                u.user_id, u.username, u.name, u.avatar_url,
                COUNT(DISTINCT m.moment_id)                       AS recent_moments,
                MAX(m.created_at)                                 AS last_moment_at,
                COALESCE(f.follower_count, 0)                     AS follower_count,
                COALESCE(following.following_count, 0)            AS following_count,
                COALESCE(mf.mutual_followees, 0)                  AS mutual_followees,
                COALESCE(ht.hashtag_overlap, 0)                   AS hashtag_overlap
            FROM users u
            JOIN moments m
              ON m.user_id = u.user_id
             AND m.deleted_at IS NULL
             AND m.audience = 'public'
             AND m.created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
            LEFT JOIN (
                SELECT following_id, COUNT(*) AS follower_count
                FROM follows GROUP BY following_id
            ) f ON f.following_id = u.user_id
            LEFT JOIN (
                SELECT follower_id, COUNT(*) AS following_count
                FROM follows WHERE follower_id = ?
                GROUP BY follower_id
            ) following ON following.follower_id = ?
            LEFT JOIN (
                -- Creators followed by at least one account the viewer follows.
                SELECT f2.following_id AS creator_id, COUNT(DISTINCT f1.following_id) AS mutual_followees
                FROM follows f1
                JOIN follows f2 ON f2.follower_id = f1.following_id
                WHERE f1.follower_id = ?
                GROUP BY f2.following_id
            ) mf ON mf.creator_id = u.user_id
            LEFT JOIN (
                -- Hashtags the viewer has actually engaged with.
                SELECT mh2.user_id, COUNT(DISTINCT mh2.hashtag) AS hashtag_overlap
                FROM moment_hashtags mh2
                WHERE mh2.hashtag IN (
                    SELECT DISTINCT mh3.hashtag
                    FROM moment_hashtags mh3
                    JOIN moment_views v ON v.moment_id = mh3.moment_id AND v.viewer_id = ?
                    UNION
                    SELECT DISTINCT mh4.hashtag
                    FROM moment_hashtags mh4
                    JOIN moments wm ON wm.moment_id = mh4.moment_id AND wm.user_id = ?
                )
                GROUP BY mh2.user_id
            ) ht ON ht.user_id = u.user_id
            WHERE u.user_id != ?
              AND u.account_status = 'active'
              AND NOT EXISTS (
                  SELECT 1 FROM follows fl
                  WHERE fl.follower_id = ? AND fl.following_id = u.user_id
              )
              AND NOT EXISTS (
                  SELECT 1 FROM user_blocks b
                  WHERE (b.user_id = ? AND b.blocked_user_id = u.user_id)
                     OR (b.user_id = u.user_id AND b.blocked_user_id = ?)
              )
            GROUP BY u.user_id, u.username, u.name, u.avatar_url,
                     f.follower_count, following.following_count,
                     mf.mutual_followees, ht.hashtag_overlap
            HAVING recent_moments > 0
            ORDER BY last_moment_at DESC
            LIMIT 60
        `, [
            userId, userId,
            userId,
            userId,
            userId,
            userId,
            userId,
            userId, userId, userId,
        ]);

        const now = Date.now();
        const hourBucket = Math.floor(now / (60 * 60 * 1000));

        const ranked = rows.map((r) => {
            const lastAt = r.last_moment_at ? new Date(r.last_moment_at).getTime() : 0;
            const hoursSince = lastAt ? (now - lastAt) / 3_600_000 : 72;
            const recency = 40 * Math.exp(-hoursSince / 36);                 // half-life ≈ 25h
            const affinity = 25 * (1 - Math.exp(-Number(r.mutual_followees) / 3));
            const popularity = 20 * (Math.log10(Number(r.follower_count) + 1) / 5);
            const content = 10 * (1 - Math.exp(-Number(r.hashtag_overlap) / 2));
            // Deterministic per (user, hour) jitter — rotates without a RNG dep.
            const jitterSeed = (String(r.user_id) + hourBucket)
                .split('')
                .reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 0);
            const jitter = 5 * ((jitterSeed % 1000) / 1000);

            return { ...r, score: recency + affinity + popularity + content + jitter };
        })
            .filter((r) => r.score > 0.5)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map((r) => ({
                user_id: r.user_id,
                username: r.username,
                name: r.name,
                avatar_url: r.avatar_url,
                follower_count: Number(r.follower_count) || 0,
                mutual_followees: Number(r.mutual_followees) || 0,
                recent_moments: Number(r.recent_moments) || 0,
                score: Math.round(r.score * 10) / 10,
            }));

        res.json({ status: 'success', suggestions: ranked });
    } catch (error) {
        logger.error('Moment Suggestions Error:', error);
        // Never break the drawer: an empty list is an honest, non-fatal state.
        res.json({ status: 'success', suggestions: [] });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// EDIT COMMENT — own comment/reply only, within 48h window
// ─────────────────────────────────────────────────────────────────────────────
const editComment = async (req, res) => {
    try {
        const { id } = req.params; // comment_id
        const { content } = req.body;
        const userId = req.user?.user_id || req.user?.id || req.user?.userId;
        await ensureCommentSchema();

        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Comment content is required' });
        }

        const [rows] = await pool.query(
            'SELECT * FROM moment_comments WHERE comment_id = ? AND is_deleted = 0',
            [id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Comment not found' });

        const comment = rows[0];
        if (String(comment.user_id) !== String(userId)) {
            return res.status(403).json({ error: 'You can only edit your own comments' });
        }

        // 48-hour edit window
        const createdTime = comment.created_at ? new Date(comment.created_at).getTime() : 0;
        if (!isNaN(createdTime) && createdTime > 0) {
            const ageMs = Date.now() - createdTime;
            if (ageMs > 48 * 60 * 60 * 1000) {
                return res.status(403).json({ error: 'Edit window has closed (48 hours after posting)' });
            }
        }

        await pool.query(
            'UPDATE moment_comments SET content = ?, updated_at = NOW() WHERE comment_id = ?',
            [content.trim(), id]
        );

        const [updated] = await pool.query(
            `SELECT c.*, u.username, u.avatar_url FROM moment_comments c
             JOIN users u ON c.user_id = u.user_id WHERE c.comment_id = ?`,
            [id]
        );

        res.json({ success: true, comment: updated[0] });
    } catch (error) {
        logger.error('Edit Comment Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared comment-removal helpers (self-delete + owner moderation use the
// SAME cascade policy so the parent-child rules can never diverge).
// ─────────────────────────────────────────────────────────────────────────────

// Breadth-first walk of a live thread: the root comment plus every live
// descendant. Removing a thread removes all of it — no orphaned replies.
const collectLiveThreadIds = async (conn, rootId) => {
    const ids = [rootId];
    let frontier = [rootId];
    while (frontier.length) {
        const placeholders = frontier.map(() => '?').join(',');
        const [children] = await conn.query(
            `SELECT comment_id FROM moment_comments
             WHERE is_deleted = 0 AND parent_comment_id IN (${placeholders})`,
            frontier
        );
        frontier = (children || [])
            .map((r) => r.comment_id)
            .filter((cid) => !ids.includes(cid));
        ids.push(...frontier);
    }
    return ids;
};

// Soft-delete inside a transaction and decrement the denormalized reel
// counter by exactly the rows that transitioned (never counting rows that
// were already soft-deleted).
const softDeleteCommentsTx = async (conn, ids, momentId) => {
    if (!ids.length) return 0;
    const placeholders = ids.map(() => '?').join(',');
    const [result] = await conn.query(
        `UPDATE moment_comments SET is_deleted = 1
         WHERE is_deleted = 0 AND comment_id IN (${placeholders})`,
        ids
    );
    const affected = Number(result?.affectedRows) || 0;
    if (affected > 0) {
        await conn.query(
            'UPDATE moments SET comment_count = GREATEST(comment_count - ?, 0) WHERE moment_id = ?',
            [affected, momentId]
        );
    }
    return affected;
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE COMMENT — own comment/reply only (self-service deletion).
// Ownership is verified against the database; reel owners and platform
// moderators must use POST /comment/:id/moderate so their removals are
// reasoned, audited and communicated to the author.
// ─────────────────────────────────────────────────────────────────────────────
const deleteComment = async (req, res) => {
    try {
        const { id } = req.params; // comment_id
        const userId = req.user?.user_id || req.user?.id || req.user?.userId;
        await ensureCommentSchema();

        const [rows] = await pool.query(
            `SELECT c.*, m.user_id AS reel_owner_id
             FROM moment_comments c
             JOIN moments m ON c.moment_id = m.moment_id
             WHERE c.comment_id = ? AND c.is_deleted = 0`,
            [id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Comment not found' });

        const comment = rows[0];
        if (String(comment.user_id) !== String(userId)) {
            return res.status(403).json({ error: 'You can only delete your own comments' });
        }

        const deletedCount = await transaction(async (conn) => {
            const ids = await collectLiveThreadIds(conn, id);
            return softDeleteCommentsTx(conn, ids, comment.moment_id);
        });

        res.json({ success: true, deletedCount });
    } catch (error) {
        logger.error('Delete Comment Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Valid moderation reasons (must stay in sync with the client's reason list)
const MODERATION_REASONS = new Set([
    'spam_or_advertising',
    'harassment_or_bullying',
    'hate_speech_or_abusive_language',
    'inappropriate_or_offensive_content',
    'irrelevant_content',
    'impersonation_or_suspicious_activity',
    'other',
]);

// User-safe labels for the notification body. Never expose the moderator's
// private notes / reason_details through a notification.
const REASON_LABELS = {
    spam_or_advertising: 'Spam or advertising',
    harassment_or_bullying: 'Harassment or bullying',
    hate_speech_or_abusive_language: 'Hate speech or abusive language',
    inappropriate_or_offensive_content: 'Inappropriate or offensive content',
    irrelevant_content: 'Irrelevant content',
    impersonation_or_suspicious_activity: 'Impersonation or suspicious activity',
    other: 'Community guidelines',
};

// ─────────────────────────────────────────────────────────────────────────────
// MODERATE COMMENT — removal of ANOTHER user's comment.
// Authorization (checked server-side, never trusted from the client):
//   1. the caller owns the Reel under which the comment was posted, OR
//   2. the caller holds an explicit platform moderation role (admin/moderator).
// The comment author can never be the moderator here (self-delete route).
// ─────────────────────────────────────────────────────────────────────────────
const moderateComment = async (req, res) => {
    try {
        const { id } = req.params; // comment_id
        const { reason, reasonDetails } = req.body;
        const moderatorId = req.user.user_id;
        await ensureCommentSchema();

        if (!reason || !MODERATION_REASONS.has(reason)) {
            return res.status(400).json({ error: 'A valid moderation reason is required' });
        }

        // ── 1. Load comment + reel, verify the reel still exists ──
        const [rows] = await pool.query(
            `SELECT c.*, m.user_id AS reel_owner_id
             FROM moment_comments c
             JOIN moments m ON c.moment_id = m.moment_id
             WHERE c.comment_id = ? AND c.is_deleted = 0 AND m.deleted_at IS NULL`,
            [id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Comment not found' });

        const comment = rows[0];

        // Own comments go through DELETE (no moderation record, no self-notify).
        if (String(comment.user_id) === String(moderatorId)) {
            return res.status(400).json({ error: 'Use self-delete for your own comments' });
        }

        // ── 2. Authorization: actual Reel ownership from the DB, or a real
        //        platform moderation role. Never trust ids from the client. ──
        const isReelOwner = String(comment.reel_owner_id) === String(moderatorId);
        let isPlatformModerator = false;
        if (!isReelOwner) {
            const [roleRows] = await pool.query(
                'SELECT role FROM users WHERE user_id = ?',
                [moderatorId]
            );
            const role = roleRows[0]?.role;
            isPlatformModerator = role === 'admin' || role === 'moderator';
            if (!isPlatformModerator) {
                return res.status(403).json({
                    error: 'Only the creator of this Reel can moderate its comments'
                });
            }
        }

        const commentAuthorId = comment.user_id;
        const isReply = !!comment.parent_comment_id;

        // ── 3. Idempotency: one moderation event per item per moderator.
        //        Retried requests stop here, before any write or notification. ──
        const [existingAudit] = await pool.query(
            `SELECT id FROM moment_comment_moderation_log
             WHERE moderator_id = ? AND ((reply_id IS NULL AND comment_id = ?) OR reply_id = ?)`,
            [moderatorId, id, id]
        );
        if (existingAudit.length) {
            return res.status(409).json({ error: 'This comment has already been moderated' });
        }

        // ── 4. Removal + audit record in ONE transaction ──
        const auditId = require('crypto').randomUUID();
        const deletedCount = await transaction(async (conn) => {
            const ids = await collectLiveThreadIds(conn, id);
            const affected = await softDeleteCommentsTx(conn, ids, comment.moment_id);

            await conn.query(
                `INSERT INTO moment_comment_moderation_log
                 (id, reel_id, comment_id, reply_id, moderator_id, comment_author_id,
                  moderation_reason, reason_details, action)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    auditId,
                    comment.moment_id,
                    // Thread root + the moderated reply (null for top-level).
                    isReply ? comment.parent_comment_id : id,
                    isReply ? id : null,
                    moderatorId,
                    commentAuthorId,
                    reason,
                    reasonDetails ? String(reasonDetails).slice(0, 500) : null,
                    isReelOwner ? 'delete' : 'platform_delete',
                ]
            );
            return affected;
        });

        // ── 5. Notify the removed comment's author (after a successful
        //        commit). Generic, respectful message: no comment text, no
        //        private notes, no internal audit details. ──
        try {
            const [modRows] = await pool.query(
                'SELECT username FROM users WHERE user_id = ?',
                [moderatorId]
            );
            const moderatorUsername = modRows[0]?.username || 'The creator';
            const reasonLabel = REASON_LABELS[reason] || reason;
            const subject = isReply ? 'Your reply' : 'Your comment';
            const notifContent = isReelOwner
                ? `${subject} on ${moderatorUsername}'s Reel was removed by the Reel creator. Reason: ${reasonLabel}.`
                : `${subject} was removed by Sparkle moderation. Reason: ${reasonLabel}.`;

            await notificationController.createNotification({
                user_id: commentAuthorId,
                actor_id: moderatorId,
                actor_name: moderatorUsername,
                type: 'comment',
                title: 'Your comment was removed',
                content: notifContent,
                related_id: comment.moment_id,
                related_type: 'moment',
                action_url: `/moments/${comment.moment_id}`,
            });
        } catch (notifErr) {
            // The removal stands; a failed notification must never roll it back.
            logger.warn('Moderation notification failed: ' + (notifErr?.message || notifErr));
        }

        res.json({ success: true, deletedCount, auditId });
    } catch (error) {
        logger.error('Moderate Comment Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// REPORT COMMENT — platform reporting, strictly separate from creator
// moderation. A report NEVER deletes, hides or otherwise alters the comment;
// it only queues the report for the platform moderation team.
// ─────────────────────────────────────────────────────────────────────────────
const reportComment = async (req, res) => {
    try {
        const { id } = req.params; // comment_id
        const { reason } = req.body;
        const reporterId = req.user.user_id;
        await ensureCommentSchema();

        const trimmed = reason ? String(reason).trim() : '';
        if (!trimmed) return res.status(400).json({ error: 'A reason is required' });
        if (trimmed.length > 500) return res.status(400).json({ error: 'Reason is too long' });

        const [rows] = await pool.query(
            `SELECT c.comment_id, c.moment_id, m.*
             FROM moment_comments c
             JOIN moments m ON c.moment_id = m.moment_id
             WHERE c.comment_id = ? AND c.is_deleted = 0 AND m.deleted_at IS NULL`,
            [id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Comment not found' });

        const target = rows[0];
        // A report must not become an existence oracle for hidden reels.
        if (!(await visibility.canViewMoment(target, reporterId))) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        const reportId = require('crypto').randomUUID();
        try {
            await pool.query(
                `INSERT INTO moment_comment_reports
                 (report_id, comment_id, moment_id, reporter_id, reason)
                 VALUES (?, ?, ?, ?, ?)`,
                [reportId, id, target.moment_id, reporterId, trimmed]
            );
        } catch (err) {
            if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) {
                return res.status(400).json({ error: 'You have already reported this comment.' });
            }
            throw err;
        }

        res.status(201).json({ success: true, report_id: reportId });
    } catch (error) {
        logger.error('Report Comment Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET COMMENT — single comment fetch (for edit pre-population)
// ─────────────────────────────────────────────────────────────────────────────
const getComment = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.user_id;
        await ensureCommentSchema();

        const [rows] = await pool.query(
            `SELECT c.*, u.username, u.avatar_url, m.user_id AS reel_owner_id
             FROM moment_comments c
             JOIN users u ON c.user_id = u.user_id
             JOIN moments m ON c.moment_id = m.moment_id
             WHERE c.comment_id = ? AND c.is_deleted = 0`,
            [id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Comment not found' });

        // Only the comment author or reel owner can fetch single comment details
        const c = rows[0];
        const isAuthor = String(c.user_id) === String(userId);
        const isOwner = String(c.reel_owner_id) === String(userId);
        if (!isAuthor && !isOwner) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        res.json({ success: true, comment: c });
    } catch (error) {
        logger.error('Get Comment Error:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getMomentsStream,
    getMomentSuggestions,
    getUserMoments,
    createMoment,
    updateMomentPrivacy,
    toggleMomentPin,
    sparkMoment,
    saveMoment,
    addComment,
    getComments,
    editComment,
    deleteComment,
    moderateComment,
    reportComment,
    getComment,
    followUser,
    trackShare,
    trackView,
    getMomentViewers,
    saveSticker,
    listStickers,
    deleteSticker,
    toggleMomentPin,
    trackEngagement,
    getShareData,
    likeComment,
    getMomentById,
    getMyMoments,
    deleteMoment,
    restoreMoment,
    prewarm
};
