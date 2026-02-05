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
        const posts = await Post.getFeed(campus, 10);

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
        const posts = await Post.getFeed(campus, 20);

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
        const [stories] = await pool.query(`
            SELECT 
                s.*,
                u.username,
                u.name as user_name,
                u.avatar_url,
                (SELECT COUNT(*) FROM stories WHERE user_id = s.user_id AND created_at > NOW() - INTERVAL 24 HOUR) as user_story_count
            FROM stories s
            JOIN users u ON s.user_id = u.user_id
            WHERE s.created_at > NOW() - INTERVAL 24 HOUR
            ORDER BY s.created_at DESC
            LIMIT 50
        `);
        res.json(stories);
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

module.exports = { renderDashboard, getFeedPosts, getStories, renderPost, createStory };
