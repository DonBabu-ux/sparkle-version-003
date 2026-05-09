const Confession = require('../models/Confession');
const logger = require('../utils/logger');

// Web Routes
const renderConfessions = async (req, res) => {
    try {
        const isRandom = req.query.feed === 'random';
        const affiliation = 'all'; // Default to global as requested
        
        // Batch 3: High-entropy randomness for "Each load different"
        const randomSeed = Math.floor(Math.random() * 1000000) + Date.now();

        let confessions;
        if (isRandom) {
            confessions = await Confession.getFeed(affiliation, 20, randomSeed);
        } else {
            confessions = await Confession.getRecent(affiliation, 20);
        }

        res.render('confessions', {
            title: 'Community Confessions',
            confessions: confessions || [],
            user: req.user,
            isRandom
        });
    } catch (error) {
        logger.error('Render Confessions Error:', error);
        res.render('confessions', { title: 'Community Confessions', confessions: [], user: req.user, filter: 'all', isRandom: false });
    }
};

// API Routes
const createConfession = async (req, res) => {
    try {
        const { content, category = 'general', campus } = req.body;
        const affiliation = campus || req.user.campus || 'Global';

        if (!content || !content.trim()) return res.status(400).json({ error: 'Content is required' });

        // Basic content moderation
        const badWords = ['hate', 'violence', 'kill', 'suicide'];
        const hasBadWords = badWords.some(word => content.toLowerCase().includes(word));
        if (hasBadWords) {
            return res.status(400).json({ error: 'Your confession matches our community guidelines flag. Please be kind!' });
        }

        const userId = req.user.user_id || req.user.userId;
        // req.file is set by multer when an image is uploaded; req.file.path is the Cloudinary URL
        const imageUrl = req.file ? req.file.path : null;

        const id = await Confession.create(userId, content.trim(), affiliation, category, imageUrl);
        
        res.status(201).json({ 
            status: 'success', 
            success: true,
            message: 'Confession submitted anonymously', 
            id 
        });
    } catch (error) {
        logger.error('Create Confession Error:', error);
        res.status(500).json({ error: 'Failed to submit confession' });
    }
};

const reactToConfession = async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.body; // upvote, downvote, etc.
        const userId = req.user.user_id || req.user.userId;

        await Confession.addReaction(id, userId, type);

        // Batch 3: Anonymous Notifications
        const confession = await Confession.findById(id);
        if (confession && confession.user_id && confession.user_id !== userId) {
            const notificationController = require('./notification.controller');
            await notificationController.createInternalNotification(
                confession.user_id,
                'anonymous',
                'reaction',
                `Someone reacted "${type}" to your anonymous confession!`,
                `/confessions?id=${id}`
            );
        }

        res.json({ message: 'Reaction recorded' });
    } catch (error) {
        logger.error('React Confession Error:', error);
        res.status(500).json({ error: 'Failed to record reaction' });
    }
};

// Report a confession (moderation)
const reportConfession = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const userId = req.user.user_id || req.user.userId;

        if (!reason) return res.status(400).json({ error: 'Reason is required' });

        await Confession.addReport(id, userId, reason);
        res.json({ message: 'Confession reported. Our team will review it.' });
    } catch (error) {
        logger.error('Report Confession Error:', error);
        res.status(500).json({ error: 'Failed to report confession' });
    }
};

// Post an anonymous comment on a confession
const commentAnonymously = async (req, res) => {
    try {
        const { id } = req.params;
        const { content, parent_id } = req.body;
        const userId = req.user.user_id || req.user.userId;

        if (!content || !content.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });

        const commentId = await Confession.addComment(id, userId, content.trim(), parent_id);

        // Batch 3: Anonymous Notifications
        const confession = await Confession.findById(id);
        const notificationController = require('./notification.controller');

        // 1. Notify Confession Author
        if (confession && confession.user_id && confession.user_id !== userId) {
            await notificationController.createInternalNotification(
                confession.user_id,
                'anonymous',
                'comment',
                `Someone commented on your anonymous confession!`,
                `/confessions?id=${id}`
            );
        }

        // 2. Notify Parent Comment Author (if it's a reply)
        if (parent_id) {
            const parentComment = await Confession.findCommentById(parent_id);
            if (parentComment && parentComment.user_id && parentComment.user_id !== userId) {
                // Avoid double notification if the confession author is also the parent commenter
                if (parentComment.user_id !== confession?.user_id) {
                    await notificationController.createInternalNotification(
                        parentComment.user_id,
                        'anonymous',
                        'reply',
                        `Someone replied to your whisper!`,
                        `/confessions?id=${id}`
                    );
                }
            }
        }

        res.status(201).json({ message: 'Comment posted anonymously', comment_id: commentId });
    } catch (error) {
        logger.error('Anonymous Comment Error:', error);
        res.status(500).json({ error: 'Failed to post comment' });
    }
};

// Get comments for a confession
const getComments = async (req, res) => {
    try {
        const { id } = req.params;
        const comments = await Confession.getComments(id);
        res.json({ status: 'success', data: comments });
    } catch (error) {
        logger.error('Get Comments Error:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
};

// Get confessions filtered by affiliation and category
const getConfessionsByAffiliation = async (req, res) => {
    try {
        const affiliation = req.params.campus || req.query.campus || 'all';
        const category = req.query.category || null;
        
        // Use getFeed for the "Special Home Feed" experience (discovery ranked)
        const confessions = await Confession.getFeed(affiliation, 20, category);
        res.json({ status: 'success', data: confessions });
    } catch (error) {
        logger.error('Get Confessions By Affiliation Error:', error);
        res.status(500).json({ error: 'Failed to filter confessions' });
    }
};

module.exports = {
    renderConfessions,
    createConfession,
    reactToConfession,
    reportConfession,
    commentAnonymously,
    getComments,
    getConfessionsByAffiliation
};
