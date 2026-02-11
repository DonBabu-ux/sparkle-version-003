const pool = require('../config/database');
const crypto = require('crypto');

class User {
    /**
     * Find user by ID
     */
    static async findById(userId) {
        const [users] = await pool.query(
            `SELECT user_id, name, username, email, avatar_url, campus, major, year_of_study, bio, joined_at, is_online,
                    (SELECT COUNT(*) FROM follows WHERE following_id = users.user_id) as followers_count,
                    (SELECT COUNT(*) FROM follows WHERE follower_id = users.user_id) as following_count,
                    (SELECT COUNT(*) FROM posts WHERE user_id = users.user_id) as posts_count
             FROM users WHERE user_id = ?`,
            [userId]
        );
        return users[0] || null;
    }

    /**
     * Find user by username
     */
    static async findByUsername(username) {
        const [users] = await pool.query(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );
        return users[0] || null;
    }

    /**
     * Find user by email
     */
    static async findByEmail(email) {
        const [users] = await pool.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );
        return users[0] || null;
    }

    /**
     * Create new user
     */
    static async create(userData) {
        const userId = crypto.randomUUID();
        await pool.query(
            `INSERT INTO users (user_id, name, username, email, password_hash, campus, major, avatar_url) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                userData.name,
                userData.username,
                userData.email,
                userData.password_hash,
                userData.campus || null,
                userData.major || null,
                userData.avatar_url || '/uploads/avatars/default.png'
            ]
        );
        return userId;
    }

    /**
     * Update user profile
     */
    static async update(userId, updates) {
        const fields = [];
        const values = [];

        if (updates.name !== undefined) {
            fields.push('name = ?');
            values.push(updates.name);
        }
        if (updates.bio !== undefined) {
            fields.push('bio = ?');
            values.push(updates.bio);
        }
        if (updates.major !== undefined) {
            fields.push('major = ?');
            values.push(updates.major);
        }
        if (updates.campus !== undefined) {
            fields.push('campus = ?');
            values.push(updates.campus);
        }
        if (updates.avatar_url !== undefined) {
            fields.push('avatar_url = ?');
            values.push(updates.avatar_url);
        }

        if (fields.length === 0) return false;

        values.push(userId);
        await pool.query(
            `UPDATE users SET ${fields.join(', ')} WHERE user_id = ?`,
            values
        );
        return true;
    }

    /**
     * Search users by name or username
     */
    static async search(query, currentUserId, limit = 20) {
        if (!query || !query.trim()) {
            const [users] = await pool.query(
                'SELECT user_id, name, username, avatar_url, campus, major FROM users WHERE user_id != ? LIMIT ?',
                [currentUserId, limit]
            );
            return users;
        }

        const [users] = await pool.query(
            'SELECT user_id, name, username, avatar_url, campus, major FROM users WHERE (name LIKE ? OR username LIKE ?) AND user_id != ? LIMIT ?',
            [`%${query}%`, `%${query}%`, currentUserId, limit]
        );
        return users;
    }

    /**
     * Search users that the current user is following
     */
    static async searchFollowing(query, currentUserId, limit = 20) {
        if (!query || !query.trim()) {
            const [users] = await pool.query(
                `SELECT u.user_id, u.name, u.username, u.avatar_url, u.campus, u.major
             FROM follows f
             JOIN users u ON f.following_id = u.user_id
             WHERE f.follower_id = ?
             LIMIT ?`,
                [currentUserId, limit]
            );
            return users;
        }

        const [users] = await pool.query(
            `SELECT u.user_id, u.name, u.username, u.avatar_url, u.campus, u.major
         FROM follows f
         JOIN users u ON f.following_id = u.user_id
         WHERE f.follower_id = ? 
         AND (u.name LIKE ? OR u.username LIKE ?)
         LIMIT ?`,
            [currentUserId, `%${query}%`, `%${query}%`, limit]
        );
        return users;
    }

    /**
     * Get user with profile stats
     */
    static async getProfileWithStats(username, currentUserId) {
        const [users] = await pool.query(
            `SELECT u.*, 
                    (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) as followers_count,
                    (SELECT COUNT(*) FROM follows WHERE follower_id = u.user_id) as following_count,
                    (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.user_id) as is_followed_by_me
             FROM users u 
             WHERE u.username = ?`,
            [currentUserId, username]
        );
        return users[0] || null;
    }

    /**
     * Delete user account
     */
    static async delete(userId) {
        await pool.query('DELETE FROM users WHERE user_id = ?', [userId]);
        return true;
    }

    /**
     * Update password
     */
    static async updatePassword(userId, hashedPassword) {
        await pool.query(
            'UPDATE users SET password_hash = ? WHERE user_id = ?',
            [hashedPassword, userId]
        );
        return true;
    }

    /**
     * Update online status
     */
    static async setOnlineStatus(userId, isOnline) {
        await pool.query(
            'UPDATE users SET is_online = ?, last_seen_at = NOW() WHERE user_id = ?',
            [isOnline ? 1 : 0, userId]
        );
        return true;
    }

    /**
     * Follow a user
     */
    static async follow(followerId, followingId) {
        if (followerId === followingId) throw new Error('You cannot follow yourself');

        try {
            await pool.query(
                'INSERT INTO follows (follower_id, following_id) VALUES (?, ?)',
                [followerId, followingId]
            );
            return true;
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') return true; // Already following
            throw error;
        }
    }

    /**
     * Unfollow a user
     */
    static async unfollow(followerId, followingId) {
        await pool.query(
            'DELETE FROM follows WHERE follower_id = ? AND following_id = ?',
            [followerId, followingId]
        );
        return true;
    }

    /**
     * Get followers of a user
     */
    static async getFollowers(userId) {
        const [followers] = await pool.query(
            `SELECT u.user_id, u.name, u.username, u.avatar_url, u.campus
             FROM follows f
             JOIN users u ON f.follower_id = u.user_id
             WHERE f.following_id = ?`,
            [userId]
        );
        return followers;
    }

    /**
     * Get users followed by a user
     */
    static async getFollowing(userId) {
        const [following] = await pool.query(
            `SELECT u.user_id, u.name, u.username, u.avatar_url, u.campus
             FROM follows f
             JOIN users u ON f.following_id = u.user_id
             WHERE f.follower_id = ?`,
            [userId]
        );
        return following;
    }
}

module.exports = User;
