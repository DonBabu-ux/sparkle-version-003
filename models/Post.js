const pool = require('../config/database');
const crypto = require('crypto');
const redisService = require('../services/redis.service');

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
            `INSERT INTO posts (post_id, user_id, content, media_url, media_type, post_type, campus, group_id, location, scheduled_at, comments_enabled, category, feeling, activity, tagged_users) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                category,
                postData.feeling || null,
                postData.activity || null,
                postData.tagged_users ? (typeof postData.tagged_users === 'string' ? postData.tagged_users : JSON.stringify(postData.tagged_users)) : null
            ]
        );

        // Notify tagged users
        if (postData.tagged_users) {
            const users = typeof postData.tagged_users === 'string' ? JSON.parse(postData.tagged_users) : postData.tagged_users;
            const notificationController = require('../controllers/notification.controller');
            for (const u of users) {
                if (u.user_id !== userId) {
                    await notificationController.createNotification({
                        user_id: u.user_id,
                        actor_id: userId,
                        type: 'mention',
                        title: 'New Tag',
                        content: `tagged you in a post: "${postData.content.substring(0, 30)}${postData.content.length > 30 ? '...' : ''}"`,
                        related_id: postId,
                        related_type: 'post',
                        action_url: `/post/${postId}`
                    }).catch(err => console.error('Tag notification failed:', err));
                }
            }
        }



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
            const broadcastKeywords = ['everyone', 'followers', 'recent', 'highlight'];

            for (let mention of mentions) {
                const username = mention.substring(1).toLowerCase();

                // 1. Handle Broadcast Keywords
                if (broadcastKeywords.includes(username)) {
                    let targetUserIds = [];
                    let broadcastTitle = 'System Highlight';
                    let broadcastContent = `mentioned ${username} in a post`;

                    if (username === 'everyone') {
                        // Notify all users in the same campus/affiliation
                        const [campusUsers] = await pool.query('SELECT user_id FROM users WHERE campus = (SELECT campus FROM users WHERE user_id = ?) AND user_id != ?', [actorId, actorId]);
                        targetUserIds = campusUsers.map(u => u.user_id);
                        broadcastTitle = 'Broadcast: Everyone';
                    } else if (username === 'followers') {
                        // Notify all followers
                        const [followers] = await pool.query('SELECT follower_id FROM follows WHERE following_id = ?', [actorId]);
                        targetUserIds = followers.map(f => f.follower_id);
                        broadcastTitle = 'Broadcast: Followers';
                    } else if (username === 'recent') {
                        // Notify users with recent interactions (sparks/comments on actor's posts)
                        const [recentActives] = await pool.query(`
                            SELECT DISTINCT user_id FROM (
                                SELECT user_id FROM sparks WHERE post_id IN (SELECT post_id FROM posts WHERE user_id = ?)
                                UNION
                                SELECT user_id FROM comments WHERE post_id IN (SELECT post_id FROM posts WHERE user_id = ?)
                            ) as interactions WHERE user_id != ? LIMIT 50
                        `, [actorId, actorId, actorId]);
                        targetUserIds = recentActives.map(u => u.user_id);
                        broadcastTitle = 'Broadcast: Recent';
                    } else if (username === 'highlight') {
                        // Special boost notification to random active users (Engagement Engine)
                        const [luckyUsers] = await pool.query('SELECT user_id FROM users WHERE user_id != ? AND is_online = 1 LIMIT 10', [actorId]);
                        targetUserIds = luckyUsers.map(u => u.user_id);
                        broadcastTitle = 'Sparkle Highlight';
                    }

                    // Send notifications in batches
                    for (const targetId of targetUserIds) {
                        try {
                            await notificationController.createNotification({
                                user_id: targetId,
                                actor_id: actorId,
                                type: 'mention',
                                title: broadcastTitle,
                                content: broadcastContent,
                                related_id: postId,
                                related_type: 'post',
                                action_url: `/post/${postId}`
                            });
                        } catch (_) { }
                    }
                    continue; // Skip standard user lookup for broadcast keywords
                }

                // 2. Handle Standard User Mentions
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
                                action_url: `/post/${postId}`
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
        let post = posts[0];
        
        // --- FALLBACK: Check Group Posts if not found in main posts table ---
        if (!post) {
            const [groupPosts] = await pool.query(
                `SELECT gp.*, gp.image_url as media_url, 'group' as post_type,
                        u.username, u.name as user_name, u.avatar_url,
                        (SELECT COUNT(*) FROM sparks s WHERE s.post_id = gp.post_id) as sparks
                 FROM group_posts gp
                 JOIN users u ON gp.user_id = u.user_id
                 WHERE gp.post_id = ?`,
                [postId]
            );
            post = groupPosts[0];
            
            if (post && post.image_url) {
                post.media_files = post.image_url.split(',').map(url => ({ url, type: 'image' }));
            }
        }

        if (post) {
            if (typeof post.media_files === 'string') {
                try { post.media_files = JSON.parse(post.media_files); } catch(e) { post.media_files = []; }
            }
            if (!Array.isArray(post.media_files)) post.media_files = post.media_files ? [post.media_files] : [];
            
            if (typeof post.resharer_avatars === 'string') {
                try { post.resharer_avatars = JSON.parse(post.resharer_avatars); } catch(e) { post.resharer_avatars = []; }
            }
        }
        return post || null;
    }

    /**
     * Update an existing post
     */
    static async update(postId, userId, updates) {
        // Verify ownership
        const [existing] = await pool.query('SELECT user_id FROM posts WHERE post_id = ?', [postId]);
        if (existing.length === 0 || existing[0].user_id !== userId) {
            return false;
        }

        const allowedFields = ['content', 'post_type', 'feeling', 'activity', 'tagged_users', 'media_url', 'media_type'];
        const updateEntries = [];
        const params = [];

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                updateEntries.push(`${field} = ?`);
                if (field === 'tagged_users' && typeof updates[field] !== 'string') {
                    params.push(JSON.stringify(updates[field]));
                } else {
                    params.push(updates[field]);
                }
            }
        }

        if (updateEntries.length > 0) {
            params.push(postId);
            await pool.query(
                `UPDATE posts SET ${updateEntries.join(', ')} WHERE post_id = ?`,
                params
            );
        }

        // Handle multi-media update if provided
        if (updates.media && Array.isArray(updates.media)) {
            // Remove existing media
            await pool.query('DELETE FROM post_media WHERE post_id = ?', [postId]);
            
            // Add new media
            for (let i = 0; i < updates.media.length; i++) {
                const m = updates.media[i];
                await pool.query(
                    'INSERT INTO post_media (media_id, post_id, media_url, media_type, upload_order) VALUES (?, ?, ?, ?, ?)',
                    [crypto.randomUUID(), postId, m.url, m.type || 'image', i]
                );
            }
            
            // Update main media_url if not explicitly provided in updates
            if (!updates.media_url && updates.media.length > 0) {
                await pool.query('UPDATE posts SET media_url = ?, media_type = ? WHERE post_id = ?', [
                    updates.media[0].url,
                    updates.media[0].type || 'image',
                    postId
                ]);
            } else if (updates.media.length === 0) {
                 await pool.query('UPDATE posts SET media_url = NULL, media_type = NULL WHERE post_id = ?', [postId]);
            }
        }

        // Handle tagging/mentions if content changed
        if (updates.content) {
            await pool.query('DELETE FROM post_hashtags WHERE post_id = ?', [postId]);
            await this.extractAndSaveTags(postId, updates.content, userId);
        }

        return true;
    }

    /**
     * Behavioral Ranking System (Algorithm 8.1)
     */
    static sigmoid(x) {
        return 1 / (1 + Math.exp(-x));
    }

    static calculateCategoryAffinity(stats) {
        if (!stats) return 1.0;
        
        // weights: likes: +2.0, dwell: +1.5, replays: +1.8, skips: -2.5
        const rawScore = (stats.likes || 0) * 2.0 + 
                         (stats.dwell || 0) * 0.05 + // normalize dwell (seconds)
                         (stats.replays || 0) * 1.8 - 
                         (stats.skips || 0) * 2.5;
        
        // Normalize using sigmoid to range 0.8 -> 1.6
        return 0.8 + (this.sigmoid(rawScore / 10) * 0.8);
    }

    static calculateDwellScore(watchTime, duration) {
        if (!duration || duration <= 0) return 1.0;
        const completion = watchTime / duration;
        if (completion >= 0.9) return 1.3;
        if (completion >= 0.7) return 1.15;
        if (completion >= 0.4) return 1.0;
        return 0.75;
    }

    static calculateSkipPenalty(watchTime, duration) {
        if (!duration || duration <= 0) return 1.0;
        const completion = watchTime / duration;
        if (completion < 0.2) return 0.6;
        if (completion < 0.4) return 0.8;
        return 1.0;
    }

    static calculateReplayBoost(replays) {
        if (!replays || replays <= 0) return 1.0;
        if (replays >= 2) return 1.25;
        return 1.1;
    }

    static calculateTrendBoost(category, recentCategories) {
        if (!category || !recentCategories || recentCategories.length === 0) return 1.0;
        const occurrences = recentCategories.filter(c => c === category).length;
        if (occurrences >= 8) return 1.3;
        if (occurrences >= 5) return 1.15;
        return 1.0;
    }

    static async getCategoryStats(userId) {
        const redisKey = `user:${userId}:category_stats`;
        
        // 1. Try Redis Feature Store (O(1))
        const cachedStats = await redisService.hgetall(redisKey);
        if (cachedStats && Object.keys(cachedStats).length > 0) {
            // Redis returns flat hash, we need to parse it if needed (not needed for simple counters)
            const stats = {};
            Object.entries(cachedStats).forEach(([field, value]) => {
                const [category, type] = field.split(':');
                if (!stats[category]) stats[category] = { likes: 0, dwell: 0, skips: 0, replays: 0 };
                stats[category][type] = parseFloat(value);
            });
            return stats;
        }

        // 2. Fallback to SQL with Exponential Decay (Algorithm 8.6)
        const [rows] = await pool.query(`
            SELECT p.category, 
                   SUM(CASE WHEN ua.action_type = 'like' THEN (1.0 * EXP(-0.1 * TIMESTAMPDIFF(HOUR, ua.created_at, NOW()))) ELSE 0 END) as likes,
                   SUM(CASE WHEN ua.action_type = 'dwell' THEN (ua.action_value * EXP(-0.1 * TIMESTAMPDIFF(HOUR, ua.created_at, NOW()))) ELSE 0 END) as dwell,
                   SUM(CASE WHEN ua.action_type = 'skip' THEN (1.0 * EXP(-0.1 * TIMESTAMPDIFF(HOUR, ua.created_at, NOW()))) ELSE 0 END) as skips,
                   SUM(CASE WHEN ua.action_type = 'replay' THEN (ua.action_value * EXP(-0.1 * TIMESTAMPDIFF(HOUR, ua.created_at, NOW()))) ELSE 0 END) as replays
            FROM user_actions ua
            JOIN posts p ON ua.post_id = p.post_id
            WHERE ua.user_id = ? AND ua.created_at > NOW() - INTERVAL 7 DAY
            GROUP BY p.category
        `, [userId]).catch(() => [[]]);
        
        const stats = {};
        rows.forEach(r => {
            stats[r.category] = {
                likes: r.likes,
                dwell: r.dwell,
                skips: r.skips,
                replays: r.replays
            };
            
            // Seed Redis Feature Store in background
            if (r.category) {
                redisService.hincrbyfloat(redisKey, `${r.category}:likes`, r.likes).catch(() => {});
                redisService.hincrbyfloat(redisKey, `${r.category}:dwell`, r.dwell).catch(() => {});
                redisService.hincrbyfloat(redisKey, `${r.category}:skips`, r.skips).catch(() => {});
                redisService.hincrbyfloat(redisKey, `${r.category}:replays`, r.replays).catch(() => {});
            }
        });
        
        // Set TTL on feature store
        redisService.expire(redisKey, 86400).catch(() => {}); // 24h
        
        return stats;
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
                    WHERE ${whereClause} AND p.group_id IS NULL
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
            const cacheKey = `feed_cache_raw:${currentUserId}:${affiliation}:${mode}:${seed}:${offset}:${limit}`;
            
            // Try to serve from raw cache first
            const cached = await redisService.get(cacheKey);
            if (cached && !excludeIds.length) {
                return Array.isArray(cached) ? cached : [];
            }

            // 1. DUAL-MEMORY INTEREST MODEL
            const recentKey = `user:${currentUserId}:recent_categories`;
            
            // Try Redis first for session intent
            let recentCategories = await redisService.lrange(recentKey, 0, 19);
            
            if (!recentCategories || recentCategories.length === 0) {
                const [recentActions] = await pool.query(`
                    SELECT p.category FROM posts p
                    JOIN user_actions ua ON p.post_id = ua.post_id
                    WHERE ua.user_id = ?
                    ORDER BY ua.created_at DESC LIMIT 20
                `, [currentUserId]).catch(() => [[]]);
                
                recentCategories = (recentActions || []).map(a => a.category).filter(Boolean);
                
                // Warm the list cache
                if (recentCategories.length > 0) {
                    redisService.lpush(recentKey, ...recentCategories).catch(() => {});
                    redisService.expire(recentKey, 3600).catch(() => {});
                }
            }
            
            const categoryStats = await this.getCategoryStats(currentUserId);
            
            const [userProfile] = await pool.query('SELECT major, interests FROM users WHERE user_id = ?', [currentUserId]).catch(() => [[]]);
            const staticInterests = (userProfile[0]?.interests || userProfile[0]?.major || '').toLowerCase().split(/[,\s]+/).filter(Boolean);

            const excluded = Array.isArray(excludeIds) ? excludeIds : (typeof excludeIds === 'string' && excludeIds ? excludeIds.split(',') : []);
            const excludeFilter = excluded.length > 0 ? `AND p.post_id NOT IN (${excluded.map(() => '?').join(',')})` : '';

            // 1.5 PRE-FETCH SPARKED IDS (Optimization)
            const [sparkedRows] = await pool.query('SELECT post_id FROM sparks WHERE user_id = ?', [currentUserId]).catch(() => [[]]);
            const sparkedIds = new Set((sparkedRows || []).map(r => r.post_id));

            // 2. CANDIDATE RETRIEVAL & SCORING (v2.1) - MOVED OFF DB TO REDIS + IN-MEMORY
            let candidatePool = await redisService.get('feed:candidate_pool');
            
            // Fallback if cron job hasn't run or Redis is down
            if (!candidatePool || candidatePool.length === 0) {
                const [fallbackPosts] = await pool.query(`
                    SELECT p.*, u.username, u.name as user_name, u.avatar_url,
                           u.campus as user_affiliation, u.is_private, u.profile_visibility,
                           COALESCE(p.spark_count, 0) as sparks,
                           COALESCE(p.comment_count, 0) as comments,
                           COALESCE(p.share_count, 0) as shares,
                           COALESCE(p.view_count, 0) as views,
                           (SELECT JSON_ARRAYAGG(JSON_OBJECT('url', pm.media_url, 'type', pm.media_type)) 
                            FROM post_media pm WHERE pm.post_id = p.post_id ORDER BY pm.upload_order ASC) as media_files
                    FROM posts p JOIN users u ON p.user_id = u.user_id
                    WHERE p.created_at > NOW() - INTERVAL 30 DAY
                    AND (p.scheduled_at IS NULL OR p.scheduled_at <= NOW())
                    AND p.group_id IS NULL
                    ORDER BY p.created_at DESC LIMIT 500
                `);
                candidatePool = fallbackPosts || [];
            }

            // 2.1 Fetch Lightweight User Context (O(1) lookups instead of heavy JOINs)
            const [follows] = await pool.query('SELECT following_id FROM follows WHERE follower_id = ?', [currentUserId]).catch(() => [[]]);
            const followingIds = new Set((follows || []).map(f => f.following_id));

            const [blocks] = await pool.query('SELECT blocked_id, blocker_id FROM user_blocks WHERE blocker_id = ? OR blocked_id = ?', [currentUserId, currentUserId]).catch(() => [[]]);
            const blockedUserIds = new Set();
            (blocks || []).forEach(b => {
                blockedUserIds.add(b.blocked_id);
                blockedUserIds.add(b.blocker_id);
            });

            const excludeSet = new Set(excluded);
            const cursorDate = (cursorParams && cursorParams.length > 0) ? new Date(cursorParams[0]).getTime() : null;

            // 2.2 Filter and Score In-Memory
            let scoredPosts = [];
            for (let post of candidatePool) {
                // Filters
                if (excludeSet.has(post.post_id)) continue;
                if (blockedUserIds.has(post.user_id)) continue;
                if (cursorDate && new Date(post.created_at).getTime() >= cursorDate) continue;
                
                // --- EXCLUDE GROUP POSTS FROM HOME FEED ---
                if (post.group_id) continue;
                
                // Privacy check
                if (post.post_type !== 'public' && post.user_id !== currentUserId && !followingIds.has(post.user_id)) {
                    if (post.campus !== affiliation && affiliation !== 'all') continue;
                    if (post.is_private === 1 || post.profile_visibility === 'private') continue;
                }

                // --- NEW: ADAPTIVE BEHAVIORAL SCORING ---
                const stats = categoryStats[post.category] || {};
                const categoryAffinity = this.calculateCategoryAffinity(stats);
                const trendBoost = this.calculateTrendBoost(post.category, recentCategories);
                
                // Base Engagement (Algorithm 7.7)
                const sparks = Number(post.sparks) || 0;
                const comments = Number(post.comments) || 0;
                const shares = Number(post.shares) || 0;
                const views = Number(post.views) || 0;
                const engagement = (sparks * 3 + comments * 5 + shares * 10) / (views + 10);
                
                // Time Decay (Algorithm 7.7) - Higher lambda = faster decay
                const ageHours = (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60);
                const lambda = 0.1;
                const timeDecay = Math.exp(-lambda * ageHours);
                
                const affinity = followingIds.has(post.user_id) ? 1.5 : 1.0;
                const randomFactor = Math.random() * 0.05;

                let dwellScore = 1.0;
                let skipPenalty = 1.0;
                let replayBoost = 1.0;
                
                // Final Score Formula
                post.discovery_score = (engagement * affinity * timeDecay) + randomFactor;
                
                // --- FATIGUE PENALTY (Algorithm 9.3) ---
                const recentCount = recentCategories.filter(c => c === post.category).length;
                const fatigue = recentCount / 20.0;
                const fatigueMultiplier = fatigue > 0.6 ? 0.85 : 1.0;

                post.final_score = post.discovery_score * categoryAffinity * trendBoost * dwellScore * skipPenalty * replayBoost * fatigueMultiplier;
                
                // --- NEW: GUIDED EXPLORATION (Algorithm 9.4) ---
                // Boost high-quality content outside the user's main interests to broaden horizons
                if (Math.random() < 0.10) {
                    if (post.discovery_score > 0.15 && categoryAffinity < 1.1) {
                        post.final_score *= (1.3 + Math.random() * 0.5); 
                        post.is_exploration = true;
                    }
                }

                post.is_followed = followingIds.has(post.user_id);
                
                scoredPosts.push(post);
            }

            // 2.3 Sort and Paginate
            scoredPosts.sort((a, b) => b.final_score - a.final_score || new Date(b.created_at) - new Date(a.created_at));

            // --- SATURATION CONTROL (Algorithm 9.5) ---
            // Ensure category diversity in the final batch
            let categoryCounts = {};
            scoredPosts.forEach(p => {
                const cat = p.category || 'unknown';
                categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
                const saturation = categoryCounts[cat] / scoredPosts.length;
                if (saturation > 0.4) {
                    p.final_score *= 0.8; // Apply penalty for over-saturation
                }
            });

            // Re-sort after saturation penalty
            scoredPosts.sort((a, b) => b.final_score - a.final_score);
            
            const limitNum = Number(limit) || 10;
            const offsetNum = Number(offset) || 0;
            const posts = scoredPosts.slice(offsetNum, offsetNum + limitNum);
            
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

            // Cache result for 60 seconds to prevent hammering during active scroll sessions
            if (finalResults.length > 0) {
                await redisService.set(cacheKey, finalResults, 60);
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
                   AND p.group_id IS NULL
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
               AND p.group_id IS NULL
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
        const { acquireActionLock } = require('../utils/actionGuard');
        const allowed = await acquireActionLock(userId, postId, 'spark_post', 2);
        if (!allowed) {
            return { success: true, action: 'deduped', deduped: true };
        }

        const sparkId = crypto.randomUUID();
        try {
            await pool.query(
                'INSERT INTO sparks (spark_id, user_id, post_id) VALUES (?, ?, ?)',
                [sparkId, userId, postId]
            );
            
            // Only update count if post exists in 'posts' table
            await pool.query(
                'UPDATE posts SET spark_count = spark_count + 1 WHERE post_id = ?',
                [postId]
            ).catch(() => {}); // Ignore if post is in group_posts instead

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
                ).catch(() => {}); // Ignore if post is in group_posts instead
                return { success: true, action: 'unsparked' };
            }
            throw error;
        }
    }

    /**
     * Get post comments with advanced sorting modes
     */
    static async getComments(postId, currentUserId = null, sortMode = 'relevant') {
        const selectParams = [];
        const whereParams = [postId];
        const sortParams = [];

        if (currentUserId) {
            selectParams.push(currentUserId);
        }

        let sortExpression = '';
        switch (sortMode) {
            case 'newest':
                sortExpression = 'c.created_at';
                break;
            case 'engaging':
                sortExpression = '(COALESCE(c.like_count, 0) + (SELECT COUNT(*) FROM comments rc WHERE rc.parent_comment_id = c.comment_id) * 2.0)';
                break;
            case 'followers':
                if (currentUserId) {
                    sortExpression = `(EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.following_id = c.user_id) * 100.0) + (COALESCE(c.like_count, 0) * 1.5) + (1.0 / (POW(TIMESTAMPDIFF(HOUR, c.created_at, NOW()) + 2, 0.6)))`;
                    sortParams.push(currentUserId);
                } else {
                    sortExpression = 'c.created_at';
                }
                break;
            case 'smart':
                sortExpression = `(
                    ((COALESCE(c.like_count, 0) * 1.2) + (SELECT COUNT(*) FROM comments rc WHERE rc.parent_comment_id = c.comment_id) * 1.5) * 0.4 +
                    (1.0 / (POW(TIMESTAMPDIFF(HOUR, c.created_at, NOW()) + 2, 0.6))) * 0.3 +
                    ${currentUserId ? `(EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.following_id = c.user_id) * 10.0) * 0.2` : '0'} +
                    (RAND() * 5.0) * 0.1
                )`;
                if (currentUserId) sortParams.push(currentUserId);
                break;
            case 'all':
                sortExpression = 'UNIX_TIMESTAMP(c.created_at) * -1'; 
                break;
            case 'relevant':
            default:
                sortExpression = `(
                    (COALESCE(c.like_count, 0) * 1.5) + 
                    ((SELECT COUNT(*) FROM comments rc WHERE rc.parent_comment_id = c.comment_id) * 2.0) +
                    ${currentUserId ? `(EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.following_id = c.user_id) * 20.0)` : '0'} +
                    (10.0 / (POW(TIMESTAMPDIFF(HOUR, c.created_at, NOW()) + 2, 0.5)))
                )`;
                if (currentUserId) sortParams.push(currentUserId);
                break;
        }

        const query = `
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
            ORDER BY
                CASE WHEN c.parent_comment_id IS NULL THEN 1 ELSE 2 END ASC,
                CASE WHEN c.parent_comment_id IS NULL THEN ${sortExpression} END DESC,
                c.created_at ASC
            LIMIT 200
        `;

        const finalParams = [...selectParams, ...whereParams, ...sortParams];
        const [comments] = await pool.query(query, finalParams);
        
        // Build comment tree
        const commentMap = new Map();
        const rootComments = [];

        comments.forEach(c => {
            c.replies = [];
            commentMap.set(c.comment_id, c);
        });

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
        const { acquireActionLock } = require('../utils/actionGuard');
        const allowed = await acquireActionLock(userId, commentId, 'like_comment', 2);
        if (!allowed) {
            return { success: true, action: 'deduped', deduped: true };
        }

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
            const User = require('./User'); // Lazy load
            const uniqueMentions = [...new Set(mentions)];
            
            for (const mention of uniqueMentions) {
                const username = mention.substring(1).toLowerCase();
                
                // 1. Handle Special Mentions
                if (['everyone', 'followers', 'highlight'].includes(username)) {
                    // Notify all followers
                    const [followers] = await pool.query(
                        'SELECT follower_id FROM follows WHERE following_id = ?',
                        [userId]
                    );
                    for (const f of followers) {
                        if (f.follower_id === userId) continue;
                        await pool.query(
                            `INSERT INTO notifications (notification_id, user_id, type, actor_id, target_id, title, content) 
                             VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            [
                                crypto.randomUUID(), f.follower_id, 'mention', userId, postId, 
                                username === 'highlight' ? '✨ Post Highlight' : '📢 Community Alert',
                                `mentioned ${username} in a comment`
                            ]
                        ).catch(() => {});
                    }
                    continue;
                }

                if (username === 'recent') {
                    // Notify users from recent personal chats
                    const [recentContacts] = await pool.query(
                        `SELECT DISTINCT CASE WHEN participant1_id = ? THEN participant2_id ELSE participant1_id END as contact_id 
                         FROM personal_chats 
                         WHERE participant1_id = ? OR participant2_id = ?
                         ORDER BY last_message_time DESC LIMIT 10`,
                        [userId, userId, userId]
                    );
                    for (const c of recentContacts) {
                        if (!c.contact_id || c.contact_id === userId) continue;
                        await pool.query(
                            `INSERT INTO notifications (notification_id, user_id, type, actor_id, target_id, title, content) 
                             VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            [
                                crypto.randomUUID(), c.contact_id, 'mention', userId, postId, 
                                '🕒 Recent Catch-up',
                                `mentioned you in a recent catch-up mention`
                            ]
                        ).catch(() => {});
                    }
                    continue;
                }

                // 2. Handle Individual Mentions
                const mentionedUser = await User.findByUsername(username);
                if (mentionedUser && mentionedUser.user_id !== userId) {
                    await pool.query(
                        `INSERT INTO notifications (notification_id, user_id, type, actor_id, target_id, title, content) 
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            crypto.randomUUID(), mentionedUser.user_id, 'mention', userId, postId, 
                            'New Mention',
                            `mentioned you in a comment`
                        ]
                    ).catch(() => {});
                }
            }
        }

        await pool.query(
            'UPDATE posts SET comment_count = comment_count + 1 WHERE post_id = ?',
            [postId]
        ).catch(() => {}); // Ignore if post is in group_posts instead

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
        const { acquireActionLock } = require('../utils/actionGuard');
        const allowed = await acquireActionLock(userId, postId, 'save_post', 2);
        if (!allowed) {
            return { success: true, action: 'deduped', deduped: true };
        }

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

    static async getCategoryStats(userId) {
        try {
            const statsKey = `user:${userId}:category_stats`;
            
            // 1. Try Redis Feature Store (O(1))
            const cachedStats = await redisService.hgetall(statsKey);
            if (cachedStats && Object.keys(cachedStats).length > 0) {
                // Parse "Category:Action" -> value
                const stats = {};
                for (const [key, val] of Object.entries(cachedStats)) {
                    const [category, action] = key.split(':');
                    if (!stats[category]) stats[category] = {};
                    stats[category][action] = parseFloat(val);
                }
                return stats;
            }

            // 2. Fallback to SQL (Aggregation)
            const [rows] = await pool.query(`
                SELECT p.category, ua.action_type, SUM(ua.action_value) as total_value
                FROM user_actions ua
                JOIN posts p ON ua.post_id = p.post_id
                WHERE ua.user_id = ?
                GROUP BY p.category, ua.action_type
            `, [userId]);

            const stats = {};
            rows.forEach(row => {
                if (!stats[row.category]) stats[row.category] = {};
                stats[row.category][row.action_type] = parseFloat(row.total_value);
                
                // Warm the cache while we're at it
                redisService.hset(statsKey, `${row.category}:${row.action_type}`, row.total_value).catch(() => {});
            });
            
            redisService.expire(statsKey, 86400).catch(() => {});
            return stats;
        } catch (err) {
            console.error('Error in getCategoryStats:', err);
            return {};
        }
    }

    static calculateCategoryAffinity(stats) {
        if (!stats) return 1.0;
        
        // Weights: Spark=3, Comment=5, Share=10, Dwell (per sec)=0.1
        const sparks = (stats.spark || 0) + (stats.like || 0);
        const comments = stats.comment || 0;
        const shares = stats.share || 0;
        const dwell = stats.dwell || 0;
        const skips = stats.skip || 0;

        const score = (sparks * 0.5) + (comments * 0.8) + (shares * 1.2) + (dwell * 0.05);
        const penalty = skips * 0.3;
        
        // Return multiplier (capped between 0.5 and 2.5)
        return Math.min(2.5, Math.max(0.5, 1.0 + (score - penalty) / 100));
    }

    static calculateTrendBoost(category, recentCategories) {
        if (!recentCategories || recentCategories.length === 0) return 1.0;
        
        // Count occurrences of this category in the last 20 engagements
        const count = recentCategories.filter(c => c === category).length;
        
        // If > 25% of recent activity is this category, give a 30% boost
        if (count / recentCategories.length > 0.25) return 1.3;
        if (count / recentCategories.length > 0.10) return 1.15;
        
        return 1.0;
    }

    static async recordAction(userId, postId, actionType, value = 1.0) {
        try {
            // First get the creator_id and category
            const [post] = await pool.query('SELECT user_id, category FROM posts WHERE post_id = ?', [postId]);
            if (!post.length) return;
            
            const creatorId = post[0].user_id;
            const category = post[0].category;
            const actionId = crypto.randomUUID();

            const query = `
                INSERT INTO user_actions (action_id, user_id, post_id, creator_id, action_type, action_value)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                action_value = action_value + VALUES(action_value),
                created_at = CURRENT_TIMESTAMP
            `;
            await pool.query(query, [actionId, userId, postId, creatorId, actionType, value]);

            // --- REDIS FEATURE STORE UPDATE (Algorithm 11.2) ---
            if (category) {
                const statsKey = `user:${userId}:category_stats`;
                const recentKey = `user:${userId}:recent_categories`;
                
                // 1. Update long-term feature vector (Hash)
                // Note: We don't apply decay here, decay happens on read or via periodic sweep.
                // For now, we use simple increment.
                let typeKey = actionType;
                if (actionType === 'view') typeKey = 'dwell'; // Map view to dwell if no duration
                
                redisService.hincrbyfloat(statsKey, `${category}:${typeKey}`, value).catch(() => {});
                
                // 2. Update short-term session intent (List)
                redisService.lpush(recentKey, category).catch(() => {});
                redisService.ltrim(recentKey, 0, 19).catch(() => {});
                redisService.expire(recentKey, 3600).catch(() => {}); // 1h session
                redisService.expire(statsKey, 86400).catch(() => {}); // 24h
            }

        } catch (err) {
            console.error('Error recording action:', err);
        }
    }

    static async getCommentById(commentId) {
        const [rows] = await pool.query('SELECT * FROM comments WHERE comment_id = ?', [commentId]);
        return rows[0] || null;
    }
}

module.exports = Post;
