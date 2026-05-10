const Post = require('../models/Post');
const logger = require('../utils/logger');
const crypto = require('crypto');
const notificationController = require('./notification.controller');
const MediaService = require('../services/media.service');

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

                // Register media in Cloudinary Architecture
                const fileSizeBytes = file.size || 0;
                const hashChecksum = crypto.createHash('md5').update(`${userId}-${fileSizeBytes}-${file.originalname}`).digest('hex');
                MediaService.registerMedia({
                    ownerId: userId,
                    category: 'post',
                    cloudinaryPublicId: file.filename,
                    secureUrl: file.path,
                    lifecycleState: 'active',
                    isReusable: false,
                    fileSizeBytes: fileSizeBytes,
                    hashChecksum: hashChecksum
                }).catch(err => console.error('Media registry fail:', err));

                return { url: file.path, type };
            });
        } else if (req.body.media_url) {
            mainMediaUrl = req.body.media_url;
            mainMediaType = req.body.media_type || (mainMediaUrl.match(/\.(mp4|webm|mov|avi)$/i) ? 'video' : 'image');
            media = [{ url: mainMediaUrl, type: mainMediaType }];
        }

        // SMART ROUTING: If video, redirect to Moments logic
        if (mainMediaType === 'video') {
            const MomentsController = require('./moments.controller');
            // Ensure moments controller gets what it expects
            req.body.media_url = mainMediaUrl; 
            req.body.caption = req.body.content;
            req.user.user_id = userId; // Unify userId field
            return MomentsController.createMoment(req, res);
        }

        const postData = {
            content: req.body.content,
            media_url: mainMediaUrl,
            media_type: mainMediaType,
            media: media, // Full array for model
            post_type: req.body.post_type || 'public',
            affiliation: req.body.affiliation || req.body.campus || req.user.campus,
            group_id: req.body.group_id,
            location: req.body.location,
            feeling: req.body.feeling,
            activity: req.body.activity
        };

        const postId = await Post.create(userId, postData);
        
        // Handle mentions asynchronously to avoid blocking the response
        Post.extractAndHandleMentions(postId, req.body.content, userId).catch(err => {
            logger.error('Background mention processing error:', err);
        });

        res.status(201).json({
            message: 'Post created successfully',
            post_id: postId,
            type: 'post'
        });
    } catch (error) {
        logger.error('Create post error:', error);
        console.error('❌ Post Creation Error Details:', error.message, error.stack);
        res.status(500).json({ error: 'Failed to create post' });
    }
};

const deletePost = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const postId = req.params.id;

        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ error: 'Post not found' });

        let isAuthorized = post.user_id === userId;

        // Check if admin of the group if it's a group post
        if (!isAuthorized && post.group_id) {
            const Group = require('../models/Group');
            const member = await Group.getMember(post.group_id, userId);
            if (member && (member.role === 'admin' || member.role === 'owner' || member.role === 'moderator')) {
                isAuthorized = true;
            }
        }

        // Also check if global admin (optional based on app structure)
        if (!isAuthorized && req.user.role === 'admin') {
            isAuthorized = true;
        }

        if (!isAuthorized) {
            return res.status(403).json({ error: 'Unauthorized to delete this post' });
        }

        const deleted = await Post.delete(postId, post.user_id); // Pass author ID to ensure correct delete logic
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
        const { sort } = req.query;
        
        if (!postId) {
            return res.status(400).json({ error: 'Post ID is required' });
        }

        const comments = await Post.getComments(postId, userId, sort);
        res.json({
            status: 'success',
            data: comments || []
        });
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
        const { content, parent_comment_id: parentId } = req.body;

        if (!postId || !content || content.trim() === '') {
            return res.status(400).json({ error: 'Post ID and content are required' });
        }

        const result = await Post.addComment(postId, userId, content, parentId);
        const commentId = result.commentId;

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

const translatePost = async (req, res) => {
    try {
        const postId = req.params.id;
        const post = await Post.findById(postId);
        
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const TranslationService = require('../utils/translationService');
        const result = await TranslationService.smartTranslate(post.content);

        res.json({
            originalText: post.content,
            translatedText: result.text,
            targetLanguage: result.target
        });
    } catch (error) {
        logger.error('Translate post error:', error);
        res.status(500).json({ error: 'Failed to translate post' });
    }
};

const translateComment = async (req, res) => {
    try {
        const commentId = req.params.id;
        const comment = await Post.getCommentById(commentId);
        
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        const TranslationService = require('../utils/translationService');
        const result = await TranslationService.smartTranslate(comment.content);

        res.json({
            originalText: comment.content,
            translatedText: result.text,
            targetLanguage: result.target
        });
    } catch (error) {
        logger.error('Translate comment error:', error);
        res.status(500).json({ error: 'Failed to translate comment' });
    }
};

