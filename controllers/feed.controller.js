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
                (SELECT COUNT(*) FROM story_likes WHERE story_id = s.story_id) as like_count,
                (SELECT COUNT(*) FROM story_likes WHERE story_id = s.story_id AND user_id = ?) as is_liked
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
        `, [currentUserId, currentUserId, currentUserId, currentUserId]);

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
                like_count: s.like_count || 0,
                is_liked: s.is_liked || false
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
        const media_url = req.file ? req.file.path : req.body.media_url;

        if (!media_url) {
            return res.status(400).json({ error: 'Media is required for story' });
        }

        const userId = req.user.userId || req.user.user_id;
        const storyId = crypto.randomUUID();
        const media_type = req.file && req.file.mimetype.startsWith('video') ? 'video' : 'image';

        await pool.query(
            'INSERT INTO stories (story_id, user_id, media_url, media_type, caption, like_count, share_count) VALUES (?, ?, ?, ?, ?, 0, 0)',
            [storyId, userId, media_url, media_type, caption]
        );

        res.status(201).json({ status: 'success', message: 'Story created', story_id: storyId });
    } catch (error) {
        logger.error('Create Story Error:', error);
        res.status(500).json({ error: 'Failed to create story' });
    }
};

// toggle like on a story and notify owner
const likeStory = async (req, res) => {
    try {
        const storyId = req.params.id;
        const userId = req.user.userId || req.user.user_id;

        // First check if story exists
        const [story] = await pool.query('SELECT story_id, user_id FROM stories WHERE story_id = ?', [storyId]);
        if (!story || story.length === 0) {
            return res.status(404).json({ error: 'Story not found' });
        }

        // ensure likes table exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS story_likes (
                like_id CHAR(36) NOT NULL PRIMARY KEY,
                story_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_like (story_id, user_id),
                FOREIGN KEY (story_id) REFERENCES stories(story_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Start transaction
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // check existing
            const [existingRows] = await connection.query('SELECT like_id FROM story_likes WHERE story_id = ? AND user_id = ?', [storyId, userId]);
            let liked = false;

            if (existingRows && existingRows.length > 0) {
                // unlike
                await connection.query('DELETE FROM story_likes WHERE story_id = ? AND user_id = ?', [storyId, userId]);
                await connection.query('UPDATE stories SET like_count = GREATEST(COALESCE(like_count, 0) - 1, 0) WHERE story_id = ?', [storyId]);
                liked = false;
            } else {
                // like
                const likeId = crypto.randomUUID();
                await connection.query('INSERT INTO story_likes (like_id, story_id, user_id) VALUES (?, ?, ?)', [likeId, storyId, userId]);
                await connection.query('UPDATE stories SET like_count = COALESCE(like_count, 0) + 1 WHERE story_id = ?', [storyId]);
                liked = true;

                // create notification for story owner (if not self)
                if (story[0].user_id !== userId) {
                    try {
                        const [actor] = await connection.query('SELECT name FROM users WHERE user_id = ?', [userId]);
                        const notificationId = crypto.randomUUID();
                        await connection.query(
                            `INSERT INTO notifications (notification_id, user_id, type, title, content, actor_id, action_url) 
                             VALUES (?, ?, 'story_like', 'Story Liked', ?, ?, ?)`,
                            [notificationId, story[0].user_id, `${actor[0]?.name || 'Someone'} liked your story`, userId, `/stories/${storyId}`]
                        );
                    } catch (notifErr) {
                        logger.error('Failed to create notification:', notifErr);
                        // Continue even if notification fails
                    }
                }
            }

            await connection.commit();

            // get updated like count
            const [[info]] = await pool.query('SELECT like_count FROM stories WHERE story_id = ?', [storyId]);
            res.json({ liked, like_count: info.like_count || 0 });
            
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

    } catch (error) {
        logger.error('Like Story Error:', error);
        res.status(500).json({ error: 'Failed to toggle like' });
    }
};

// get like count + whether current user liked
const getStoryLikes = async (req, res) => {
    try {
        const storyId = req.params.id;
        const userId = req.user.userId || req.user.user_id;
        const [[countRow]] = await pool.query('SELECT like_count FROM stories WHERE story_id = ?', [storyId]);
        const [[exists]] = await pool.query('SELECT 1 FROM story_likes WHERE story_id = ? AND user_id = ?', [storyId, userId]);
        res.json({ like_count: (countRow && countRow.like_count) || 0, liked: !!exists });
    } catch (error) {
        logger.error('Get story likes error:', error);
        res.status(500).json({ error: 'Failed to fetch likes' });
    }
};

// record a share on a story and notify owner
const shareStory = async (req, res) => {
    try {
        const storyId = req.params.id;
        const userId = req.user.userId || req.user.user_id;

        // First check if story exists
        const [story] = await pool.query('SELECT story_id, user_id FROM stories WHERE story_id = ?', [storyId]);
        if (!story || story.length === 0) {
            return res.status(404).json({ error: 'Story not found' });
        }

        // ensure shares table exists
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

        // Start transaction
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // record share
            const shareId = crypto.randomUUID();
            await connection.query('INSERT INTO story_shares (share_id, story_id, user_id) VALUES (?, ?, ?)', [shareId, storyId, userId]);
            await connection.query('UPDATE stories SET share_count = COALESCE(share_count, 0) + 1 WHERE story_id = ?', [storyId]);

            // create notification for story owner (if not self)
            if (story[0].user_id !== userId) {
                try {
                    const [actor] = await connection.query('SELECT name FROM users WHERE user_id = ?', [userId]);
                    const notificationId = crypto.randomUUID();
                    await connection.query(
                        `INSERT INTO notifications (notification_id, user_id, type, title, content, actor_id, action_url) 
                         VALUES (?, ?, 'story_share', 'Story Shared', ?, ?, ?)`,
                        [notificationId, story[0].user_id, `${actor[0]?.name || 'Someone'} shared your story`, userId, `/stories/${storyId}`]
                    );
                } catch (notifErr) {
                    logger.error('Failed to create notification:', notifErr);
                    // Continue even if notification fails
                }
            }

            await connection.commit();
            res.json({ success: true });

        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

    } catch (error) {
        logger.error('Share Story Error:', error);
        res.status(500).json({ error: 'Failed to record share' });
    }
};

module.exports = { renderDashboard, getFeedPosts, getStories, renderPost, createStory, likeStory, getStoryLikes, shareStory };