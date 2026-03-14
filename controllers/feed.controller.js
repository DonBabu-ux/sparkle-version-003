const Post = require('../models/Post');
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
        return 'https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=1000';
    }
    return url;
};

const renderDashboard = async (req, res) => {
    try {
        const campus = req.user.campus || 'all';
        const currentUserId = req.user.userId || req.user.user_id;
        // algorithm-aware feed: supply current user id
        const posts = await Post.getFeed(campus, currentUserId, 12);

        // Sanitize
        const sanitizedPosts = posts.map(p => ({
            ...p,
            media_url: getSafeMediaUrl(p.media_url),
            avatar_url: getSafeAvatarUrl(p.avatar_url)
        }));

        // Stories placeholder for now as stories model isn't fully built yet
        // but we can pass empty array to prevent view errors
        res.render('dashboard', {
            title: 'Dashboard',
            initialPosts: sanitizedPosts || [],
            initialStories: []
        });
    } catch (error) {
        logger.error('Dashboard Render Error:', error);
        res.render('dashboard', {
            title: 'Dashboard',
            initialPosts: [],
            initialStories: []
        });
    }
};

const getFeedPosts = async (req, res) => {
    try {
        const campus = req.user.campus || 'all';
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100); // cap
        const offset = (page - 1) * limit;

        const currentUserId = req.user.userId || req.user.user_id;
        const posts = await Post.getFeed(campus, currentUserId, limit, offset);

        const sanitizedPosts = posts.map(post => ({
            ...post,
            media_url: getSafeMediaUrl(post.media_url),
            avatar_url: getSafeAvatarUrl(post.avatar_url)
        }));

        if (req.query.render === 'true') {
            const renderedPosts = await Promise.all(sanitizedPosts.map(post => {
                return new Promise((resolve, reject) => {
                    res.render('partials/post-card', { post, user: req.user }, (err, html) => {
                        if (err) {
                            logger.error('Error rendering post-card partial:', err);
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
        logger.error('Get Feed Posts Error:', error);
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
                -- Only show is_liked to the story owner
                CASE 
                    WHEN s.user_id = ? THEN COALESCE((SELECT 1 FROM story_likes WHERE story_id = s.story_id AND user_id = ?), 0)
                    ELSE 0 
                END as is_liked
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
        rows.forEach(s => {
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
            map[s.user_id].stories.push({
                story_id: s.story_id,
                media_url: s.media_url,
                media_type: s.media_type,
                caption: s.caption,
                created_at: s.created_at,
                like_count: parseInt(s.like_count) || 0,
                is_liked: parseInt(s.is_liked) === 1 // Only true for story owner
            });
        });

        res.json(groups);
    } catch (error) {
        logger.error('Get Stories Error:', error);
        res.status(500).json({ error: 'Failed to fetch stories' });
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
        if (req.file) {
            // File upload from multipart/form-data
            media_url = req.file.path;
            console.log('📸 Story media from file upload:', media_url);
        } else if (req.body.media_url) {
            // Direct URL from JSON
            media_url = req.body.media_url;
            console.log('🔗 Story media from URL (media_url):', media_url);
        } else if (req.body.media) {
            // Alternative field name 'media' (for compatibility)
            media_url = req.body.media;
            console.log('🔗 Story media from URL (media):', media_url);
        }

        if (!media_url) {
            console.error('❌ No media provided in request:', {
                hasFile: !!req.file,
                bodyFields: Object.keys(req.body),
                file: req.file ? {
                    originalname: req.file.originalname,
                    mimetype: req.file.mimetype,
                    size: req.file.size,
                    path: req.file.path
                } : null
            });
            return res.status(400).json({ error: 'Media is required for story' });
        }

        const userId = req.user.userId || req.user.user_id;
        if (!userId) {
            console.error('❌ No user ID found in request:', req.user);
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const storyId = crypto.randomUUID();

        // Determine media type
        let media_type = 'image';
        if (req.file) {
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

        await pool.query(
            'INSERT INTO stories (story_id, user_id, media_url, media_type, caption, like_count, share_count) VALUES (?, ?, ?, ?, ?, 0, 0)',
            [storyId, userId, media_url, media_type, caption || null]
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
                    logger.error('Notification error (ignoring):', notifErr);
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

module.exports = {
    renderDashboard,
    getFeedPosts,
    getStories,
    renderPost,
    createStory,
    likeStory,
    getStoryLikes,
    shareStory,
    deleteStory
};