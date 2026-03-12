const Post = require('../models/Post');
const logger = require('../utils/logger');
const crypto = require('crypto');
const notificationController = require('./notification.controller');

const createPost = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;

        // Handle media files
        let media = [];
        let mainMediaUrl = null;
        let mainMediaType = null;

        if (req.files && req.files.length > 0) {
            media = req.files.map((file, index) => {
                const type = file.mimetype.startsWith('video') ? 'video' : 'image';
                if (index === 0) {
                    mainMediaUrl = file.path;
                    mainMediaType = type;
                }
                return { url: file.path, type };
            });
        } else if (req.body.media_url) {
            mainMediaUrl = req.body.media_url;
            mainMediaType = req.body.media_type || 'image';
            media = [{ url: mainMediaUrl, type: mainMediaType }];
        }

        const postData = {
            content: req.body.content,
            media_url: mainMediaUrl,
            media_type: mainMediaType,
            media: media, // Full array for model
            post_type: req.body.post_type || 'public',
            campus: req.body.campus,
            group_id: req.body.group_id,
            location: req.body.location
        };

        const postId = await Post.create(userId, postData);
        res.status(201).json({
            message: 'Post created successfully',
            post_id: postId
        });
    } catch (error) {
        logger.error('Create post error:', error);
        res.status(500).json({ error: 'Failed to create post' });
    }
};

const deletePost = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const postId = req.params.id;

        const deleted = await Post.delete(postId, userId);
        if (!deleted) {
            return res.status(404).json({ error: 'Post not found or unauthorized' });
        }

        res.json({ message: 'Post deleted successfully' });
    } catch (error) {
        logger.error('Delete post error:', error);
        res.status(500).json({ error: 'Failed to delete post' });
    }
};

const sparkPost = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const postId = req.params.id;

        const result = await Post.addSpark(postId, userId);

        // Notify post owner on spark (not un-spark)
        if (result.action === 'sparked') {
            try {
                const post = await Post.findById(postId);
                if (post && post.user_id) {
                    notificationController.createNotification({
                        user_id: post.user_id,
                        actor_id: userId,
                        type: 'spark',
                        title: 'New Spark',
                        content: 'sparked your post',
                        related_id: postId,
                        related_type: 'post',
                        action_url: `/posts/${postId}`
                    }).catch(() => { });
                }
            } catch (_) { /* non-blocking */ }
        }

        res.json({
            message: result.action === 'sparked' ? 'Post sparked!' : 'Spark removed',
            action: result.action
        });
    } catch (error) {
        logger.error('Spark post error:', error);
        res.status(500).json({ error: 'Failed to spark post' });
    }
};

const getComments = async (req, res) => {
    try {
        const postId = req.params.id;
        const comments = await Post.getComments(postId);
        res.json(comments);
    } catch (error) {
        logger.error('Get comments error:', error);
        res.status(500).json({ error: 'Failed to get comments' });
    }
};

const addComment = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const postId = req.params.id;
        const content = req.body.content;

        const commentId = await Post.addComment(postId, userId, content);

        // Notify post owner of comment
        try {
            const post = await Post.findById(postId);
            if (post && post.user_id) {
                notificationController.createNotification({
                    user_id: post.user_id,
                    actor_id: userId,
                    type: 'comment',
                    title: 'New Comment',
                    content: 'commented on your post',
                    related_id: postId,
                    related_type: 'post',
                    action_url: `/posts/${postId}`
                }).catch(() => { });
            }
        } catch (_) { /* non-blocking */ }

        res.status(201).json({
            message: 'Comment added successfully',
            comment_id: commentId
        });
    } catch (error) {
        logger.error('Add comment error:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
};

const savePost = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const postId = req.params.id;

        const result = await Post.toggleSave(postId, userId);
        res.json({
            message: result.action === 'saved' ? 'Post saved to bookmarks!' : 'Post removed from bookmarks',
            action: result.action
        });
    } catch (error) {
        logger.error('Save post error:', error);
        res.status(500).json({ error: 'Failed to save post' });
    }
};

const getLikedPosts = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const limit = parseInt(req.query.limit) || 20;
        const posts = await Post.getLikedPosts(userId, limit);
        res.json(posts);
    } catch (error) {
        logger.error('Get liked posts error:', error);
        res.status(500).json({ error: 'Failed to get liked posts' });
    }
};

const sharePost = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const postId = req.params.id;
        await Post.incrementShare(postId, userId);

        // Notify post owner of share
        try {
            const post = await Post.findById(postId);
            if (post && post.user_id) {
                notificationController.createNotification({
                    user_id: post.user_id,
                    actor_id: userId,
                    type: 'share',
                    title: 'Post Shared',
                    content: 'shared your post',
                    related_id: postId,
                    related_type: 'post',
                    action_url: `/posts/${postId}`
                }).catch(() => { });
            }
        } catch (_) { /* non-blocking */ }

        res.json({ message: 'Post share count updated' });
    } catch (error) {
        logger.error('Share post error:', error);
        res.status(500).json({ error: 'Failed to update share count' });
    }
};

module.exports = {
    createPost,
    deletePost,
    sparkPost,
    getComments,
    addComment,
    savePost,
    getLikedPosts,
    sharePost
};
