const Post = require('../models/Post');
const logger = require('../utils/logger');
const crypto = require('crypto');

const createPost = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const postData = {
            content: req.body.content,
            media_url: req.file ? req.file.path : req.body.media_url,
            media_type: req.body.media_type || (req.file ? (req.file.mimetype.startsWith('video') ? 'video' : 'image') : null),
            post_type: req.body.post_type || 'public',
            campus: req.body.campus,
            group_id: req.body.group_id
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

module.exports = {
    createPost,
    deletePost,
    sparkPost,
    getComments,
    addComment,
    savePost
};
