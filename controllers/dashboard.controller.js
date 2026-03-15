const pool = require('../config/database');
const logger = require('../utils/logger');

class DashboardController {
    // ============ DASHBOARD HOMEPAGE ============
    async renderDashboard(req, res) {
        try {
            const userId = req.user.user_id || req.user.userId;

            // Fetch all dashboard data in parallel
            const [stories, feed, notifications, suggestions] = await Promise.all([
                this.getStoriesData(userId),
                this.getFeedData(userId),
                this.getNotificationData(userId),
                this.getSuggestionsData(userId)
            ]);

            res.render('dashboard', {
                title: 'Dashboard - Sparkle',
                user: req.user,
                stories,
                feed,
                notifications,
                suggestions,
                layout: 'layouts/main'
            });
        } catch (error) {
            logger.error('Dashboard render error:', error);
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
        const offset = (page - 1) * limit;

        const [posts] = await pool.query(`
            SELECT 
                p.*,
                u.username,
                u.name as user_name,
                u.avatar_url,
                u.campus,
                u.major,
                CASE WHEN s.user_id IS NOT NULL THEN 1 ELSE 0 END as is_sparked,
                CASE WHEN sp.user_id IS NOT NULL THEN 1 ELSE 0 END as is_saved,
                (SELECT COUNT(*) FROM comments WHERE post_id = p.post_id) as comment_count,
                (SELECT COUNT(*) FROM sparks WHERE post_id = p.post_id) as spark_count
            FROM posts p
            JOIN users u ON p.user_id = u.user_id
            LEFT JOIN sparks s ON p.post_id = s.post_id AND s.user_id = ?
            LEFT JOIN bookmarks sp ON p.post_id = sp.post_id AND sp.user_id = ?
            WHERE p.created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `, [userId, userId, limit, offset]);

        return posts;
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
        const [suggestions] = await pool.query(`
            SELECT 
                u.user_id,
                u.username,
                u.name,
                u.avatar_url,
                u.campus,
                u.major,
                CASE WHEN f.follower_id IS NOT NULL THEN 1 ELSE 0 END as is_followed
            FROM users u
            LEFT JOIN follows f ON u.user_id = f.following_id AND f.follower_id = ?
            WHERE u.user_id != ?
                AND u.user_id NOT IN (
                    SELECT following_id FROM follows WHERE follower_id = ?
                )
            ORDER BY RAND()
            LIMIT 5
        `, [userId, userId, userId]);

        return suggestions;
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
                    await pool.query(
                        `INSERT INTO notifications (notification_id, user_id, actor_id, type, content, related_id, related_type)
                         VALUES (UUID(), ?, ?, 'spark', 'sparked your post', ?, 'post')`,
                        [post[0].user_id, userId, postId]
                    );
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
                await pool.query(
                    `INSERT INTO notifications (notification_id, user_id, actor_id, type, content, related_id, related_type)
                     VALUES (UUID(), ?, ?, 'comment', 'commented on your post', ?, 'post')`,
                    [post[0].user_id, userId, postId]
                );
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