const resharePost = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const originalPostId = req.params.id;
        const { comment } = req.body || {};

        const reshareResult = await Post.reshare(userId, originalPostId, comment);
        const reshareId = reshareResult.repostId || originalPostId;

        // Notify original post owner
        try {
            const originalPost = await Post.findById(originalPostId);
            if (originalPost && originalPost.user_id && originalPost.user_id !== userId) {
                notificationController.createNotification({
                    user_id: originalPost.user_id,
                    actor_id: userId,
                    type: 'reshare',
                    title: 'Post Reshared',
                    content: 'reshared your post',
                    related_id: reshareId,
                    related_type: 'post',
                    action_url: `/posts/${reshareId}`
                }).catch(() => { });
            }
        } catch (_) { }

        res.status(201).json({
            message: 'Post reshared successfully',
            post_id: reshareId
        });
    } catch (error) {
        logger.error('Reshare post error:', error);
        res.status(500).json({ error: 'Failed to reshare post' });
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
    translatePost,
    translateComment,
    resharePost,
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
    },
    updateReshareComment: async (req, res) => {
        try {
            const userId = req.user.userId || req.user.user_id;
            const postId = req.params.id;
            const { comment } = req.body;
            await Post.updateReshareComment(userId, postId, comment);
            res.json({ success: true });
        } catch (error) {
            logger.error('Update reshare comment error:', error);
            res.status(500).json({ error: 'Failed to update comment' });
        }
    },
    reportPost: async (req, res) => {
        try {
            const userId = req.user.userId || req.user.user_id;
            const postId = req.params.id;
            const { reason } = req.body;
            const logger = require('../utils/logger');
            logger.warn(`Post ${postId} reported by user ${userId} for reason: ${reason}`);
            res.json({ success: true, message: 'Post reported to admins.' });
        } catch (error) {
            res.status(500).json({ error: 'Failed to report post' });
        }
    },
    logAction: async (req, res) => {
        try {
            const userId = req.user.userId || req.user.user_id;
            const postId = req.params.id;
            const { action_type, duration } = req.body;
            
            // Async non-blocking record
            Post.recordAction(userId, postId, action_type, duration).catch(e => logger.error('Action record err:', e));
            
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: 'Failed' });
        }
    },
    updatePost: async (req, res) => {
        try {
            const userId = req.user.userId || req.user.user_id;
            const postId = req.params.id;
            
            let media = [];
            if (req.files && req.files.length > 0) {
                media = req.files.map(f => {
                    const fileSizeBytes = f.size || 0;
                    const hashChecksum = crypto.createHash('md5').update(`${userId}-${fileSizeBytes}-${f.originalname}`).digest('hex');
                    MediaService.registerMedia({
                        ownerId: userId,
                        category: 'post',
                        cloudinaryPublicId: f.filename,
                        secureUrl: f.path,
                        lifecycleState: 'active',
                        isReusable: false,
                        fileSizeBytes: fileSizeBytes,
                        hashChecksum: hashChecksum
                    }).catch(err => console.error('Media registry fail:', err));

                    return {
                        url: f.path,
                        type: f.mimetype.startsWith('video') ? 'video' : 'image'
                    };
                });
            }

            const updates = {
                content: req.body.content,
                post_type: req.body.post_type,
                feeling: req.body.feeling,
                activity: req.body.activity,
                tagged_users: req.body.tagged_users
            };

            if (media.length > 0) {
                updates.media = media;
            } else if (req.body.remove_media === 'true') {
                updates.media = [];
            }

            const success = await Post.update(postId, userId, updates);
            if (!success) {
                return res.status(403).json({ error: 'Unauthorized or post not found' });
            }

            res.json({ success: true, message: 'Post updated successfully' });
        } catch (error) {
            logger.error('Update post error:', error);
            res.status(500).json({ error: 'Failed to update post' });
        }
    },
    deleteComment: async (req, res) => {
        try {
            const userId = req.user.userId || req.user.user_id;
            const commentId = req.params.id;

            const comment = await Post.getCommentById(commentId);
            if (!comment) return res.status(404).json({ error: 'Comment not found' });

            let isAdmin = false;
            if (req.user.role === 'admin') isAdmin = true;

            // Also check group admin if post is in a group
            if (!isAdmin) {
                const post = await Post.findById(comment.post_id);
                if (post && post.group_id) {
                    const Group = require('../models/Group');
                    const member = await Group.getMember(post.group_id, userId);
                    if (member && (member.role === 'admin' || member.role === 'owner' || member.role === 'moderator')) {
                        isAdmin = true;
                    }
                }
            }

            const deleted = await Post.deleteComment(commentId, userId, isAdmin);
            if (!deleted) return res.status(403).json({ error: 'Unauthorized' });

            res.json({ success: true, message: 'Comment deleted' });
        } catch (error) {
            logger.error('Delete comment error:', error);
            res.status(500).json({ error: 'Failed to delete comment' });
        }
    },
    updateComment: async (req, res) => {
        try {
            const userId = req.user.userId || req.user.user_id;
            const commentId = req.params.id;
            const { content } = req.body;

            const success = await Post.updateComment(commentId, userId, content);
            if (!success) return res.status(403).json({ error: 'Unauthorized' });

            res.json({ success: true, message: 'Comment updated' });
        } catch (error) {
            logger.error('Update comment error:', error);
            res.status(500).json({ error: 'Failed to update comment' });
        }
    }
};
