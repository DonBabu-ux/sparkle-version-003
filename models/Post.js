const pool = require('../config/database');
const crypto = require('crypto');

class Post {
    /**
     * Create a new post
     */
    static async create(userId, postData) {
        const postId = crypto.randomUUID();
        const affiliation = postData.affiliation || postData.campus || null;
        await pool.query(
            `INSERT INTO posts (post_id, user_id, content, media_url, media_type, post_type, campus, group_id, location) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                postId,
                userId,
                postData.content,
                postData.media_url || null,
                postData.media_type || null,
                postData.post_type || 'public',
                affiliation,
                postData.group_id || null,
                postData.location || null
            ]
        );

        // Handle multi-media (carousels)
        if (postData.media && Array.isArray(postData.media)) {
            for (let i = 0; i < postData.media.length; i++) {
                const m = postData.media[i];
                await pool.query(
                    'INSERT INTO post_media (media_id, post_id, media_url, media_type, upload_order) VALUES (?, ?, ?, ?, ?)',
                    [crypto.randomUUID(), postId, m.url, m.type || 'image', i]
                );
            }
        }

        // Tags and Mentions
        try {
            await this.extractAndSaveTags(postId, postData.content, userId);
        } catch (e) {
            console.error('Extraction error:', e);
        }

        return postId;
    }

    static async extractAndSaveTags(postId, content, actorId) {
        if (!content) return;

        // Hashtags
        const hashtags = content.match(/#(\w+)/g);
        if (hashtags) {
            for (let tag of hashtags) {
                const cleanTag = tag.substring(1).toLowerCase();
                await pool.query(
                    'INSERT IGNORE INTO post_hashtags (post_id, tag) VALUES (?, ?)',
                    [postId, cleanTag]
                );
            }
        }

        // Mentions (@username)
        const mentions = content.match(/@(\w+)/g);
        if (mentions) {
            const notificationController = require('../controllers/notification.controller');
            for (let mention of mentions) {
                const username = mention.substring(1).toLowerCase();
                const [users] = await pool.query('SELECT user_id FROM users WHERE username = ?', [username]);
                if (users.length > 0) {
                    const mentionedUserId = users[0].user_id;
                    if (mentionedUserId !== actorId) {
                        try {
                            await notificationController.createNotification({
                                user_id: mentionedUserId,
                                actor_id: actorId,
                                type: 'mention',
                                title: 'New Mention',
                                content: `mentioned you in a post`,
                                related_id: postId,
                                related_type: 'post',
                                action_url: `/posts/${postId}`
                            });
                        } catch (_) { }
                    }
                }
            }
        }
    }

    /**
     * Get post by ID with user info
     */
    static async findById(postId) {
        const [posts] = await pool.query(
            `SELECT p.*, u.username, u.name as user_name, u.avatar_url,
                    (SELECT COUNT(*) FROM sparks s WHERE s.post_id = p.post_id) as sparks,
                    (SELECT JSON_ARRAYAGG(JSON_OBJECT('url', pm.media_url, 'type', pm.media_type)) 
                     FROM post_media pm WHERE pm.post_id = p.post_id ORDER BY pm.upload_order ASC) as media_files
             FROM posts p 
             JOIN users u ON p.user_id = u.user_id 
             WHERE p.post_id = ?`,
            [postId]
        );
        return posts[0] || null;
    }

    /**
     * Get feed posts with hybrid algorithm:
     * - 60% Followed content + 40% Discovery content
     * - Random posts for new users
     * - Device-level randomness (using randomSeed)
     * @param {string} affiliation
     * @param {string} currentUserId
     * @param {number} limit
     * @param {number} offset
     * @param {number} randomSeed - Seed for device-level randomness
     */
    static async getFeed(affiliation, currentUserId, limit = 20, offset = 0, randomSeed = 0) {
        // First determine if we show hybrid or full random (new users)
        const [followCount] = await pool.query('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?', [currentUserId]);
        const isNewUser = (followCount[0].count === 0);

        // Algorithm logic:
        // We use a UNION to mix followed posts and random public posts.
        // We assign a weight/boost to prioritize followed content but interleave random ones.
        
        const [posts] = await pool.query(
            `SELECT p.*, u.username, u.name as user_name, u.avatar_url,
                    u.campus as user_affiliation, u.major as user_interests,
                    (SELECT COUNT(*) FROM sparks s WHERE s.post_id = p.post_id) as sparks,
                    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id) as comments,
                    (SELECT JSON_ARRAYAGG(JSON_OBJECT('url', pm.media_url, 'type', pm.media_type)) 
                     FROM post_media pm WHERE pm.post_id = p.post_id ORDER BY pm.upload_order ASC) as media_files,
                    -- Check if followed by current user
                    EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = p.user_id) as is_followed,
                    -- Check if liked by current user
                    EXISTS(SELECT 1 FROM sparks WHERE user_id = ? AND post_id = p.post_id) as is_sparked,
                    -- Weight for hybrid algorithm
                    CASE 
                        WHEN p.user_id = ? THEN 4 -- My own posts
                        WHEN p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?) THEN 3 -- Followed posts
                        WHEN p.campus = ? THEN 2 -- Same affiliation
                        ELSE 1 -- Random discovery posts 
                    END as priority
             FROM posts p 
             JOIN users u ON p.user_id = u.user_id 
             WHERE (p.campus = ? OR p.post_type = 'public' OR p.campus IS NULL OR ? = 'all')
               AND NOT EXISTS (
                   SELECT 1 FROM user_blocks 
                   WHERE (blocker_id = ? AND blocked_id = p.user_id)
                       OR (blocker_id = p.user_id AND blocked_id = ?)
               )
               -- If not followed, only show public non-private accounts or accounts that follow us
               AND (
                   p.user_id = ? 
                   OR p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)
                   OR (u.is_private = 0 AND (u.profile_visibility IS NULL OR u.profile_visibility != 'private'))
               )
             ORDER BY 
                ${isNewUser ? `RAND(${randomSeed})` : `priority DESC, p.created_at DESC, RAND(${randomSeed})`}
             LIMIT ? OFFSET ?`,
            [currentUserId, currentUserId, currentUserId, currentUserId, affiliation, affiliation, affiliation, currentUserId, currentUserId, currentUserId, currentUserId, limit, offset]
        );
        return posts;
    }

    /**
     * Get feed of posts from groups the user is a member of
     */
    static async getGroupFeed(userId, limit = 50) {
        const [posts] = await pool.query(
            `SELECT p.*, u.username, u.name as user_name, u.avatar_url, g.name as group_name, g.icon_url as group_icon,
                    (SELECT COUNT(*) FROM sparks s WHERE s.post_id = p.post_id) as sparks,
                    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id) as comments
             FROM posts p 
             JOIN users u ON p.user_id = u.user_id 
             JOIN groups g ON p.group_id = g.group_id
             JOIN group_members gm ON g.group_id = gm.group_id
             WHERE gm.user_id = ? AND gm.status = 'active' AND p.post_type = 'group'
             ORDER BY p.created_at DESC 
             LIMIT ?`,
            [userId, limit]
        );
        return posts;
    }

    /**
     * Get user posts
     */
    static async getUserPosts(userId, currentUserId = null, limit = 20) {
        // Privacy Check
        if (currentUserId && userId !== currentUserId) {
            const [user] = await pool.query('SELECT is_private, profile_visibility FROM users WHERE user_id = ?', [userId]);
            if (user[0] && (user[0].is_private || user[0].profile_visibility === 'private')) {
                const [followed] = await pool.query('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?', [currentUserId, userId]);
                if (followed.length === 0) {
                    return []; // User is private and not followed
                }
            }
        }

        const [posts] = await pool.query(
            `SELECT p.*, 
                    (SELECT COUNT(*) FROM sparks s WHERE s.post_id = p.post_id) as sparks,
                    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id) as comments,
                    (SELECT JSON_ARRAYAGG(JSON_OBJECT('url', pm.media_url, 'type', pm.media_type)) 
                     FROM post_media pm WHERE pm.post_id = p.post_id ORDER BY pm.upload_order ASC) as media_files
             FROM posts p 
             WHERE p.user_id = ? 
             ORDER BY p.created_at DESC 
             LIMIT ?`,
            [userId, limit]
        );
        return posts;
    }

    /**
     * Delete post
     */
    static async delete(postId, userId) {
        const [result] = await pool.query(
            'DELETE FROM posts WHERE post_id = ? AND user_id = ?',
            [postId, userId]
        );
        return result.affectedRows > 0;
    }

    /**
     * Add spark (like) to post
     */
    static async addSpark(postId, userId) {
        const sparkId = crypto.randomUUID();
        try {
            await pool.query(
                'INSERT INTO sparks (spark_id, user_id, post_id) VALUES (?, ?, ?)',
                [sparkId, userId, postId]
            );
            await pool.query(
                'UPDATE posts SET spark_count = spark_count + 1 WHERE post_id = ?',
                [postId]
            );

            return { success: true, action: 'sparked' };
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                // Remove spark if already exists
                await pool.query(
                    'DELETE FROM sparks WHERE user_id = ? AND post_id = ?',
                    [userId, postId]
                );
                await pool.query(
                    'UPDATE posts SET spark_count = GREATEST(spark_count - 1, 0) WHERE post_id = ?',
                    [postId]
                );
                return { success: true, action: 'unsparked' };
            }
            throw error;
        }
    }

    /**
     * Get post comments
     */
    static async getComments(postId, currentUserId = null) {
        let query = `
            SELECT c.*, u.username, u.name, u.avatar_url,
                   (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.comment_id) as like_count
        `;

        const params = [postId];

        if (currentUserId) {
            query += `, (SELECT 1 FROM comment_likes cl2 WHERE cl2.comment_id = c.comment_id AND cl2.user_id = ?) as is_liked `;
            params.unshift(currentUserId); // Add currentUserId for the subquery
            // Wait, unshift puts it at the beginning. PostId is at the end.
            // Let's reorder:
        }

        query = `
            SELECT c.*, u.username, u.name, u.avatar_url,
                   (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.comment_id) as like_count
                   ${currentUserId ? `, (SELECT 1 FROM comment_likes cl2 WHERE cl2.comment_id = c.comment_id AND cl2.user_id = ?) as is_liked ` : ''}
            FROM comments c
            JOIN users u ON c.user_id = u.user_id
            WHERE c.post_id = ?
            ORDER BY c.created_at ASC
        `;

        const finalParams = currentUserId ? [currentUserId, postId] : [postId];

        const [comments] = await pool.query(query, finalParams);
        return comments;
    }

    /**
     * Get a single comment by ID
     */
    static async getCommentById(commentId) {
        const [comments] = await pool.query('SELECT * FROM comments WHERE comment_id = ?', [commentId]);
        return comments[0] || null;
    }

    /**
     * Add like to comment
     */
    static async addCommentLike(commentId, userId) {
        const likeId = crypto.randomUUID();
        try {
            await pool.query(
                'INSERT INTO comment_likes (like_id, comment_id, user_id) VALUES (?, ?, ?)',
                [likeId, commentId, userId]
            );
            await pool.query(
                'UPDATE comments SET like_count = like_count + 1 WHERE comment_id = ?',
                [commentId]
            );
            return { success: true, action: 'liked' };
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                await pool.query(
                    'DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?',
                    [commentId, userId]
                );
                await pool.query(
                    'UPDATE comments SET like_count = GREATEST(like_count - 1, 0) WHERE comment_id = ?',
                    [commentId]
                );
                return { success: true, action: 'unliked' };
            }
            throw error;
        }
    }

    /**
     * Add comment to post
     */
    static async addComment(postId, userId, content) {
        const commentId = crypto.randomUUID();
        await pool.query(
            'INSERT INTO comments (comment_id, post_id, user_id, content) VALUES (?, ?, ?, ?)',
            [commentId, postId, userId, content]
        );
        await pool.query(
            'UPDATE posts SET comment_count = comment_count + 1 WHERE post_id = ?',
            [postId]
        );

        return commentId;
    }

    /**
     * Toggle save/bookmark post
     */
    static async toggleSave(postId, userId) {
        const bookmarkId = crypto.randomUUID();
        try {
            await pool.query(
                'INSERT INTO bookmarks (bookmark_id, user_id, post_id) VALUES (?, ?, ?)',
                [bookmarkId, userId, postId]
            );
            return { success: true, action: 'saved' };
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                await pool.query(
                    'DELETE FROM bookmarks WHERE user_id = ? AND post_id = ?',
                    [userId, postId]
                );
                return { success: true, action: 'unsaved' };
            }
            throw error;
        }
    }

    /**
     * Get saved posts for user
     */
    static async getSavedPosts(userId, limit = 20) {
        const [posts] = await pool.query(
            `SELECT p.*, u.username, u.name as user_name, u.avatar_url,
                    (SELECT COUNT(*) FROM sparks s WHERE s.post_id = p.post_id) as sparks,
                    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id) as comments
             FROM bookmarks sp
             JOIN posts p ON sp.post_id = p.post_id
             JOIN users u ON p.user_id = u.user_id
             WHERE sp.user_id = ?
             ORDER BY sp.created_at DESC
             LIMIT ?`,
            [userId, limit]
        );
        return posts;
    }

    /**
     * Get posts liked (sparked) by user
     */
    static async getLikedPosts(userId, limit = 20) {
        const [posts] = await pool.query(
            `SELECT p.*, u.username, u.name as user_name, u.avatar_url,
                    (SELECT COUNT(*) FROM sparks s WHERE s.post_id = p.post_id) as sparks,
                    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id) as comments
             FROM sparks s
             JOIN posts p ON s.post_id = p.post_id
             JOIN users u ON p.user_id = u.user_id
             WHERE s.user_id = ?
             ORDER BY s.created_at DESC
             LIMIT ?`,
            [userId, limit]
        );
        return posts;
    }

    /**
     * Increment share count for post
     */
    static async incrementShare(postId, actorId = null) {
        await pool.query(
            'UPDATE posts SET share_count = share_count + 1 WHERE post_id = ?',
            [postId]
        );

        return true;
    }
}

module.exports = Post;
