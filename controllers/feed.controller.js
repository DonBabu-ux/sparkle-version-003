const Post = require('../models/Post');
const User = require('../models/User');
const pool = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');
const notificationController = require('./notification.controller');

// Helper to sanitize avatars - prioritizes internal uploads
const getSafeAvatarUrl = (url) => {
    if (!url) return null;
    return url;
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
        const currentUserId = req.user.userId || req.user.user_id;
        const affiliation = req.user.affiliation || req.user.campus || 'all';
        const {
            limit = 10,
            force = false,
            mode = 'for_you',
            seed = 0,
            device_id = 'web',
        } = req.query;

        const { bandedSeededShuffle, deviceSeedFromIds, applyCreatorSpacing } = require('../utils/feedShuffle');
        const redisService = require('../services/redis.service');

        const numericSeed = Number(seed) || deviceSeedFromIds(currentUserId, device_id);
        const isForceRefresh = force === 'true' || force === true;

        const batchKey = `batch_offset:${currentUserId}:${device_id}:${mode}`;
        const seenKey = `seen:${currentUserId}:${device_id}`;
        const cacheListKey = `feed_cache:${currentUserId}:${device_id}:${mode}`;
        const lockKey = `lock:feed:${currentUserId}:${device_id}`;
        const refreshKey = `refresh_count:${currentUserId}:${device_id}`;

        // 30-second lock to prevent concurrent heavy generation (Resilience for remote DB)
        const lock = await redisService.set(lockKey, 'locked', 30, 'NX');
        if (!lock && !isForceRefresh) {
            return res.status(429).json({ error: 'Request in progress' });
        }

        if (isForceRefresh) {
            await redisService.del(batchKey);
            await redisService.del(cacheListKey);
            await redisService.incr(refreshKey); // Increment refresh counter for seed entropy
        }

        // Add refresh_count to the seed to ensure completely new permutations on every pull-to-refresh
        const refreshCount = Number(await redisService.get(refreshKey)) || 0;
        const sessionSeed = numericSeed + refreshCount;

        let seenRaw = await redisService.get(seenKey);
        let seenSet = new Set(Array.isArray(seenRaw) ? seenRaw : []);

        const pageLimit = Number(limit) || 10;
        let page = [];

        // 1. Try to pop posts directly from the precomputed Redis Cache List
        if (!isForceRefresh) {
            const cachedPostsRaw = await redisService.get(cacheListKey);
            let cachedPosts = Array.isArray(cachedPostsRaw) ? cachedPostsRaw : [];
            
            if (cachedPosts.length >= pageLimit) {
                // We have enough in the cache! Slice them, update the cache, and return immediately.
                page = cachedPosts.slice(0, pageLimit);
                const remainingCache = cachedPosts.slice(pageLimit);
                await redisService.set(cacheListKey, remainingCache, 3600); // 1 hour TTL
                
                // Update seen set
                const updatedSeen = [...seenSet, ...page.map(p => p.post_id)];
                await redisService.set(seenKey, updatedSeen, 86400);

                await redisService.del(lockKey);
                return res.json({
                    posts: page,
                    feed: page,
                    seed: sessionSeed,
                    hasMore: true
                });
            } else if (cachedPosts.length > 0) {
                // Take whatever is left, we will fetch more to fill the gap if needed
                page = [...cachedPosts];
                await redisService.del(cacheListKey);
            }
        }

        // 2. If Cache is empty (or we need more), Hit the Database
        const cachedOffset = await redisService.get(batchKey);
        let batchOffset = Number(cachedOffset) || 0;
        
        const fetchLimit = 150; // Massive pool fetch since we only do this rarely now
        let fresh = [];
        let postsFetched = 0;

        const excludeIds = Array.from(seenSet).slice(-500); // Only exclude recent seen to keep query fast
        for (let attempt = 0; attempt < 3; attempt++) {
            const posts = await Post.getFeed(affiliation, currentUserId, fetchLimit, batchOffset, sessionSeed, excludeIds, mode, null);
            postsFetched = posts ? posts.length : 0;

            const chunkSeed = sessionSeed + batchOffset;
            const shuffled = bandedSeededShuffle(posts || [], chunkSeed);

            const batchFresh = shuffled.filter(p => !seenSet.has(p.post_id));
            
            // Apply Creator Spacing to the batch to prevent same-user clusters
            const spacedFresh = applyCreatorSpacing(batchFresh, 2); // Gap of 2 for Home Feed stability
            fresh = [...fresh, ...spacedFresh];

            batchOffset += fetchLimit;
            await redisService.set(batchKey, batchOffset, 86400);

            if (fresh.length >= pageLimit * 3) {
                break; // Stop fetching if we found plenty to cache
            }
            if (postsFetched < fetchLimit) {
                break; // Hit end of database
            }
        }

        // --- Exhaustion Cycle: Soft Reset (Smart Memory Management) ---
        if (fresh.length === 0 && postsFetched < fetchLimit) {
            console.log(`♻️ Feed Exhaustion for user ${currentUserId}. Performing selective reset.`);
            
            // Instead of clearing everything, just clear the batch offset to try a new discovery slice
            await redisService.del(batchKey);
            batchOffset = 0;

            // Fetch a larger candidate pool to find things the user might have missed
            const posts = await Post.getFeed(affiliation, currentUserId, 150, 0, numericSeed, Array.from(seenSet), mode, null);
            const shuffled = bandedSeededShuffle(posts || [], numericSeed);
            
            // Filter by what is NOT in the current session batch
            fresh = shuffled.filter(p => !seenSet.has(p.post_id));
            
            // If still empty, then and only then, perform a full clear
            if (fresh.length === 0) {
                await redisService.del(seenKey);
                seenSet.clear();
                fresh = shuffled.slice(0, pageLimit);
            }
        }

        // 3. Fulfill the page, and stash the REST in Redis for the next scroll
        const allAvailable = [...page, ...fresh];
        const finalPage = allAvailable.slice(0, pageLimit);
        const cacheForLater = allAvailable.slice(pageLimit);

        if (cacheForLater.length > 0) {
            await redisService.set(cacheListKey, cacheForLater, 3600); // Store for 1 hour
        }

        if (finalPage.length > 0) {
            const updatedSeen = [...seenSet, ...finalPage.map(p => p.post_id)];
            await redisService.set(seenKey, updatedSeen, 86400);
        }

        // Sanitize
        const sanitizedPosts = finalPage.map(post => ({
            ...post,
            media_url:  getSafeMediaUrl(post.media_url),
            avatar_url: getSafeAvatarUrl(post.avatar_url),
            timestamp:  post.created_at,
            _id:        post.post_id,
        }));

        await redisService.del(lockKey);

        res.json({
            posts: sanitizedPosts,
            feed: sanitizedPosts,
            seed: numericSeed,
            hasMore: sanitizedPosts.length > 0
        });
    } catch (error) {
        logger.error('Feed Retrieval Error:', error);
        res.status(500).json({ error: 'Failed to fetch feed' });
    }
};

