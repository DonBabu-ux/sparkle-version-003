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
            affiliation: req.body.affiliation || req.body.campus || req.user.campus,
            group_id: req.body.group_id,
            location: req.body.location
        };

        const postId = await Post.create(userId, postData);
        
        // Handle mentions asynchronously to avoid blocking the response
        Post.extractAndHandleMentions(postId, req.body.content, userId).catch(err => {
            logger.error('Background mention processing error:', err);
        });

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
        const userId = req.user ? (req.user.userId || req.user.user_id) : null;
        const postId = req.params.id;
        
        if (!postId) {
            return res.status(400).json({ error: 'Post ID is required' });
        }

        const comments = await Post.getComments(postId, userId);
        res.json(comments || []);
    } catch (error) {
        logger.error('Get comments error:', error);
        res.status(500).json({ error: 'Failed to get comments', comments: [] });
    }
};

const getPost = async (req, res) => {
    try {
        const postId = req.params.id;
        if (!postId) {
            return res.status(400).json({ error: 'Post ID is required' });
        }
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        res.json(post);
    } catch (error) {
        logger.error('Get post error:', error);
        res.status(500).json({ error: 'Failed to get post' });
    }
};

const addComment = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const postId = req.params.id;
        const { content, parentId } = req.body;

        if (!postId || !content || content.trim() === '') {
            return res.status(400).json({ error: 'Post ID and content are required' });
        }

        const commentId = await Post.addComment(postId, userId, content, parentId);

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

const getSavedPosts = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const limit = parseInt(req.query.limit) || 20;
        const posts = await Post.getSavedPosts(userId, limit);
        res.json(posts);
    } catch (error) {
        logger.error('Get saved posts error:', error);
        res.status(500).json({ error: 'Failed to get saved posts' });
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

const likeComment = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const commentId = req.params.id;

        const result = await Post.addCommentLike(commentId, userId);

        // Notify comment owner on like
        if (result.action === 'liked') {
            try {
                const comment = await Post.getCommentById(commentId);
                if (comment && comment.user_id && comment.user_id !== userId) {
                    notificationController.createNotification({
                        user_id: comment.user_id,
                        actor_id: userId,
                        type: 'mention', // Using mention as a proxy or add 'comment_like'
                        title: 'Comment Liked',
                        content: 'liked your comment',
                        related_id: comment.post_id,
                        related_type: 'post',
                        action_url: `/posts/${comment.post_id}`
                    }).catch(() => { });
                }
            } catch (_) { }
        }

        const comment = await Post.getCommentById(commentId);
        res.json({
            message: result.action === 'liked' ? 'Comment liked!' : 'Like removed',
            action: result.action,
            newCount: comment ? comment.like_count : 0
        });
    } catch (error) {
        logger.error('Like comment error:', error);
        res.status(500).json({ error: 'Failed to like comment' });
    }
};

module.exports = {
    createPost,
    deletePost,
    getPost,
    sparkPost,
    getComments,
    addComment,
    savePost,
    getSavedPosts,
    getLikedPosts,
    sharePost,
    likeComment,
    getCommentReplies: async (req, res) => {
        try {
            const userId = req.user ? (req.user.userId || req.user.user_id) : null;
            const replies = await Post.getCommentReplies(req.params.id, userId);
            res.json(replies);
        } catch (error) {
            res.status(500).json({ error: 'Failed' });
        }
    },
    getPostsByHashtag: async (req, res) => {
        try {
            const userId = req.user ? (req.user.userId || req.user.user_id) : null;
            const posts = await Post.getPostsByHashtag(req.params.tag, userId);
            res.json(posts);
        } catch (error) {
            res.status(500).json({ error: 'Failed' });
        }
    }
};
