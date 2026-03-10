const Post = require('../models/Post');
const pool = require('../config/database');
const logger = require('../utils/logger');

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
                (SELECT COUNT(*) FROM stories WHERE user_id = s.user_id AND created_at > NOW() - INTERVAL 24 HOUR) as user_story_count
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
        `, [currentUserId, currentUserId, currentUserId]);

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
            map[s.user_id].stories.push(s);
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
        const storyId = require('crypto').randomUUID();
        const media_type = req.file && req.file.mimetype.startsWith('video') ? 'video' : 'image';

        await pool.query(
            'INSERT INTO stories (story_id, user_id, media_url, media_type, caption) VALUES (?, ?, ?, ?, ?)',
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

        // ensure likes table exists (in case script wasn't run)
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

        // check existing
        const [[existing]] = await pool.query('SELECT like_id FROM story_likes WHERE story_id = ? AND user_id = ?', [storyId, userId]);
        let liked = false;
        if (existing) {
            // unlike
            await pool.query('DELETE FROM story_likes WHERE like_id = ?', [existing.like_id]);
            await pool.query('UPDATE stories SET like_count = IF(like_count > 0, like_count - 1, 0) WHERE story_id = ?', [storyId]);
            liked = false;
        } else {
            const likeId = require('crypto').randomUUID();
            await pool.query('INSERT INTO story_likes (like_id, story_id, user_id) VALUES (?, ?, ?)', [likeId, storyId, userId]);
            await pool.query('UPDATE stories SET like_count = IFNULL(like_count,0) + 1 WHERE story_id = ?', [storyId]);
            liked = true;

            // create notification for story owner
            await pool.query(`
                INSERT INTO notifications (notification_id, user_id, type, title, content, actor_id, action_url)
                SELECT UUID(), s.user_id, 'story_like', 'Story Liked', 'Someone liked your story.', ?, CONCAT('/stories/', s.story_id)
                FROM stories s WHERE s.story_id = ?
            `, [userId, storyId]);
        }

        // return updated like count
        const [[info]] = await pool.query('SELECT like_count FROM stories WHERE story_id = ?', [storyId]);
        res.json({ liked, like_count: info.like_count || 0 });
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

        await pool.query('UPDATE stories SET share_count = IFNULL(share_count,0) + 1 WHERE story_id = ?', [storyId]);
        await pool.query(`
            INSERT INTO notifications (notification_id, user_id, type, title, content, actor_id, action_url)
            SELECT UUID(), s.user_id, 'story_share', 'Story Shared', 'Someone shared your story.', ?, CONCAT('/stories/', s.story_id)
            FROM stories s WHERE s.story_id = ?
        `, [userId, storyId]);

        res.json({ success: true });
    } catch (error) {
        logger.error('Share Story Error:', error);
        res.status(500).json({ error: 'Failed to record share' });
    }
};

module.exports = { renderDashboard, getFeedPosts, getStories, renderPost, createStory, likeStory, getStoryLikes, shareStory };
