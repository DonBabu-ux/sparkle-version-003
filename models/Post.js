const pool = require('../config/database');
const crypto = require('crypto');

class Post {
    /**
     * Detects post category based on keywords and hashtags
     */
    static detectCategory(content) {
        const text = (content || '').toLowerCase();
        const categories = {
            'Sports': ['football', 'soccer', 'basketball', 'match', 'goal', 'team', 'athlete', 'sports', 'gym'],
            'Technology': ['coding', 'software', 'tech', 'ai', 'programming', 'developer', 'app', 'system'],
            'Entertainment': ['music', 'movie', 'film', 'song', 'artist', 'dance', 'party', 'fun'],
            'Academic': ['study', 'exam', 'lecture', 'university', 'college', 'major', 'research', 'book'],
            'Social': ['friend', 'hangout', 'life', 'vibe', 'happy', 'weekend']
        };

        for (const [cat, keywords] of Object.entries(categories)) {
            if (keywords.some(k => text.includes(k))) return cat;
        }
        return 'General';
    }

    /**
     * Create a new post
     */
    static async create(userId, postData) {
        const postId = crypto.randomUUID();
        const affiliation = postData.affiliation || postData.campus || null;
        const category = this.detectCategory(postData.content);
        
        // --- NEW: Spam Filter (Algorithm 11.10) ---
        const badWords = ['spam', 'offensive', 'badword']; // Simplified for demo
        const contentLower = (postData.content || '').toLowerCase();
        if (badWords.some(word => contentLower.includes(word))) {
            throw new Error('Post contains prohibited content or spam.');
        }

        const scheduledAt = postData.scheduled_at || null;
        const commentsEnabled = postData.comments_enabled !== undefined ? postData.comments_enabled : 1;

        await pool.query(
            `INSERT INTO posts (post_id, user_id, content, media_url, media_type, post_type, campus, group_id, location, scheduled_at, comments_enabled, category) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                postId,
                userId,
                postData.content,
                postData.media_url || null,
                postData.media_type || null,
                postData.post_type || 'public',
                affiliation,
                postData.group_id || null,
                postData.location || null,
                scheduledAt,
                commentsEnabled,
                category
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
                    CASE 
                        WHEN u.deleted_at IS NOT NULL OR u.account_status = 'deactivated' THEN 'DeletedUser'
                        WHEN u.anonymous_mode_enabled = 1 THEN 'Anonymous' 
                        ELSE u.username 
                    END as username,
                    CASE 
                        WHEN u.deleted_at IS NOT NULL OR u.account_status = 'deactivated' THEN 'Deleted User'
                        WHEN u.anonymous_mode_enabled = 1 THEN 'Sparkle Student' 
                        ELSE u.name 
                    END as user_name,
                    CASE 
                        WHEN u.deleted_at IS NOT NULL OR u.account_status = 'deactivated' THEN '/uploads/avatars/deleted.png'
                        WHEN u.anonymous_mode_enabled = 1 THEN '/uploads/avatars/default.png' 
                        ELSE u.avatar_url 
                    END as avatar_url,

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
     * @param {number} seed
     * @param {string|string[]} excludeIds
     */
    static async getFeed(affiliation, currentUserId, limit = 20, offset = 0, seed = 0, excludeIds = [], mode = 'for_you', cursor = null) {
        const algorithmEnabled = true; 

        let cursorCondition = '';
        let cursorParams = [];

        if (cursor) {
            // Find the created_at of the cursor post
            const [cursorPost] = await pool.query('SELECT created_at FROM posts WHERE post_id = ?', [cursor]);
            if (cursorPost.length > 0) {
                cursorCondition = 'AND p.created_at < ?';
                cursorParams.push(cursorPost[0].created_at);
            }
        }

        if (!algorithmEnabled) {
            // --- BASIC STABLE FEED LOGIC ---
            try {
                let whereClause = `(p.scheduled_at IS NULL OR p.scheduled_at <= NOW())
                                  AND (p.campus = ? OR p.post_type = 'public' OR p.campus IS NULL OR ? = 'all')
                                  ${cursorCondition}`;
                const params = [currentUserId, currentUserId, currentUserId, affiliation, affiliation, ...cursorParams];

                const feedQuery = `
                    SELECT p.*, u.username, u.name as user_name, u.avatar_url,
                           u.campus as user_affiliation,
                           (SELECT COUNT(*) FROM sparks s WHERE s.post_id = p.post_id) as sparks,
                           (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id) as comments,
                           EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = p.user_id) as is_followed,
                           EXISTS(SELECT 1 FROM sparks WHERE user_id = ? AND post_id = p.post_id) as is_sparked
                    FROM posts p 
                    JOIN users u ON p.user_id = u.user_id 
                    WHERE ${whereClause}
                    ORDER BY p.created_at DESC
                    LIMIT ? OFFSET ?`;
                
                params.push(Number(limit) || 20);
                params.push(Number(offset) || 0);
                const [posts] = await pool.query(feedQuery, params);
                return posts || [];
            } catch (err) {
                console.error('Basic Feed Error:', err);
                return [];
            }
        }

        // --- ALGORITHM 7.7 (STABLE OFFSET-BASED ENGINE) ---
        try {
            const redisService = require('../services/redis.service');
            const cacheKey = `feed_cache_raw:${currentUserId}:${affiliation}:${mode}:${seed}:${offset}:${limit}`;
            
            // Try to serve from raw cache first
            const cached = await redisService.get(cacheKey);
            if (cached && !excludeIds.length) {
                return Array.isArray(cached) ? cached : [];
            }

            // 1. DUAL-MEMORY INTEREST MODEL
            const [recentActions] = await pool.query(`
                SELECT DISTINCT p.category FROM posts p
                JOIN user_actions ua ON p.post_id = ua.post_id
                WHERE ua.user_id = ? AND ua.action_type IN ('click', 'like', 'dwell', 'share')
                ORDER BY ua.created_at DESC LIMIT 10
            `, [currentUserId]).catch(() => [[]]);
            
            const recentCategories = (recentActions || []).map(a => a.category).filter(Boolean);
            
            const [userProfile] = await pool.query('SELECT major, interests FROM users WHERE user_id = ?', [currentUserId]).catch(() => [[]]);
            const staticInterests = (userProfile[0]?.interests || userProfile[0]?.major || '').toLowerCase().split(/[,\s]+/).filter(Boolean);

            const excluded = Array.isArray(excludeIds) ? excludeIds : (typeof excludeIds === 'string' && excludeIds ? excludeIds.split(',') : []);
            const excludeFilter = excluded.length > 0 ? `AND p.post_id NOT IN (${excluded.map(() => '?').join(',')})` : '';

            // 1.5 PRE-FETCH SPARKED IDS (Optimization)
            const [sparkedRows] = await pool.query('SELECT post_id FROM sparks WHERE user_id = ?', [currentUserId]).catch(() => [[]]);
            const sparkedIds = new Set((sparkedRows || []).map(r => r.post_id));

            // 2. CANDIDATE RETRIEVAL & SCORING (v2.1)
            const query = `
                SELECT p.*, u.username, u.name as user_name, u.avatar_url,
                        u.campus as user_affiliation,
                        p.spark_count as sparks,
                        p.comment_count as comments,
                        (SELECT JSON_ARRAYAGG(JSON_OBJECT('url', pm.media_url, 'type', pm.media_type)) 
                         FROM post_media pm WHERE pm.post_id = p.post_id ORDER BY pm.upload_order ASC) as media_files,
                        f.follower_id IS NOT NULL as is_followed,
                        
                        -- v2.1 PRODUCTION RANKING ALGORITHM
                        (
                            -- 1. Normalized Engagement (Prevent rich-get-richer)
                            ((COALESCE(p.spark_count, 0) * 5.0 + COALESCE(p.comment_count, 0) * 10.0 + COALESCE(p.share_count, 0) * 15.0 + 1.0) 
                            / (COALESCE(p.view_count, 0) + 10.0))
                            *
                            -- 2. Affinity (Following = 1.5x, Campus = 1.2x)
                            (CASE 
                                WHEN p.user_id = ? THEN 0.05 -- Self-Post Penalty (v2.1)
                                WHEN f.follower_id IS NOT NULL THEN 1.5
                                WHEN p.campus = ? THEN 1.2
                                ELSE 1.0
                            END)
                            *
                            -- 3. Balanced Time Decay (Gravity adjusted for better stability)
                            (1.0 / POW(TIMESTAMPDIFF(HOUR, p.created_at, NOW()) + 2, 0.8))
                        ) + (RAND(?) * 0.02) as discovery_score

                 FROM posts p 
                 JOIN users u ON p.user_id = u.user_id 
                 LEFT JOIN follows f ON f.follower_id = ? AND f.following_id = p.user_id
                 WHERE p.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY) -- Candidate Pool Limit (Crucial for Speed)
                   AND (p.scheduled_at IS NULL OR p.scheduled_at <= NOW())
                   AND (p.campus = ? OR p.post_type = 'public' OR p.campus IS NULL OR ? = 'all')
                   ${excludeFilter}
                   ${cursorCondition}
                   AND NOT EXISTS (SELECT 1 FROM user_blocks WHERE (blocker_id = ? AND blocked_id = p.user_id) OR (blocker_id = p.user_id AND blocked_id = ?))
                   AND (p.user_id = ? OR p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?) OR (u.is_private = 0 AND (u.profile_visibility IS NULL OR u.profile_visibility != 'private')))
                 ORDER BY discovery_score DESC, p.created_at DESC
                 LIMIT ? OFFSET ?`;

            const params = [
                currentUserId, // Penalty (288)
                affiliation,   // Campus Score (290)
                seed,          // RAND (296)
                currentUserId, // LEFT JOIN follows (300)
                affiliation, affiliation, // Campus Filter (303)
                ...excluded,   // (304)
                ...cursorParams, // (305)
                currentUserId, currentUserId, // Blocks (306)
                currentUserId, currentUserId, // Following/Visibility (307)
                Number(limit) || 10,
                Number(offset) || 0
            ];

            const [posts] = await pool.query(query, params);
            
            // 3. DIVERSITY LAYER (Post-Processing)
            let filteredPosts = (posts || []).map(p => ({
                ...p,
                is_sparked: sparkedIds.has(p.post_id) ? 1 : 0
            }));
            
            let finalResults = [];
            let lastCreatorId = null;
            let pool_posts = [...filteredPosts];
            
            while (pool_posts.length > 0) {
                let index = pool_posts.findIndex(p => p.user_id !== lastCreatorId);
                if (index === -1) index = 0; 
                
                let post = pool_posts.splice(index, 1)[0];
                lastCreatorId = post.user_id;
                
                if (typeof post.media_files === 'string') {
                    try { post.media_files = JSON.parse(post.media_files); } catch(e) { post.media_files = []; }
                }
                if (!Array.isArray(post.media_files)) post.media_files = [];

                if (typeof post.liker_avatars === 'string') {
                    post.liker_avatars = post.liker_avatars.split(',').slice(0, 3);
                }
                if (!Array.isArray(post.liker_avatars)) post.liker_avatars = [];
                
                finalResults.push(post);
            }

            // Cache result for 2 minutes to prevent hammering during active scroll sessions
            if (finalResults.length > 0) {
                await redisService.set(cacheKey, finalResults, 120);
            }

            return finalResults;
        } catch (err) {
            console.error('Algorithm 7.7 Critical Failure:', err.message);
            
            // FAIL-SAFE: Return recent public posts
            try {
                const [fallback] = await pool.query(
                    `SELECT p.*, u.username, u.name as user_name, u.avatar_url, 
                            p.spark_count as sparks, p.comment_count as comments
                     FROM posts p JOIN users u ON p.user_id = u.user_id 
                     WHERE p.post_type = 'public' ORDER BY p.created_at DESC LIMIT ?`,
                    [Number(limit) || 20]
                );
                
                return (fallback || []).map(p => ({
                    ...p,
                    media_files: [],
                    liker_avatars: []
                }));
            } catch (fallbackErr) {
                return [];
            }
        }
    }

    /**
     * Delta Update: Fetch only posts created since a specific timestamp
     */
    static async getDeltaPosts(affiliation, currentUserId, since) {
        try {
            const query = `
                SELECT p.*, u.username, u.name as user_name, u.avatar_url,
                        u.campus as user_affiliation,
                        (SELECT COUNT(*) FROM sparks s WHERE s.post_id = p.post_id) as sparks,
                        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id) as comments,
                        (SELECT JSON_ARRAYAGG(JSON_OBJECT('url', pm.media_url, 'type', pm.media_type)) 
                         FROM post_media pm WHERE pm.post_id = p.post_id ORDER BY pm.upload_order ASC) as media_files,
                        EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = p.user_id) as is_followed,
                        EXISTS(SELECT 1 FROM sparks WHERE user_id = ? AND post_id = p.post_id) as is_sparked
                 FROM posts p 
                 JOIN users u ON p.user_id = u.user_id 
                 WHERE p.created_at > ?
                   AND (p.scheduled_at IS NULL OR p.scheduled_at <= NOW())
                   AND (p.campus = ? OR p.post_type = 'public' OR p.campus IS NULL OR ? = 'all')
                   AND NOT EXISTS (SELECT 1 FROM user_blocks WHERE (blocker_id = ? AND blocked_id = p.user_id) OR (blocker_id = p.user_id AND blocked_id = ?))
                 ORDER BY p.created_at DESC
                 LIMIT 50`;

            const [posts] = await pool.query(query, [
                currentUserId, currentUserId, 
                since, 
                affiliation, affiliation, 
                currentUserId, currentUserId
            ]);

            return (posts || []).map(post => {
                if (typeof post.media_files === 'string') {
                    try { post.media_files = JSON.parse(post.media_files); } catch(e) { post.media_files = []; }
                }
                return post;
            });
        } catch (err) {
            console.error('Delta Sync Error:', err);
            return [];
        }
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
               AND (p.scheduled_at IS NULL OR p.scheduled_at <= NOW())
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
               AND (p.scheduled_at IS NULL OR p.scheduled_at <= NOW() OR p.user_id = ?)
             ORDER BY p.created_at DESC 
             LIMIT ?`,
            [userId, currentUserId, limit]
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
                   CASE 
                       WHEN u.deleted_at IS NOT NULL OR u.account_status = 'deactivated' THEN 'DeletedUser'
                       WHEN u.anonymous_mode_enabled = 1 THEN 'Anonymous' 
                       ELSE u.username 
                   END as username,
                   CASE 
                       WHEN u.deleted_at IS NOT NULL OR u.account_status = 'deactivated' THEN 'Deleted User'
                       WHEN u.anonymous_mode_enabled = 1 THEN 'Sparkle Student' 
                       ELSE u.name 
                   END as name,
                   CASE 
                       WHEN u.deleted_at IS NOT NULL OR u.account_status = 'deactivated' THEN '/uploads/avatars/deleted.png'
                       WHEN u.anonymous_mode_enabled = 1 THEN '/uploads/avatars/default.png' 
                       ELSE u.avatar_url 
                   END as avatar_url,

                   (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.comment_id) as like_count
                   ${currentUserId ? `, (SELECT 1 FROM comment_likes cl2 WHERE cl2.comment_id = c.comment_id AND cl2.user_id = ?) as is_liked ` : ''}
            FROM comments c
            JOIN users u ON c.user_id = u.user_id
            WHERE c.post_id = ?
            ORDER BY c.created_at ASC
        `;

        const finalParams = currentUserId ? [currentUserId, postId] : [postId];

        const [comments] = await pool.query(query, finalParams);
        
        // Build comment tree
        const commentMap = new Map();
        const rootComments = [];

        // First pass: map all comments and add a replies array
        comments.forEach(c => {
            c.replies = [];
            commentMap.set(c.comment_id, c);
        });

        // Second pass: attach replies to their parents
        comments.forEach(c => {
            if (c.parent_comment_id && commentMap.has(c.parent_comment_id)) {
                commentMap.get(c.parent_comment_id).replies.push(c);
            } else {
                rootComments.push(c);
            }
        });

        return rootComments;
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
        // --- NEW: Check if comments are enabled (Algorithm 15.6) ---
        const [posts] = await pool.query('SELECT comments_enabled, user_id FROM posts WHERE post_id = ?', [postId]);
        if (posts.length > 0 && posts[0].comments_enabled === 0) {
            throw new Error('Comments are disabled for this post.');
        }

        const commentId = crypto.randomUUID();
        await pool.query(
            'INSERT INTO comments (comment_id, post_id, user_id, content, parent_comment_id) VALUES (?, ?, ?, ?, ?)',
            [commentId, postId, userId, content, parentId]
        );

        // --- NEW: Mentions Notification (Algorithm 15.11) ---
        const mentions = content.match(/@(\w+)/g);
        if (mentions) {
            const User = require('./User'); // Lazy load to avoid circular dependency
            for (const mention of mentions) {
                const username = mention.substring(1);
                const mentionedUser = await User.findByUsername(username);
                if (mentionedUser && mentionedUser.user_id !== userId) {
                    // Create notification logic would go here
                    // e.g., Notification.create(...)
                    console.log(`Mentioned user ${username} (${mentionedUser.user_id}) in post ${postId}`);
                }
            }
        }

        await pool.query(
            'UPDATE posts SET comment_count = comment_count + 1 WHERE post_id = ?',
            [postId]
        );

        return { commentId, success: true };
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

    static async getTrendingHashtags(limit = 10, intervalHours = 24) {
        const query = `
            SELECT ph.tag, COUNT(*) as count
            FROM post_hashtags ph
            JOIN posts p ON ph.post_id = p.post_id
            WHERE p.created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)
            GROUP BY ph.tag
            ORDER BY count DESC
            LIMIT ?
        `;
        const [rows] = await pool.query(query, [intervalHours, limit]);
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
        try {
            const [origPost] = await pool.query('SELECT user_id FROM posts WHERE post_id = ?', [originalPostId]);
            if (origPost.length > 0 && origPost[0].user_id !== userId) {
                await pool.query(
                    `INSERT INTO notifications (notification_id, user_id, type, actor_id, target_id) 
                     VALUES (?, ?, 'share', ?, ?)`,
                    [crypto.randomUUID(), origPost[0].user_id, userId, originalPostId]
                );
            }
        } catch(e) {
            console.error('Failed to notify author of reshare', e);
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
                    try {
                        const username = mention.substring(1);
                        const [user] = await pool.query('SELECT user_id FROM users WHERE username = ?', [username]);
                        if (user.length > 0) {
                            await pool.query(
                                `INSERT INTO notifications (notification_id, user_id, type, actor_id, target_id) 
                                 VALUES (?, ?, 'mention', ?, ?)`,
                                [crypto.randomUUID(), user[0].user_id, userId, originalPostId]
                            );
                        }
                    } catch (e) {
                        console.error('Failed to notify mentioned user in reshare', e);
                    }
                }
            }
        }

        return { action: 'reposted', repostId };
    }

    static async updateReshareComment(userId, postId, comment) {
        await pool.query(
            'UPDATE reposts SET comment = ? WHERE user_id = ? AND post_id = ?',
            [comment, userId, postId]
        );
        return { success: true };
    }

    static async recordAction(userId, postId, actionType, value = 1.0) {
        try {
            // First get the creator_id
            const [post] = await pool.query('SELECT user_id FROM posts WHERE post_id = ?', [postId]);
            if (!post.length) return;
            
            const creatorId = post[0].user_id;
            const actionId = crypto.randomUUID();

            const query = `
                INSERT INTO user_actions (action_id, user_id, post_id, creator_id, action_type, action_value)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                action_value = action_value + VALUES(action_value),
                created_at = CURRENT_TIMESTAMP
            `;
            await pool.query(query, [actionId, userId, postId, creatorId, actionType, value]);

        } catch (err) {
            console.error('Error recording action:', err);
        }
    }
}

module.exports = Post;
