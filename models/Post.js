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

        // Hashtags (Max 5)
        const hashtags = content.match(/#(\w+)/g);
        if (hashtags) {
            const uniqueTags = [...new Set(hashtags.map(t => t.substring(1).toLowerCase()))].slice(0, 5);
            for (let cleanTag of uniqueTags) {
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
            `SELECT p.*, 
                    CASE WHEN u.anonymous_mode_enabled = 1 THEN 'Anonymous' ELSE u.username END as username,
                    CASE WHEN u.anonymous_mode_enabled = 1 THEN 'Sparkle Student' ELSE u.name END as user_name,
                    CASE WHEN u.anonymous_mode_enabled = 1 THEN '/uploads/avatars/default.png' ELSE u.avatar_url END as avatar_url,
                    (SELECT COUNT(*) FROM sparks s WHERE s.post_id = p.post_id) as sparks,
                    (SELECT JSON_ARRAYAGG(JSON_OBJECT('url', pm.media_url, 'type', pm.media_type)) 
                     FROM post_media pm WHERE pm.post_id = p.post_id ORDER BY pm.upload_order ASC) as media_files,
                    p.original_post_id,
                    orig_p.content as original_content,
                    orig_p.media_url as original_media_url,
                    orig_p.media_type as original_media_type,
                    orig_u.username as original_username,
                    orig_u.avatar_url as original_avatar_url,
                    (SELECT JSON_ARRAYAGG(u2.avatar_url) FROM posts p2 JOIN users u2 ON p2.user_id = u2.user_id WHERE p2.original_post_id = p.post_id LIMIT 3) as resharer_avatars
             FROM posts p 
             JOIN users u ON p.user_id = u.user_id 
             LEFT JOIN posts orig_p ON p.original_post_id = orig_p.post_id
             LEFT JOIN users orig_u ON orig_p.user_id = orig_u.user_id
             WHERE p.post_id = ?`,
            [postId]
        );
        const post = posts[0];
        if (post) {
            if (typeof post.media_files === 'string') {
                try { post.media_files = JSON.parse(post.media_files); } catch(e) { post.media_files = []; }
            }
            if (typeof post.resharer_avatars === 'string') {
                try { post.resharer_avatars = JSON.parse(post.resharer_avatars); } catch(e) { post.resharer_avatars = []; }
            }
        }
        return post || null;
    }

    /**
     * Get feed posts with hybrid algorithm:
     * - IF algorithmEnabled is false (Default):
     *     - Following-first basic feed (Chronological)
     *     - Fallback to global discovery if following is empty
     * - IF algorithmEnabled is true:
     *     - Weighted scoring + Randomization
     * 
     * @param {string} affiliation
     * @param {string} currentUserId
     * @param {number} limit
     * @param {number} offset
     * @param {number} randomSeed
     * @param {string|string[]} excludeIds
     */
    static async getFeed(affiliation, currentUserId, limit = 20, offset = 0, randomSeed = 0, excludeIds = []) {
        const algorithmEnabled = false; // DISABLED until platform scales as requested

        if (!algorithmEnabled) {
            // --- BASIC STABLE FEED LOGIC (UNIFIED CHRONOLOGICAL) ---
            try {
                // Fetch unified feed: Followed posts + Public posts, sorted by newest
                const feedQuery = `
                    SELECT * FROM (
                        -- 1. Original Posts
                        SELECT p.*, 
                               CASE WHEN u.anonymous_mode_enabled = 1 THEN 'Anonymous' ELSE u.username END as username,
                               CASE WHEN u.anonymous_mode_enabled = 1 THEN 'Sparkle Student' ELSE u.name END as user_name,
                               CASE WHEN u.anonymous_mode_enabled = 1 THEN '/uploads/avatars/default.png' ELSE u.avatar_url END as avatar_url,
                               u.campus as user_affiliation, u.major as user_interests,
                               (SELECT COUNT(*) FROM sparks s WHERE s.post_id = p.post_id) as sparks,
                               (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id) as comments,
                               EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = p.user_id) as is_followed,
                               EXISTS(SELECT 1 FROM sparks WHERE user_id = ? AND post_id = p.post_id) as is_sparked,
                               (SELECT JSON_ARRAYAGG(JSON_OBJECT('url', pm.media_url, 'type', pm.media_type)) 
                                FROM post_media pm WHERE pm.post_id = p.post_id ORDER BY pm.upload_order ASC) as media_files,
                               (SELECT JSON_ARRAYAGG(u2.avatar_url) FROM reposts r2 JOIN users u2 ON r2.user_id = u2.user_id WHERE r2.post_id = p.post_id LIMIT 3) as resharer_avatars,
                               EXISTS(SELECT 1 FROM reposts WHERE user_id = ? AND post_id = p.post_id) as is_reshared,
                               NULL as reposter_username, NULL as reposter_avatar, NULL as repost_comment,
                               p.created_at as feed_at
                        FROM posts p 
                        JOIN users u ON p.user_id = u.user_id 
                        WHERE (p.campus = ? OR p.post_type = 'public' OR p.campus IS NULL OR ? = 'all')
                          AND NOT EXISTS (
                              SELECT 1 FROM user_blocks 
                              WHERE (blocker_id = ? AND blocked_id = p.user_id)
                                  OR (blocker_id = p.user_id AND blocked_id = ?)
                          )
                          AND (
                              p.user_id = ? 
                              OR p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)
                              OR (u.is_private = 0 AND (u.profile_visibility IS NULL OR u.profile_visibility != 'private'))
                          )

                        UNION ALL

                        -- 2. Ghost Reposts (Numbered references e.g. 1.5, 2.5)
                        SELECT p.*, 
                               CASE WHEN u.anonymous_mode_enabled = 1 THEN 'Anonymous' ELSE u.username END as username,
                               CASE WHEN u.anonymous_mode_enabled = 1 THEN 'Sparkle Student' ELSE u.name END as user_name,
                               CASE WHEN u.anonymous_mode_enabled = 1 THEN '/uploads/avatars/default.png' ELSE u.avatar_url END as avatar_url,
                               u.campus as user_affiliation, u.major as user_interests,
                               (SELECT COUNT(*) FROM sparks s WHERE s.post_id = p.post_id) as sparks,
                               (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id) as comments,
                               EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = p.user_id) as is_followed,
                               EXISTS(SELECT 1 FROM sparks WHERE user_id = ? AND post_id = p.post_id) as is_sparked,
                               (SELECT JSON_ARRAYAGG(JSON_OBJECT('url', pm.media_url, 'type', pm.media_type)) 
                                FROM post_media pm WHERE pm.post_id = p.post_id ORDER BY pm.upload_order ASC) as media_files,
                               (SELECT JSON_ARRAYAGG(u2.avatar_url) FROM reposts r2 JOIN users u2 ON r2.user_id = u2.user_id WHERE r2.post_id = p.post_id LIMIT 3) as resharer_avatars,
                               EXISTS(SELECT 1 FROM reposts WHERE user_id = ? AND post_id = p.post_id) as is_reshared,
                               r_u.username as reposter_username, r_u.avatar_url as reposter_avatar, r.comment as repost_comment,
                               r.created_at as feed_at
                        FROM reposts r
                        JOIN posts p ON r.post_id = p.post_id
                        JOIN users u ON p.user_id = u.user_id
                        JOIN users r_u ON r.user_id = r_u.user_id
                        WHERE (r.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?) OR r.user_id = ?)
                          AND NOT EXISTS (
                              SELECT 1 FROM user_blocks 
                              WHERE (blocker_id = ? AND blocked_id = p.user_id)
                                  OR (blocker_id = p.user_id AND blocked_id = ?)
                          )
                    ) combined
                    ORDER BY feed_at DESC
                    LIMIT ? OFFSET ?`;

                const feedParams = [
                    currentUserId, currentUserId, // Original: is_followed, is_sparked
                    currentUserId,                  // Original: is_reshared
                    affiliation, affiliation,       // Original: campus, 'all'
                    currentUserId, currentUserId, // Original: block checks
                    currentUserId, currentUserId, // Original: owner, following checks
                    
                    currentUserId, currentUserId, // Repost: is_followed, is_sparked
                    currentUserId,                  // Repost: is_reshared
                    currentUserId, currentUserId, // Repost: following filter OR self
                    currentUserId, currentUserId, // Repost: block checks
                    
                    limit, offset                  // Pagination
                ];

                const [posts] = await pool.query(feedQuery, feedParams);
                return (posts || []).map(post => {
                    if (typeof post.media_files === 'string') {
                        try { post.media_files = JSON.parse(post.media_files); } catch(e) { post.media_files = []; }
                    }
                    if (typeof post.resharer_avatars === 'string') {
                        try { post.resharer_avatars = JSON.parse(post.resharer_avatars); } catch(e) { post.resharer_avatars = []; }
                    }
                    return post;
                });

            } catch (err) {
                console.error('Basic Feed Error:', err);
                return [];
            }
        }

        // --- OLD ALGORITHM LAYER (Stashed/Disabled) ---
        // Fetch top 20 recent hashtags from user's posts to use in discovery scoring
        const [recentTags] = await pool.query(`
            SELECT DISTINCT tag FROM post_hashtags ph2 
            JOIN posts p2 ON ph2.post_id = p2.post_id 
            WHERE p2.user_id = ? 
            ORDER BY p2.created_at DESC LIMIT 20
        `, [currentUserId]);
        
        const tags = recentTags.map(t => t.tag);
        const tagFilter = tags.length > 0 ? `AND ph.tag IN (${tags.map(() => '?').join(',')})` : 'AND 1=0';

        const excluded = Array.isArray(excludeIds) ? excludeIds : (typeof excludeIds === 'string' && excludeIds ? excludeIds.split(',') : []);
        const excludeFilter = excluded.length > 0 ? `AND p.post_id NOT IN (${excluded.map(() => '?').join(',')})` : '';

        const query = `
            SELECT p.*, u.username, u.name as user_name, u.avatar_url,
                    u.campus as user_affiliation, u.major as user_interests,
                    (SELECT COUNT(*) FROM sparks s WHERE s.post_id = p.post_id) as sparks,
                    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id) as comments,
                    (SELECT JSON_ARRAYAGG(JSON_OBJECT('url', pm.media_url, 'type', pm.media_type)) 
                     FROM post_media pm WHERE pm.post_id = p.post_id ORDER BY pm.upload_order ASC) as media_files,
                    EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = p.user_id) as is_followed,
                    EXISTS(SELECT 1 FROM sparks WHERE user_id = ? AND post_id = p.post_id) as is_sparked,
                    (
                        CASE 
                            WHEN p.user_id = ? THEN 8.0 
                            WHEN p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?) THEN 5.0
                            WHEN p.campus = ? THEN 3.0
                            ELSE 1.0 
                        END +
                        (p.spark_count * 0.2) + 
                        (p.comment_count * 0.3) + 
                        (p.share_count * 0.4) +
                        COALESCE((SELECT COUNT(*) * 0.5 FROM post_hashtags ph 
                         WHERE ph.post_id = p.post_id ${tagFilter}), 0)
                    ) as discovery_score
             FROM posts p 
             JOIN users u ON p.user_id = u.user_id 
             WHERE (p.campus = ? OR p.post_type = 'public' OR p.campus IS NULL OR ? = 'all')
                ${excludeFilter}
               AND NOT EXISTS (
                   SELECT 1 FROM user_blocks 
                   WHERE (blocker_id = ? AND blocked_id = p.user_id)
                       OR (blocker_id = p.user_id AND blocked_id = ?)
               )
               AND (
                   p.user_id = ? 
                   OR p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)
                   OR (u.is_private = 0 AND (u.profile_visibility IS NULL OR u.profile_visibility != 'private'))
               )
             ORDER BY discovery_score DESC, RAND(${randomSeed})
             LIMIT ? OFFSET ?`;

        const queryParams = [
            currentUserId, currentUserId, currentUserId, currentUserId, affiliation,
            ...tags,
            affiliation, affiliation,
            ...excluded,
            currentUserId, currentUserId, currentUserId, currentUserId,
            limit, offset
        ];

        const [posts] = await pool.query(query, queryParams);
        return posts;
    }

    /**
     * Get feed of posts from groups the user is a member of
     */
    static async getGroupFeed(userId, limit = 50) {
        const [posts] = await pool.query(
            `SELECT p.*, 
                    CASE WHEN u.anonymous_mode_enabled = 1 THEN 'Anonymous' ELSE u.username END as username,
                    CASE WHEN u.anonymous_mode_enabled = 1 THEN 'Sparkle Student' ELSE u.name END as user_name,
                    CASE WHEN u.anonymous_mode_enabled = 1 THEN '/uploads/avatars/default.png' ELSE u.avatar_url END as avatar_url,
                    g.name as group_name, g.icon_url as group_icon,
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
            SELECT c.*, 
                   CASE WHEN u.anonymous_mode_enabled = 1 THEN 'Anonymous' ELSE u.username END as username,
                   CASE WHEN u.anonymous_mode_enabled = 1 THEN 'Sparkle Student' ELSE u.name END as name,
                   CASE WHEN u.anonymous_mode_enabled = 1 THEN '/uploads/avatars/default.png' ELSE u.avatar_url END as avatar_url,
                   (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.comment_id) as like_count
                   ${currentUserId ? `, (SELECT 1 FROM comment_likes cl2 WHERE cl2.comment_id = c.comment_id AND cl2.user_id = ?) as is_liked ` : ''}
            FROM comments c
            JOIN users u ON c.user_id = u.user_id
            WHERE c.post_id = ?
            ORDER BY c.created_at ASC
        `;

        const finalParams = currentUserId ? [currentUserId, postId] : [postId];

        const [comments] = await pool.query(query, finalParams);
        
        // Return structured comments (Top level only for main request)
        return comments.filter(c => !c.parent_comment_id);
    }

    /**
     * Get replies for a specific comment
     */
    static async getCommentReplies(commentId, currentUserId = null) {
        const query = `
            SELECT c.*, u.username, u.name, u.avatar_url,
                   (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.comment_id) as like_count
                   ${currentUserId ? `, (SELECT 1 FROM comment_likes cl2 WHERE cl2.comment_id = c.comment_id AND cl2.user_id = ?) as is_liked ` : ''}
            FROM comments c
            JOIN users u ON c.user_id = u.user_id
            WHERE c.parent_comment_id = ?
            ORDER BY c.created_at ASC
        `;
        const params = currentUserId ? [currentUserId, commentId] : [commentId];
        const [replies] = await pool.query(query, params);
        return replies;
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
    static async addComment(postId, userId, content, parentId = null) {
        const commentId = crypto.randomUUID();
        await pool.query(
            'INSERT INTO comments (comment_id, post_id, user_id, content, parent_comment_id) VALUES (?, ?, ?, ?, ?)',
            [commentId, postId, userId, content, parentId]
        );
        await pool.query(
            'UPDATE posts SET comment_count = comment_count + 1 WHERE post_id = ?',
            [postId]
        );

        return commentId;
    }

    /**
     * Get posts by hashtag
     */
    static async getPostsByHashtag(tag, currentUserId, limit = 20) {
        const [posts] = await pool.query(
            `SELECT p.*, u.username, u.name as user_name, u.avatar_url,
                    (SELECT COUNT(*) FROM sparks s WHERE s.post_id = p.post_id) as sparks,
                    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id) as comments,
                    (SELECT JSON_ARRAYAGG(JSON_OBJECT('url', pm.media_url, 'type', pm.media_type)) 
                     FROM post_media pm WHERE pm.post_id = p.post_id ORDER BY pm.upload_order ASC) as media_files,
                    EXISTS(SELECT 1 FROM sparks WHERE user_id = ? AND post_id = p.post_id) as is_sparked
             FROM posts p 
             JOIN users u ON p.user_id = u.user_id 
             JOIN post_hashtags ph ON p.post_id = ph.post_id
             WHERE ph.tag = ?
             ORDER BY p.created_at DESC 
             LIMIT ?`,
            [currentUserId, tag.toLowerCase().replace('#', ''), limit]
        );
        return posts;
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

    static async getTrendingHashtags(limit = 10) {
        const query = `
            SELECT ph.tag, COUNT(*) as count
            FROM post_hashtags ph
            JOIN posts p ON ph.post_id = p.post_id
            WHERE p.created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY ph.tag
            ORDER BY count DESC
            LIMIT ?
        `;
        const [rows] = await pool.query(query, [limit]);
        return rows;
    }

    static async extractAndHandleMentions(postId, content, actorId) {
        if (!content) return;
        const mentions = content.match(/@(\w+)/g);
        if (!mentions) return;

        const usernames = [...new Set(mentions.map(m => m.substring(1)))];
        for (const username of usernames) {
            try {
                const [user] = await pool.query('SELECT user_id FROM users WHERE username = ?', [username]);
                if (user.length > 0 && user[0].user_id !== actorId) {
                    await require('../controllers/notification.controller').createNotification({
                        user_id: user[0].user_id,
                        type: 'mention',
                        title: 'New Mention',
                        content: 'mentioned you in a post',
                        actor_id: actorId,
                        related_id: postId,
                        related_type: 'post',
                        action_url: `/post/${postId}`
                    }, pool);
                }
            } catch (err) {
                logger.error('Mention handling error:', err);
            }
        }
    }
    
    /**
     * Reshare a post
     */
    static async reshare(userId, originalPostId, comment) {
        // Check if already reshared
        const [existing] = await pool.query(
            'SELECT repost_id FROM reposts WHERE user_id = ? AND post_id = ?',
            [userId, originalPostId]
        );

        if (existing.length > 0) {
            // Unrepost
            await pool.query('DELETE FROM reposts WHERE repost_id = ?', [existing[0].repost_id]);
            await pool.query(
                'UPDATE posts SET reshare_count = GREATEST(0, reshare_count - 1) WHERE post_id = ?',
                [originalPostId]
            );
            return { action: 'unreposted' };
        }

        // Repost
        const repostId = crypto.randomUUID();
        await pool.query(
            `INSERT INTO reposts (repost_id, user_id, post_id, comment) 
             VALUES (?, ?, ?, ?)`,
            [repostId, userId, originalPostId, comment || null]
        );
        
        // Notify original author
        const [origPost] = await pool.query('SELECT user_id FROM posts WHERE post_id = ?', [originalPostId]);
        if (origPost.length > 0 && origPost[0].user_id !== userId) {
            await pool.query(
                `INSERT INTO notifications (notification_id, user_id, type, actor_id, target_id) 
                 VALUES (?, ?, 'share', ?, ?)`,
                [crypto.randomUUID(), origPost[0].user_id, userId, originalPostId]
            );
        }

        await pool.query(
            'UPDATE posts SET reshare_count = reshare_count + 1 WHERE post_id = ?',
            [originalPostId]
        );

        // Handle mentions in comment if any
        if (comment && comment.includes('@')) {
            const mentions = comment.match(/@(\w+)/g);
            if (mentions) {
                for (const mention of mentions) {
                    const username = mention.substring(1);
                    const [user] = await pool.query('SELECT user_id FROM users WHERE username = ?', [username]);
                    if (user.length > 0) {
                        await pool.query(
                            `INSERT INTO notifications (notification_id, user_id, type, actor_id, target_id) 
                             VALUES (?, ?, 'mention', ?, ?)`,
                            [crypto.randomUUID(), user[0].user_id, userId, originalPostId]
                        );
                    }
                }
            }
        }

        return { action: 'reposted', repostId };
    }
}

module.exports = Post;