const getNewPosts = async (req, res) => {
    try {
        let since = req.query.since;
        if (!since) return res.status(400).json({ error: 'since parameter required' });

        const affiliation = req.user.affiliation || req.user.campus || 'all';
        const currentUserId = req.user.userId || req.user.user_id;

        // Check if 'since' is a UUID (POST_ID) or a timestamp
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(since);
        
        if (isUuid) {
            const [post] = await pool.query('SELECT created_at FROM posts WHERE post_id = ?', [since]);
            if (post.length > 0) {
                since = post[0].created_at;
            } else {
                // If post not found, assume it's old and just return empty
                return res.json({ posts: [] });
            }
        }

        const posts = await Post.getDeltaPosts(affiliation, currentUserId, since);

        const sanitizedPosts = (posts || []).map(post => ({
            ...post,
            media_url: getSafeMediaUrl(post.media_url),
            avatar_url: getSafeAvatarUrl(post.avatar_url),
            timestamp: post.created_at,
            _id: post.post_id, // For frontend compatibility
            is_new_delta: true
        }));

        res.json({ posts: sanitizedPosts });
    } catch (error) {
        logger.error('Get Delta Feed Error:', error);
        res.status(500).json({ error: 'Failed to fetch delta feed' });
    }
};

const getStories = async (req, res) => {
    try {
        const currentUserId = req.user.userId || req.user.user_id;

        // --- BATCH 3: Stories Caching (60 sec TTL) ---
        const redisService = require('../services/redis.service');
        const cacheKey = `stories:active:${currentUserId}`;
        
        const cached = await redisService.get(cacheKey);
        if (cached) return res.json(cached);

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
            AND s.is_archived = 0
            AND s.user_id NOT IN (
                SELECT user_id FROM story_privacy_blocks WHERE blocked_user_id = ?
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

        if (!media_url && req.body.type !== 'text' && !req.body.text_content) {
            console.error('❌ No media provided in request:', {
                hasFiles: !!req.files,
                bodyFields: Object.keys(req.body),
                typeValue: req.body.type
            });
            return res.status(400).json({ error: 'Media is required for story' });
        }

        // For text-only stories, we use a placeholder or special value if the DB requires NOT NULL
        if ((req.body.type === 'text' || req.body.text_content) && !media_url) {
            media_url = 'text';
            req.body.type = 'text'; // Force type to text for consistency
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

        // Map text content and config to DB columns
        const finalCaption = caption || req.body.text_content || null;
        const finalCollageData = req.body.collage_data || req.body.text_config || null;

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const background = req.body.background || null;
        const parent_story_id = req.body.parent_story_id || null;
        const stickers = req.body.stickers || null;
        const type = req.body.type || 'media';
        const collage_data_val = finalCollageData;
        
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
                storyId, userId, media_url, media_type, finalCaption, 
                background, audio_url, audio_source, audio_start, audio_duration, 
                expiresAt, parent_story_id, stickers,
                music_info, type, collage_data_val
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
                    await notificationController.createNotification({
                        user_id: storyData.user_id,
                        type: 'story_like',
                        title: 'Story Liked',
                        content: `${actor[0]?.name || 'Someone'} liked your story`,
                        actor_id: userId,
                        actor_name: actor[0]?.name,
                        action_url: `/stories/${storyId}`
                    }, connection);
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

        const viewId = crypto.randomUUID();
        await pool.query(
            'INSERT IGNORE INTO story_views (view_id, story_id, user_id) VALUES (?, ?, ?)',
            [viewId, storyId, userId]
        );

        await pool.query(
            'UPDATE stories SET view_count = (SELECT COUNT(*) FROM story_views WHERE story_id = ?) WHERE story_id = ?',
            [storyId, storyId]
        );

        res.json({ success: true });
    } catch (error) {
        logger.error('View Story Error:', error);
        res.status(500).json({ error: 'Failed to record view' });
    }
};

const addStoryComment = async (req, res) => {
    try {
        const storyId = req.params.id;
        const userId = req.user.userId || req.user.user_id;
        const { text } = req.body;

        if (!text) return res.status(400).json({ error: 'Comment text is required' });

        const commentId = crypto.randomUUID();
        await pool.query(
            'INSERT INTO story_comments (comment_id, story_id, user_id, text) VALUES (?, ?, ?, ?)',
            [commentId, storyId, userId, text]
        );

        res.json({ success: true, comment_id: commentId });
    } catch (error) {
        logger.error('Add Story Comment Error:', error);
        res.status(500).json({ error: 'Failed to post comment' });
    }
};

const getStoryComments = async (req, res) => {
    try {
        const storyId = req.params.id;
        const [comments] = await pool.query(`
            SELECT sc.*, u.username, u.avatar_url 
            FROM story_comments sc
            JOIN users u ON sc.user_id = u.user_id
            WHERE sc.story_id = ?
            ORDER BY sc.created_at DESC
        `, [storyId]);
        res.json(comments);
    } catch (error) {
        logger.error('Get Story Comments Error:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
};

const updateStorySettings = async (req, res) => {
    try {
        const storyId = req.params.id;
        const userId = req.user.userId || req.user.user_id;
        const settings = req.body;

        const allowedSettings = [
            'reply_privacy', 'comment_privacy', 'allow_sharing', 
            'allow_message_sharing', 'auto_share_fb', 'auto_share_wa', 
            'save_to_gallery', 'save_to_archive'
        ];

        const updates = [];
        const values = [];

        Object.keys(settings).forEach(key => {
            if (allowedSettings.includes(key)) {
                updates.push(`${key} = ?`);
                values.push(settings[key]);
            }
        });

        if (updates.length === 0) return res.status(400).json({ error: 'No valid settings provided' });

        values.push(storyId, userId);
        await pool.query(`UPDATE stories SET ${updates.join(', ')} WHERE story_id = ? AND user_id = ?`, values);

        res.json({ success: true });
    } catch (error) {
        logger.error('Update Story Settings Error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
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

const archiveStory = async (req, res) => {
    try {
        const storyId = req.params.id;
        const userId = req.user.userId || req.user.user_id;

        const [result] = await pool.query(
            'UPDATE stories SET is_archived = 1 WHERE story_id = ? AND user_id = ?',
            [storyId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(403).json({ error: 'Unauthorized or story not found' });
        }

        res.json({ success: true, message: 'Story archived' });
    } catch (error) {
        logger.error('Archive Story Error:', error);
        res.status(500).json({ error: 'Failed to archive story' });
    }
};

const toggleStoryComments = async (req, res) => {
    try {
        const storyId = req.params.id;
        const userId = req.user.userId || req.user.user_id;

        const [stories] = await pool.query('SELECT comments_enabled FROM stories WHERE story_id = ? AND user_id = ?', [storyId, userId]);
        if (stories.length === 0) return res.status(404).json({ error: 'Story not found' });

        const newStatus = stories[0].comments_enabled ? 0 : 1;
        await pool.query('UPDATE stories SET comments_enabled = ? WHERE story_id = ?', [newStatus, storyId]);

        res.json({ success: true, comments_enabled: newStatus });
    } catch (error) {
        logger.error('Toggle Comments Error:', error);
        res.status(500).json({ error: 'Failed to toggle comments' });
    }
};

const hideStoryFromUser = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const blockedUserId = req.body.blockedUserId;

        if (!blockedUserId) return res.status(400).json({ error: 'Blocked User ID is required' });

        const blockId = crypto.randomUUID();
        await pool.query(
            'INSERT IGNORE INTO story_privacy_blocks (block_id, user_id, blocked_user_id) VALUES (?, ?, ?)',
            [blockId, userId, blockedUserId]
        );

        res.json({ success: true, message: 'Story hidden from user' });
    } catch (error) {
        logger.error('Hide Story Error:', error);
        res.status(500).json({ error: 'Failed to hide story' });
    }
};

module.exports = {
    renderDashboard,
    getFeedPosts,
    getNewPosts,
    getStories,
    renderPost,
    createStory,
    likeStory,
    getStoryLikes,
    getStoryArchive,
    shareStory,
    deleteStory,
    viewStory,
    getStoryViewers,
    archiveStory,
    toggleStoryComments,
    hideStoryFromUser,
    addStoryComment,
    getStoryComments,
    updateStorySettings
};