const pool = require('../config/database');
const crypto = require('crypto');

class Post {
    /**
     * Create a new post
     */
    static async create(userId, postData) {
        const postId = crypto.randomUUID();
        await pool.query(
            `INSERT INTO posts (post_id, user_id, content, media_url, media_type, post_type, campus, group_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                postId,
                userId,
                postData.content,
                postData.media_url || null,
                postData.media_type || null,
                postData.post_type || 'public',
                postData.campus || null,
                postData.group_id || null
            ]
        );
        return postId;
    }

    /**
     * Get post by ID with user info
     */
    static async findById(postId) {
        const [posts] = await pool.query(
            `SELECT p.*, u.username, u.name as user_name, u.avatar_url,
                    (SELECT COUNT(*) FROM sparks s WHERE s.post_id = p.post_id) as sparks
             FROM posts p 
             JOIN users u ON p.user_id = u.user_id 
             WHERE p.post_id = ?`,
            [postId]
        );
        return posts[0] || null;
    }

    /**
     * Get feed posts
     */
    static async getFeed(campus, limit = 20) {
        const [posts] = await pool.query(
            `SELECT p.*, u.username, u.name as user_name, u.avatar_url,
                    (SELECT COUNT(*) FROM sparks s WHERE s.post_id = p.post_id) as sparks,
                    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id) as comments
             FROM posts p 
             JOIN users u ON p.user_id = u.user_id 
             WHERE p.campus = ? OR p.post_type = 'public'
             ORDER BY p.created_at DESC 
             LIMIT ?`,
            [campus, limit]
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
    static async getUserPosts(userId, limit = 20) {
        const [posts] = await pool.query(
            `SELECT p.*, 
                    (SELECT COUNT(*) FROM sparks s WHERE s.post_id = p.post_id) as sparks,
                    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id) as comments
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
    static async getComments(postId) {
        const [comments] = await pool.query(
            `SELECT c.*, u.username, u.name, u.avatar_url
             FROM comments c
             JOIN users u ON c.user_id = u.user_id
             WHERE c.post_id = ?
             ORDER BY c.created_at ASC`,
            [postId]
        );
        return comments;
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
        const saveId = crypto.randomUUID();
        try {
            await pool.query(
                'INSERT INTO saved_posts (save_id, user_id, post_id) VALUES (?, ?, ?)',
                [saveId, userId, postId]
            );
            return { success: true, action: 'saved' };
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                await pool.query(
                    'DELETE FROM saved_posts WHERE user_id = ? AND post_id = ?',
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
             FROM saved_posts sp
             JOIN posts p ON sp.post_id = p.post_id
             JOIN users u ON p.user_id = u.user_id
             WHERE sp.user_id = ?
             ORDER BY sp.saved_at DESC
             LIMIT ?`,
            [userId, limit]
        );
        return posts;
    }

    /**
     * Increment share count for post
     */
    static async incrementShare(postId) {
        await pool.query(
            'UPDATE posts SET share_count = share_count + 1 WHERE post_id = ?',
            [postId]
        );
        return true;
    }
}

module.exports = Post;
