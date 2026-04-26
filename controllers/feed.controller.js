const Post = require('../models/Post');
const User = require('../models/User');
const pool = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');

// Helper to sanitize avatars - prioritizes internal uploads
const getSafeAvatarUrl = (url) => {
    if (url && url.startsWith('/uploads/')) return url;
    return '/uploads/avatars/default.png';
};

// Helper for post media - prioritizes internal uploads, fallbacks for broken external
const getSafeMediaUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('/uploads/')) return url;
    if (url.includes('fbcdn.net') || url.includes('fbsbx.com')) {
        return '/uploads/defaults/no-image.png';
    }
    return url;
};

// Generates a seed based on User-Agent to provide device-level consistent randomness
const getSeedFromDevice = (req) => {
    const ua = req.headers['user-agent'] || 'sparkle-default';
    let hash = 0;
    for (let i = 0; i < ua.length; i++) {
        hash = ((hash << 5) - hash) + ua.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
};

const renderDashboard = async (req, res) => {
    try {
        const affiliation = req.user.affiliation || req.user.campus || 'all';
        const currentUserId = req.user.userId || req.user.user_id;
        const randomSeed = getSeedFromDevice(req);

        // Fetch all required dashboard data in parallel with fallbacks
        const [posts, suggestions, stories] = await Promise.all([
            Post.getFeed(affiliation, currentUserId, 12, 0, randomSeed).catch(err => {
                logger.error('Dashboard Feed Fetch Error:', err);
                return [];
            }),
            User.getSuggestions(currentUserId, 5, randomSeed).catch(err => {
                logger.error('Dashboard Suggestions Fetch Error:', err);
                return [];
            }),
            // Fallback for stories until model is ready
            Promise.resolve([]).catch(() => [])
        ]);

        // Sanitize posts
        const sanitizedPosts = (posts || []).map(p => ({
            ...p,
            media_url: getSafeMediaUrl(p.media_url),
            avatar_url: getSafeAvatarUrl(p.avatar_url)
        }));

        // Sanitize suggestions
        const sanitizedSuggestions = (suggestions || []).filter(Boolean).map(s => ({
            ...s,
            avatar_url: getSafeAvatarUrl(s.avatar_url)
        }));

        res.render('dashboard', {
            title: 'Dashboard',
            feed: sanitizedPosts,
            suggestions: sanitizedSuggestions,
            stories: stories || [],
            user: req.user
        });
    } catch (error) {
        logger.error('Critical Dashboard Render Error:', error);
        res.render('dashboard', {
            title: 'Dashboard',
            feed: [],
            suggestions: [],
            stories: [],
            user: req.user
        });
    }
};

const getFeedPosts = async (req, res) => {
    try {
        const affiliation = req.query.affiliation || (req.user ? req.user.campus : 'all');
        const currentUserId = req.user.userId || req.user.user_id;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;
        const seed = req.query.seed || getSeedFromDevice(req);
        
        // --- NEW: Feed Caching (Upstash Redis) ---
        const redisService = require('../services/redis.service');
        const cacheKey = `feed:${currentUserId}:${affiliation}:${page}:${limit}:${seed}`;
        
        if (page === 1) { // Only cache first page for better reactivity
            const cachedData = await redisService.get(cacheKey);
            if (cachedData) {
                logger.info(`Feed Cache Hit: ${cacheKey}`);
                return res.json(cachedData);
            }
        }

        const recentlySeen = req.query.recentlySeen || '';
        const excludeIds = typeof recentlySeen === 'string' && recentlySeen ? recentlySeen.split(',') : [];

        // Fetch using the enhanced weighted algorithm
        const posts = await Post.getFeed(affiliation, currentUserId, limit, offset, seed, excludeIds);

        // Sanitize and format for response
        const sanitizedPosts = (posts || []).map(post => ({
            ...post,
            media_url: getSafeMediaUrl(post.media_url),
            avatar_url: getSafeAvatarUrl(post.avatar_url),
            timestamp: post.created_at, // for consistency
            is_discovery: !post.is_followed && post.user_id !== currentUserId
        }));

        // Store in cache for 2 minutes
        if (page === 1 && sanitizedPosts.length > 0) {
            await redisService.set(cacheKey, sanitizedPosts, 120);
        }

        if (req.query.render === 'true') {
            const renderedPosts = await Promise.all(sanitizedPosts.map(post => {
                return new Promise((resolve) => {
                    res.render('partials/post-card', { post, user: req.user }, (err, html) => {
                        if (err) {
                            logger.error('Error rendering post-card:', err);
                            resolve(`<div class="error">Error rendering post</div>`);
                        } else {
                            resolve(html);
                        }
                    });
                });
            }));
            return res.json({ posts: sanitizedPosts, htmls: renderedPosts });
        }

        res.json(sanitizedPosts);
    } catch (error) {
        logger.error('Get Enhanced Feed Error:', error);
        res.status(500).json({ error: 'Failed to fetch feed' });
    }
};

const getStories = async (req, res) => {
    try {
        const currentUserId = req.user.userId || req.user.user_id;

        const [rows] = await pool.query(`
            SELECT 
                s.*,
                u.username,
                u.name as user_name,
                u.avatar_url,
                u.campus,
                TIMESTAMPDIFF(SECOND, NOW(), s.created_at + INTERVAL 24 HOUR) as seconds_left,
                (SELECT COUNT(*) FROM stories WHERE user_id = s.user_id AND created_at > NOW() - INTERVAL 24 HOUR) as user_story_count,
                COALESCE((SELECT COUNT(*) FROM story_likes WHERE story_id = s.story_id), 0) as like_count,
                -- Show is_liked to all users
                COALESCE((SELECT 1 FROM story_likes WHERE story_id = s.story_id AND user_id = ?), 0) as is_liked
            FROM stories s
            JOIN users u ON s.user_id = u.user_id
            WHERE s.created_at > NOW() - INTERVAL 24 HOUR
            AND (
                s.user_id = ?
                OR s.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)
                OR s.user_id IN (SELECT follower_id FROM follows WHERE following_id = ?)
                OR u.joined_at > DATE_SUB(NOW(), INTERVAL 1 DAY)
            )
            ORDER BY s.created_at DESC
            LIMIT 200
        `, [currentUserId, currentUserId, currentUserId, currentUserId, currentUserId]);

        // group by user
        const groups = [];
        const map = {};
        
        // 1. Get all story IDs to fetch stickers for them
        const storyIds = rows.map(s => s.story_id);
        let stickersMap = {};
        
        if (storyIds.length > 0) {
            const [stickers] = await pool.query(
                'SELECT * FROM story_stickers WHERE story_id IN (?)',
                [storyIds]
            );
            
            stickers.forEach(st => {
                if (!stickersMap[st.story_id]) stickersMap[st.story_id] = [];
                stickersMap[st.story_id].push({
                    id: st.sticker_id,
                    type: st.type,
                    config: typeof st.config === 'string' ? JSON.parse(st.config) : st.config,
                    x: st.position_x,
                    y: st.position_y,
                    scale: st.scale,
                    rotation: st.rotation
                });
            });
        }

        for (const s of rows) {
            if (!map[s.user_id]) {
                map[s.user_id] = {
                    user_id: s.user_id,
                    username: s.username,
                    user_name: s.user_name,
                    avatar_url: s.avatar_url,
                    campus: s.campus,
                    stories: []
                };
                groups.push(map[s.user_id]);
            }

            // Fetch participants for this chain if it's an Add Yours sticker
            let participant_avatars = [];
            let total_participants = 0;
            const stickerList = typeof s.stickers === 'string' ? s.stickers : JSON.stringify(s.stickers || []);
            
            if (s.parent_story_id || stickerList.includes('add_yours')) {
                try {
                    const [responses] = await pool.query(
                        `SELECT u.avatar_url FROM stories s2 
                         JOIN users u ON s2.user_id = u.user_id 
                         WHERE s2.parent_story_id = ? OR s2.story_id = ?
                         ORDER BY s2.created_at DESC LIMIT 3`,
                        [s.story_id, s.story_id]
                    );
                    participant_avatars = responses.map(r => getSafeMediaUrl(r.avatar_url));
                    
                    const [[countRow]] = await pool.query(
                        'SELECT COUNT(*) as count FROM stories WHERE parent_story_id = ?',
                        [s.story_id]
                    );
                    total_participants = countRow.count;
                } catch (e) {
                    console.error('Chain fetch error:', e);
                }
            }

            map[s.user_id].stories.push({
                story_id: s.story_id,
                parent_story_id: s.parent_story_id,
                media_url: getSafeMediaUrl(s.media_url),
                media_type: s.media_type,
                type: s.type || 'media',
                collage_data: typeof s.collage_data === 'string' ? JSON.parse(s.collage_data) : s.collage_data,
                caption: s.caption,
                background: s.background,
                audio_url: getSafeMediaUrl(s.audio_url),
                music_info: typeof s.music_info === 'string' ? JSON.parse(s.music_info) : s.music_info,
                audio_source: s.audio_source,
                audio_start: s.audio_start,
                audio_duration: s.audio_duration,
                created_at: s.created_at,
                like_count: parseInt(s.like_count) || 0,
                is_liked: parseInt(s.is_liked) === 1,
                stickers: (typeof s.stickers === 'string' ? JSON.parse(s.stickers) : (s.stickers || [])).map(st => {
                    if (st.type === 'add_yours') {
                        return { 
                            ...st, 
                            config: { 
                                ...st.config, 
                                avatars: participant_avatars.length > 0 ? participant_avatars : (st.config?.avatars || []),
                                responses_count: total_participants || (st.config?.responses_count || 0)
                            } 
                        };
                    }
                    return st;
                })
            });
        }

        res.json(groups);
    } catch (error) {
        console.error('[Feed Controller] getStories error:', error.message, error.stack);
        res.status(500).json({ 
            error: 'Failed to fetch stories',
            debug: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const renderPost = async (req, res) => {
    try {
        const { id } = req.params;
        const post = await Post.findById(id);

        if (!post) {
            return res.status(404).render('404', { title: 'Post Not Found' });
        }

        const sanitizedPost = {
            ...post,
            media_url: getSafeMediaUrl(post.media_url),
            avatar_url: getSafeAvatarUrl(post.avatar_url),
            title: post.title || (post.content ? post.content.split('\n')[0].substring(0, 50) : 'Sparkle Highlight')
        };

        const comments = await Post.getComments(id);
        const sanitizedComments = comments.map(c => ({
            ...c,
            avatar_url: getSafeAvatarUrl(c.avatar_url)
        }));

        res.render('post', {
            title: `Post by ${sanitizedPost.user_name}`,
            post: sanitizedPost,
            comments: sanitizedComments,
            user: req.user
        });
    } catch (error) {
        logger.error('Render Post Error:', error);
        res.status(500).render('error', { title: 'Error', error: 'Failed to load post' });
    }
};

const createStory = async (req, res) => {
    try {
        const { caption } = req.body;

        // Handle both file upload and direct URL with multiple field name support
        let media_url;
        if (req.files && req.files.media) {
            // File upload from multipart/form-data
            media_url = req.files.media[0].path;
            console.log('📸 Story media from file upload:', media_url);
        } else if (req.file) {
            // Fallback for single file upload
            media_url = req.file.path;
        } else if (req.body.media_url) {
            // Direct URL from JSON
            media_url = req.body.media_url;
            console.log('🔗 Story media from URL (media_url):', media_url);
        } else if (req.body.media) {
            // Alternative field name 'media' (for compatibility)
            media_url = req.body.media;
            console.log('🔗 Story media from URL (media):', media_url);
        }

        if (!media_url && req.body.type !== 'text') {
            console.error('❌ No media provided in request:', {
                hasFiles: !!req.files,
                bodyFields: Object.keys(req.body)
            });
            return res.status(400).json({ error: 'Media is required for story' });
        }

        // For text-only stories, we use a placeholder or special value if the DB requires NOT NULL
        if (req.body.type === 'text' && !media_url) {
            media_url = 'text';
        }

        const userId = req.user.userId || req.user.user_id;
        if (!userId) {
            console.error('❌ No user ID found in request:', req.user);
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const storyId = crypto.randomUUID();

        // Determine media type
        let media_type = 'image';
        if (req.body.type === 'text') {
            media_type = 'text';
        } else if (req.files && req.files.media) {
            media_type = req.files.media[0].mimetype.startsWith('video') ? 'video' : 'image';
        } else if (req.file) {
            media_type = req.file.mimetype.startsWith('video') ? 'video' : 'image';
        } else if (media_url) {
            // Try to determine from URL extension
            const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.mpg', '.mpeg'];
            media_type = videoExtensions.some(ext => media_url.toLowerCase().includes(ext)) ? 'video' : 'image';
        }

        console.log('📝 Creating story with:', {
            storyId,
            userId,
            media_url,
            media_type,
            caption: caption || 'no caption'
        });

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const background = req.body.background || null;
        const parent_story_id = req.body.parent_story_id || null;
        const stickers = req.body.stickers || null;
        const type = req.body.type || 'media';
        const collage_data = req.body.collage_data || null;
        
        let audio_url = req.body.audio_url || null;
        const music_info = req.body.music_info || null;
        const audio_source = req.body.audio_source || null;
        const audio_start = parseFloat(req.body.audio_start) || 0.0;
        const audio_duration = parseFloat(req.body.audio_duration) || 15.0;

        // If a file was uploaded for audio
        if (req.files && req.files.audio) {
            audio_url = req.files.audio[0].path;
        }

        await pool.query(
            `INSERT INTO stories (
                story_id, user_id, media_url, media_type, caption, 
                background, audio_url, audio_source, audio_start, audio_duration,
                like_count, share_count, expires_at, parent_story_id, stickers,
                music_info, type, collage_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?)`,
            [
                storyId, userId, media_url, media_type, caption || null, 
                background, audio_url, audio_source, audio_start, audio_duration, 
                expiresAt, parent_story_id, stickers,
                music_info, type, collage_data
            ]
        );

        console.log('✅ Story created successfully:', storyId);
        res.status(201).json({
            status: 'success',
            message: 'Story created',
            story_id: storyId
        });

    } catch (error) {
        console.error('❌ Create Story Error:', error);
        logger.error('Create Story Error:', error);
        res.status(500).json({ error: 'Failed to create story', details: error.message });
    }
};

// toggle like on a story and notify owner
const likeStory = async (req, res) => {
    let connection;
    try {
        const storyId = req.params.id;
        const userId = req.user.userId || req.user.user_id;

        console.log(`📝 Like story request - Story: ${storyId}, User: ${userId}`);

        if (!storyId || !userId) {
            return res.status(400).json({ error: 'Missing storyId or userId' });
        }

        // Get connection for transaction
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Check if story exists and LOCK it to prevent deadlocks during concurrent likes
        const [storiesFound] = await connection.query(
            'SELECT story_id, user_id FROM stories WHERE story_id = ? FOR UPDATE',
            [storyId]
        );

        if (!storiesFound || storiesFound.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Story not found' });
        }

        // Check if already liked
        const [existingRows] = await connection.query(
            'SELECT like_id FROM story_likes WHERE story_id = ? AND user_id = ? FOR UPDATE',
            [storyId, userId]
        );

        let liked = false;
        if (existingRows && existingRows.length > 0) {
            // Unlike
            await connection.query('DELETE FROM story_likes WHERE story_id = ? AND user_id = ?', [storyId, userId]);
            await connection.query(
                'UPDATE stories SET like_count = GREATEST(COALESCE(like_count, 0) - 1, 0) WHERE story_id = ?',
                [storyId]
            );
            liked = false;
            console.log('👎 Story unliked');
        } else {
            // Like
            const likeId = crypto.randomUUID();
            await connection.query(
                'INSERT INTO story_likes (like_id, story_id, user_id) VALUES (?, ?, ?)',
                [likeId, storyId, userId]
            );
            await connection.query(
                'UPDATE stories SET like_count = COALESCE(like_count, 0) + 1 WHERE story_id = ?',
                [storyId]
            );
            liked = true;
            console.log('👍 Story liked');

            // Create notification for story owner (if not self)
            const storyData = storiesFound[0];
            if (storyData.user_id !== userId) {
                try {
                    const [actor] = await connection.query('SELECT name FROM users WHERE user_id = ?', [userId]);
                    const notificationId = crypto.randomUUID();
                    await connection.query(
                        `INSERT INTO notifications (notification_id, user_id, type, title, content, actor_id, action_url)
                         VALUES (?, ?, 'story_like', 'Story Liked', ?, ?, ?)`,
                        [
                            notificationId,
                            storyData.user_id,
                            `${actor[0]?.name || 'Someone'} liked your story`,
                            userId,
                            `/stories/${storyId}`
                        ]
                    );
                } catch (notifErr) {
                    logger.error('Notification error (ignoring):', notifErr);
                }
            }
        }

        await connection.commit();
        res.json({ success: true, liked, action: liked ? 'liked' : 'unliked' });

    } catch (error) {
        if (connection) await connection.rollback();
        logger.error('Like story error:', error);
        res.status(500).json({ error: 'Failed to toggle like', details: error.message });
    } finally {
        if (connection) connection.release();
    }
};

// get all expired stories for the current user (archive)
const getStoryArchive = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        
        // Find stories older than 24 hours
        const [rows] = await pool.query(`
            SELECT * FROM stories 
            WHERE user_id = ? 
            AND created_at < NOW() - INTERVAL 24 HOUR
            ORDER BY created_at DESC
        `, [userId]);

        const sanitizedStories = rows.map(s => ({
            id: s.story_id,
            media_url: s.media_url,
            media_type: s.media_type,
            created_at: s.created_at
        }));

        res.json({ success: true, stories: sanitizedStories });
    } catch (error) {
        logger.error('Get Story Archive Error:', error);
        res.status(500).json({ error: 'Failed to fetch archive' });
    }
};

const deleteStory = async (req, res) => {
    try {
        const storyId = req.params.id;
        const userId = req.user.userId || req.user.user_id;

        if (!storyId) return res.status(400).json({ error: 'Missing story ID' });

        const [result] = await pool.query(
            'DELETE FROM stories WHERE story_id = ? AND user_id = ?',
            [storyId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Story not found or unauthorized' });
        }

        res.json({ success: true, message: 'Story deleted successfully' });
    } catch (error) {
        logger.error('Delete story error:', error);
        res.status(500).json({ error: 'Failed to delete story' });
    }
};

// get like count + whether current user liked
const getStoryLikes = async (req, res) => {
    try {
        const storyId = req.params.id;
        const userId = req.user.userId || req.user.user_id;

        const [[countRow]] = await pool.query('SELECT like_count FROM stories WHERE story_id = ?', [storyId]);
        const [[exists]] = await pool.query('SELECT 1 FROM story_likes WHERE story_id = ? AND user_id = ?', [storyId, userId]);

        res.json({
            like_count: (countRow && countRow.like_count) || 0,
            liked: !!exists
        });
    } catch (error) {
        logger.error('Get story likes error:', error);
        res.status(500).json({ error: 'Failed to fetch likes' });
    }
};

// record a share on a story and notify owner
const shareStory = async (req, res) => {
    let connection;
    try {
        const storyId = req.params.id;
        const userId = req.user.userId || req.user.user_id;

        console.log(`📝 Share story request - Story: ${storyId}, User: ${userId}`);

        // Validate inputs
        if (!storyId || !userId) {
            return res.status(400).json({ error: 'Missing storyId or userId' });
        }

        // First check if story exists
        const [story] = await pool.query('SELECT story_id, user_id FROM stories WHERE story_id = ?', [storyId]);
        if (!story || story.length === 0) {
            console.log('❌ Story not found:', storyId);
            return res.status(404).json({ error: 'Story not found' });
        }

        // Ensure shares table exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS story_shares (
                share_id CHAR(36) NOT NULL PRIMARY KEY,
                story_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (story_id) REFERENCES stories(story_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Get connection for transaction
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Record share
        const shareId = crypto.randomUUID();
        await connection.query(
            'INSERT INTO story_shares (share_id, story_id, user_id) VALUES (?, ?, ?)',
            [shareId, storyId, userId]
        );

        await connection.query(
            'UPDATE stories SET share_count = COALESCE(share_count, 0) + 1 WHERE story_id = ?',
            [storyId]
        );

        console.log('📤 Story share recorded');

        // Create notification for story owner (if not self)
        if (story[0].user_id !== userId) {
            try {
                const [actor] = await connection.query(
                    'SELECT name FROM users WHERE user_id = ?',
                    [userId]
                );
                const notificationId = crypto.randomUUID();
                await connection.query(
                    `INSERT INTO notifications (notification_id, user_id, type, title, content, actor_id, action_url) 
                     VALUES (?, ?, 'story_share', 'Story Shared', ?, ?, ?)`,
                    [
                        notificationId,
                        story[0].user_id,
                        `${actor[0]?.name || 'Someone'} shared your story`,
                        userId,
                        `/stories/${storyId}`
                    ]
                );
                console.log('📨 Notification created for story share');
            } catch (notifErr) {
                logger.error('Failed to create notification:', notifErr);
                // Continue even if notification fails
            }
        }

        await connection.commit();

        // Get updated share count
        const [[info]] = await pool.query('SELECT share_count FROM stories WHERE story_id = ?', [storyId]);
        const shareCount = info?.share_count || 0;

        console.log(`✅ Story shared successfully, total shares: ${shareCount}`);
        res.json({ success: true, share_count: shareCount });

    } catch (error) {
        if (connection) await connection.rollback();
        logger.error('Share Story Error:', error);
        console.error('❌ Share story error details:', error.message);
        res.status(500).json({ error: 'Failed to record share', details: error.message });
    } finally {
        if (connection) connection.release();
    }
};

const viewStory = async (req, res) => {
    try {
        const storyId = req.params.id;
        const userId = req.user.userId || req.user.user_id;

        // Ensure views table exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS story_views (
                view_id CHAR(36) PRIMARY KEY,
                story_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_view (story_id, user_id),
                FOREIGN KEY (story_id) REFERENCES stories(story_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        const viewId = crypto.randomUUID();
        await pool.query(
            'INSERT IGNORE INTO story_views (view_id, story_id, user_id) VALUES (?, ?, ?)',
            [viewId, storyId, userId]
        );

        // Update view count in stories table
        await pool.query(
            'UPDATE stories SET views_count = (SELECT COUNT(*) FROM story_views WHERE story_id = ?) WHERE story_id = ?',
            [storyId, storyId]
        );

        res.json({ success: true });
    } catch (error) {
        logger.error('View Story Error:', error);
        res.status(500).json({ error: 'Failed to record view' });
    }
};

const getStoryViewers = async (req, res) => {
    try {
        const storyId = req.params.id;
        const currentUserId = req.user.userId || req.user.user_id;

        const [viewers] = await pool.query(`
            SELECT u.user_id, u.username, u.name, u.avatar_url, 'view' as type, sv.created_at
            FROM story_views sv
            JOIN users u ON sv.user_id = u.user_id
            WHERE sv.story_id = ?
            UNION
            SELECT u.user_id, u.username, u.name, u.avatar_url, 'like' as type, sl.created_at
            FROM story_likes sl
            JOIN users u ON sl.user_id = u.user_id
            WHERE sl.story_id = ?
            UNION
            SELECT u.user_id, u.username, u.name, u.avatar_url, 'share' as type, ss.created_at
            FROM story_shares ss
            JOIN users u ON ss.user_id = u.user_id
            WHERE ss.story_id = ?
            ORDER BY created_at DESC
        `, [storyId, storyId, storyId]);

        res.json(viewers);
    } catch (error) {
        logger.error('Get Viewers Error:', error);
        res.status(500).json({ error: 'Failed to fetch viewers' });
    }
};

module.exports = {
    renderDashboard,
    getFeedPosts,
    getStories,
    renderPost,
    createStory,
    likeStory,
    getStoryLikes,
    getStoryArchive,
    shareStory,
    deleteStory,
    viewStory,
    getStoryViewers
};