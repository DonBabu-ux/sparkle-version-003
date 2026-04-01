const pool = require('../config/database');
const logger = require('../utils/logger');

class DashboardController {
    // ============ DASHBOARD HOMEPAGE ============
    async renderDashboard(req, res) {
        try {
            const userId = req.user.user_id || req.user.userId;

            // Fetch all dashboard data in parallel with robust error handling
            const [stories, feed, notifications, suggestions] = await Promise.all([
                this.getStoriesData(userId).catch(err => {
                    logger.error('Dashboard Stories Fetch Error:', err);
                    return [];
                }),
                this.getFeedData(userId).catch(err => {
                    logger.error('Dashboard Feed Fetch Error:', err);
                    return [];
                }),
                this.getNotificationData(userId).catch(err => {
                    logger.error('Dashboard Notifications Fetch Error:', err);
                    return [];
                }),
                this.getSuggestionsData(userId).catch(err => {
                    logger.error('Dashboard Suggestions Fetch Error:', err);
                    return [];
                })
            ]);

            res.render('dashboard', {
                title: 'Dashboard - Sparkle',
                user: req.user,
                stories: stories || [],
                feed: feed || [],
                notifications: notifications || [],
                suggestions: (suggestions || []).filter(Boolean), // safety filter
                layout: 'layouts/main'
            });
        } catch (error) {
            logger.error('Critical Dashboard render error:', error);
            res.status(500).render('error', {
                message: 'Failed to load dashboard',
                error: process.env.NODE_ENV === 'development' ? error : {}
            });
        }
    }

    // ============ API ENDPOINTS (for dynamic updates) ============
    async getStoriesAPI(req, res) {
        try {
            const stories = await this.getStoriesData(req.user.user_id);
            res.json({ success: true, data: stories });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getFeedAPI(req, res) {
        try {
            const { page = 1, limit = 10 } = req.query;
            const feed = await this.getFeedData(req.user.user_id, parseInt(page), parseInt(limit));
            res.json({ success: true, data: feed });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getNotificationsAPI(req, res) {
        try {
            const notifications = await this.getNotificationData(req.user.user_id);
            res.json({ success: true, data: notifications });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // ============ DATA FETCHING METHODS ============
    async getStoriesData(userId) {
        const [stories] = await pool.query(`
            SELECT 
                s.*,
                u.username,
                u.name as user_name,
                u.avatar_url,
                u.campus,
                CASE WHEN sl.user_id IS NOT NULL THEN 1 ELSE 0 END as is_liked
            FROM stories s
            JOIN users u ON s.user_id = u.user_id
            LEFT JOIN story_likes sl ON s.story_id = sl.story_id AND sl.user_id = ?
            WHERE s.expires_at > NOW()
            ORDER BY s.created_at DESC
        `, [userId]);

        // Group stories by user
        const groupedStories = {};
        stories.forEach(story => {
            if (!groupedStories[story.user_id]) {
                groupedStories[story.user_id] = {
                    user_id: story.user_id,
                    username: story.username,
                    user_name: story.user_name,
                    avatar_url: story.avatar_url,
                    campus: story.campus,
                    stories: [],
                    hasUnviewed: false
                };
            }
            groupedStories[story.user_id].stories.push({
                ...story,
                secondsLeft: Math.max(0, Math.floor((new Date(story.expires_at) - new Date()) / 1000)),
                created_at_formatted: new Date(story.created_at).toISOString()
            });
        });

        // Simplified unviewed logic: if there's any story they haven't seen in the last 24h
        // (In a real app, you'd have a story_views table)
        return Object.values(groupedStories);
    }

    async getFeedData(userId, page = 1, limit = 10) {
        // Check following count
        const [followingResult] = await pool.query('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?', [userId]);
        const followsCount = followingResult[0].count;

        const baseSelect = `
            SELECT p.*, u.username, u.name as user_name, u.avatar_url, u.campus, u.major,
            CASE WHEN s.user_id IS NOT NULL THEN 1 ELSE 0 END as is_sparked,
            CASE WHEN sp.user_id IS NOT NULL THEN 1 ELSE 0 END as is_saved,
            (SELECT COUNT(*) FROM comments WHERE post_id = p.post_id) as comment_count,
            (SELECT COUNT(*) FROM sparks WHERE post_id = p.post_id) as spark_count,
            (
                ((SELECT COUNT(*) FROM sparks WHERE post_id = p.post_id) + (SELECT COUNT(*) FROM comments WHERE post_id = p.post_id)) * 4.0 +
                (CASE WHEN DATEDIFF(NOW(), p.created_at) < 1 THEN 30.0 ELSE (30.0 / (DATEDIFF(NOW(), p.created_at) + 1)) END) +
                (RAND() * 30.0)
            ) as rec_score
            FROM posts p
            JOIN users u ON p.user_id = u.user_id
            LEFT JOIN sparks s ON p.post_id = s.post_id AND s.user_id = ?
            LEFT JOIN bookmarks sp ON p.post_id = sp.post_id AND sp.user_id = ?
        `;

        if (followsCount === 0) {
            // Show random + trending
            const offset = (page - 1) * limit;
            const [posts] = await pool.query(`
                ${baseSelect}
                ORDER BY rec_score DESC
                LIMIT ? OFFSET ?
            `, [userId, userId, limit, offset]);
            return posts;
        } else {
            // 70% following, 30% recommended
            const limitFollowing = Math.ceil(limit * 0.7);
            const limitRec = limit - limitFollowing;
            const offsetFollowing = (page - 1) * limitFollowing;
            const offsetRec = (page - 1) * limitRec;

            const [followingPosts] = await pool.query(`
                ${baseSelect}
                WHERE p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?) OR p.user_id = ?
                ORDER BY p.created_at DESC
                LIMIT ? OFFSET ?
            `, [userId, userId, userId, userId, limitFollowing, offsetFollowing]);

            const [recPosts] = await pool.query(`
                ${baseSelect}
                WHERE p.user_id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?) AND p.user_id != ?
                ORDER BY rec_score DESC
                LIMIT ? OFFSET ?
            `, [userId, userId, userId, userId, limitRec, offsetRec]);

            // Combine and sort by date or mix them. Mixing interweaves them nicely.
            let combined = [];
            let i = 0, j = 0;
            while (i < followingPosts.length || j < recPosts.length) {
                if (i < followingPosts.length) combined.push(followingPosts[i++]);
                if (i < followingPosts.length) combined.push(followingPosts[i++]);
                if (j < recPosts.length) combined.push(recPosts[j++]);
            }
            return combined;
        }
    }

    async getNotificationData(userId) {
        const [notifications] = await pool.query(`
            SELECT 
                n.*,
                u.username as actor_username,
                u.name as actor_name,
                u.avatar_url as actor_avatar
            FROM notifications n
            LEFT JOIN users u ON n.actor_id = u.user_id
            WHERE n.user_id = ?
            ORDER BY n.created_at DESC
            LIMIT 20
        `, [userId]);

        return notifications;
    }

    async getSuggestionsData(userId) {
        return await require('../models/User').getSuggestions(userId, 5);
    }

    // ============ INTERACTION HANDLERS ============
    async sparkPost(req, res) {
        const { postId } = req.params;
        const userId = req.user.user_id;

        try {
            const [existing] = await pool.query(
                'SELECT * FROM sparks WHERE post_id = ? AND user_id = ?',
                [postId, userId]
            );

            if (existing.length > 0) {
                await pool.query(
                    'DELETE FROM sparks WHERE post_id = ? AND user_id = ?',
                    [postId, userId]
                );
                res.json({ success: true, action: 'unsparked' });
            } else {
                await pool.query(
                    'INSERT INTO sparks (spark_id, post_id, user_id) VALUES (UUID(), ?, ?)',
                    [postId, userId]
                );

                // Create notification for post owner
                const [post] = await pool.query(
                    'SELECT user_id FROM posts WHERE post_id = ?',
                    [postId]
                );

                if (post.length > 0 && post[0].user_id !== userId) {
                    await require('./notification.controller').createNotification({
                        user_id: post[0].user_id,
                        type: 'spark',
                        title: 'Sparked Post',
                        content: 'sparked your post',
                        actor_id: userId,
                        related_id: postId,
                        related_type: 'post',
                        action_url: `/post/${postId}`
                    }, pool);
                }

                res.json({ success: true, action: 'sparked' });
            }
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async savePost(req, res) {
        const { postId } = req.params;
        const userId = req.user.user_id;

        try {
            const [existing] = await pool.query(
                'SELECT * FROM bookmarks WHERE post_id = ? AND user_id = ?',
                [postId, userId]
            );

            if (existing.length > 0) {
                await pool.query(
                    'DELETE FROM bookmarks WHERE post_id = ? AND user_id = ?',
                    [postId, userId]
                );
                res.json({ success: true, action: 'unsaved' });
            } else {
                await pool.query(
                    'INSERT INTO bookmarks (bookmark_id, post_id, user_id) VALUES (UUID(), ?, ?)',
                    [postId, userId]
                );
                res.json({ success: true, action: 'saved' });
            }
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async addComment(req, res) {
        const { postId } = req.params;
        const { content } = req.body;
        const userId = req.user.user_id;

        try {
            const commentId = require('crypto').randomUUID();

            await pool.query(
                `INSERT INTO comments (comment_id, post_id, user_id, content)
                 VALUES (?, ?, ?, ?)`,
                [commentId, postId, userId, content]
            );

            // Get post owner for notification
            const [post] = await pool.query(
                'SELECT user_id FROM posts WHERE post_id = ?',
                [postId]
            );

            if (post.length > 0 && post[0].user_id !== userId) {
                await require('./notification.controller').createNotification({
                    user_id: post[0].user_id,
                    type: 'comment',
                    title: 'New Comment',
                    content: 'commented on your post',
                    actor_id: userId,
                    related_id: postId,
                    related_type: 'post',
                    action_url: `/post/${postId}`
                }, pool);
            }

            // Get the created comment with user details
            const [comment] = await pool.query(`
                SELECT 
                    c.*,
                    u.username,
                    u.name as user_name,
                    u.avatar_url
                FROM comments c
                JOIN users u ON c.user_id = u.user_id
                WHERE c.comment_id = ?
            `, [commentId]);

            res.json({ success: true, data: comment[0] });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // ============ CREATE CONTENT ============
    async createPost(req, res) {
        const { content, media_url, post_type, tags } = req.body;
        const userId = req.user.user_id;

        try {
            const postId = require('crypto').randomUUID();

            await pool.query(
                `INSERT INTO posts (post_id, user_id, content, media_url, post_type, tags)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [postId, userId, content, media_url, post_type || 'public', tags || null]
            );

            res.json({
                success: true,
                data: { post_id: postId, message: 'Post created successfully' }
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async createStory(req, res) {
        const { media_url, caption } = req.body;
        const userId = req.user.user_id;

        try {
            const storyId = require('crypto').randomUUID();
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

            await pool.query(
                `INSERT INTO stories (story_id, user_id, media_url, caption, expires_at)
                 VALUES (?, ?, ?, ?, ?)`,
                [storyId, userId, media_url, caption, expiresAt]
            );

            res.json({
                success: true,
                data: { story_id: storyId, message: 'Story created successfully' }
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // ============ MARK NOTIFICATIONS READ ============
    async markNotificationRead(req, res) {
        const { notificationId } = req.params;
        const userId = req.user.user_id;

        try {
            await pool.query(
                'UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND user_id = ?',
                [notificationId, userId]
            );
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async markAllNotificationsRead(req, res) {
        const userId = req.user.user_id;

        try {
            await pool.query(
                'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
                [userId]
            );
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new DashboardController();
