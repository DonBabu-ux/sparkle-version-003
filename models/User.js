const pool = require('../config/database');
const crypto = require('crypto');

class User {
    static pool = pool;

    /**
     * Derives a user's type based on their affiliation and interests
     * for dynamic profile rendering.
     */
    static deriveUserType(user) {
        const affiliation = (user.affiliation || user.campus || '').toLowerCase();
        const interests = (user.interests || user.major || '').toLowerCase();

        if (affiliation.includes('university') || affiliation.includes('college') || affiliation.includes('campus') || affiliation.includes('uni')) {
            return 'Academic';
        } else if (affiliation.includes('inc') || affiliation.includes('corp') || affiliation.includes('tech') || affiliation.includes('systems')) {
            return 'Professional';
        } else if (interests.includes('software') || interests.includes('engineering') || interests.includes('design')) {
            return 'Creator';
        }
        return 'Member';
    }

    /**
     * Helper to ensure avatar URLs are properly formatted
     */
    static getSafeAvatarUrl(url) {
        if (!url) return '/uploads/avatars/default.png';
        if (url.startsWith('http')) return url;
        if (url.includes('uploads/')) {
            return url.startsWith('/') ? url : `/${url}`;
        }
        return '/uploads/avatars/default.png';
    }

    /**
     * Helper to map legacy database columns to generalized concepts
     */
    static mapGeneralizedFields(user) {
        if (!user) return;
        user.affiliation = user.affiliation || user.campus;
        user.interests = user.interests || user.major;
        user.experience_level = user.experience_level || user.year_of_study;
        user.avatar_url = this.getSafeAvatarUrl(user.avatar_url || user.profile_picture || user.avatar);
        return user;
    }

    /**
     * Find user by ID
     */
    static async findById(userId) {
        // use wildcard select so migration is optional; extra columns will be
        // ignored if they don’t exist yet
        const [users] = await pool.query(
            `SELECT u.*,
                    (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) as followers_count,
                    (SELECT COUNT(*) FROM follows WHERE follower_id = u.user_id) as following_count,
                    (SELECT COUNT(*) FROM posts WHERE user_id = u.user_id) as posts_count,
                    (SELECT COUNT(*) FROM stories WHERE user_id = u.user_id AND (expires_at > NOW() OR (expires_at IS NULL AND created_at > NOW() - INTERVAL 24 HOUR))) > 0 as has_story
             FROM users u
             WHERE u.user_id = ? AND u.account_status != 'suspended'`,
            [userId]
        );
        const user = users[0] || null;
        if (user) {
            user.userType = this.deriveUserType(user);
            this.mapGeneralizedFields(user);
        }
        return user;
    }

    /**
     * Find user by username
     */
    static async findByUsername(username) {
        const [users] = await pool.query(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );
        const user = users[0] || null;
        if (user) {
            user.userType = this.deriveUserType(user);
            this.mapGeneralizedFields(user);
        }
        return user;
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
                userData.affiliation || userData.campus || null,
                userData.interests || userData.major || null,
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

        for (const [key, val] of Object.entries(updates)) {
            if (val !== undefined) {
                fields.push(`${key} = ?`);
                values.push(val);
            }
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
     * Update arbitrary settings columns on the users table.
     * The caller must validate/whitelist the keys before calling this.
     */
    static async updateSettings(userId, settings) {
        const fields = [];
        const values = [];

        for (const [key, val] of Object.entries(settings)) {
            // only allow simple scalar values; caller is responsible for whitelisting
            fields.push(`${key} = ?`);
            values.push(val);
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
     * Search users by name or username with advanced filters
     */
    static async search(query, currentUserId, filters = {}, limit = 20) {
        const mutualQuery = `(SELECT COUNT(*) FROM follows f1 JOIN follows f2 ON f1.following_id = f2.following_id WHERE f1.follower_id = ? AND f2.follower_id = u.user_id)`;
        
        let sql = `SELECT u.user_id, u.name, u.username, u.avatar_url, u.campus, u.major, u.bio, u.is_online,
                          u.year_of_study,
                          (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.user_id) as is_followed,
                          (SELECT status FROM follow_requests WHERE requester_id = ? AND target_user_id = u.user_id AND status = 'pending') as request_status,
                          ${mutualQuery} as mutual_connections
                   FROM users u 
                   WHERE u.user_id != ?`;
        
        const params = [currentUserId, currentUserId, currentUserId, currentUserId];

        if (query && query.trim()) {
            sql += ` AND (u.name LIKE ? OR u.username LIKE ?)`;
            params.push(`%${query}%`, `%${query}%`);
        }

        const affiliation = filters.affiliation || filters.campus;
        if (affiliation && affiliation !== 'all') {
            sql += ` AND u.campus = ?`;
            params.push(affiliation);
        }

        const interests = filters.interests || filters.major;
        if (interests && interests !== 'all') {
            sql += ` AND u.major = ?`;
            params.push(interests);
        }

        const expLevel = filters.experience_level || filters.year;
        if (expLevel && expLevel !== 'all') {
            sql += ` AND u.year_of_study = ?`;
            params.push(expLevel);
        }

        if (filters.relationship === 'following') {
            sql += ` AND u.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)`;
            params.push(currentUserId);
        } else if (filters.relationship === 'not_following') {
            sql += ` AND u.user_id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)`;
            params.push(currentUserId);
        }

        sql += ` LIMIT ?`;
        params.push(limit);

        const [users] = await pool.query(sql, params);
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
     * Get active friends (online or seen recently)
     */
    static async getActiveFriends(currentUserId, limit = 20) {
        const [users] = await pool.query(
            `SELECT DISTINCT u.user_id, u.username, u.name, u.avatar_url, u.campus, u.is_online, u.last_seen_at
             FROM users u
             WHERE u.user_id != ? 
             AND (u.is_online = 1 OR TIMESTAMPDIFF(MINUTE, u.last_seen_at, NOW()) < 2)
             AND (
                u.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)
                OR
                u.user_id IN (
                    SELECT f1.following_id 
                    FROM follows f1 
                    JOIN follows f2 ON f1.following_id = f2.follower_id 
                    WHERE f1.follower_id = ? AND f2.following_id = ?
                )
             )
             ORDER BY u.is_online DESC, u.last_seen_at DESC
             LIMIT ?`,
            [currentUserId, currentUserId, currentUserId, currentUserId, limit]
        );
        return users;
    }

    /**
     * Fetch a small set of users that the current user isn't already following.
     * Uses a weighted matching algorithm for discovery.
     */
    static async getSuggestions(currentUserId, options = {}) {
        try {
            const { limit = 20, offset = 0, seed = null, tab = 'suggested', filter = null, query = null } = options;

            // Fetch current user details for ranking
            const [me] = await pool.query('SELECT major, year_of_study, campus FROM users WHERE user_id = ?', [currentUserId]);
            if (!me[0]) return [];

        const numericSeed = seed ? parseInt(crypto.createHash('md5').update(String(seed)).digest('hex').substring(0, 8), 16) : null;
        const sqlSeed = numericSeed ? `(${numericSeed})` : '()';

        const mutualQuery = `(SELECT COUNT(*) FROM follows f1 JOIN follows f2 ON f1.following_id = f2.following_id WHERE f1.follower_id = ? AND f2.follower_id = u.user_id)`;

        let sql = `
            SELECT 
                u.*,
                (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.user_id) as is_followed,
                (SELECT status FROM follow_requests WHERE requester_id = ? AND target_user_id = u.user_id AND status = 'pending') as request_status,
                (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) as follower_count,
                ${mutualQuery} as mutual_connections,
                (
                    -- 1. Mutual Connections (Weight 0.4 -> 40 points max)
                    (LEAST(${mutualQuery}, 10) * 4) +
                    
                    -- 2. Academic Similarity (Weight 0.25 -> 25 points max)
                    (CASE WHEN u.major = ? THEN 25 WHEN u.major IS NOT NULL THEN 5 ELSE 0 END) +
                    
                    -- 3. Campus Proximity (Weight 0.15 -> 15 points max)
                    (CASE WHEN u.campus = ? THEN 15 ELSE 5 END) +
                    
                    -- 4. Activity (Weight 0.1 -> 10 points max)
                    (CASE WHEN u.is_online = 1 OR u.last_seen_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 10 ELSE 0 END) +
                    
                    -- 5. Profile Completeness (Weight 0.1 -> 10 points max)
                    (CASE WHEN u.bio IS NOT NULL AND u.bio != '' THEN 3 ELSE 0 END) +
                    (CASE WHEN u.avatar_url IS NOT NULL AND u.avatar_url NOT LIKE '%default%' THEN 3 ELSE 0 END) +
                    (CASE WHEN u.major IS NOT NULL THEN 2 ELSE 0 END) +
                    
                    -- Variety (5 points)
                    (RAND${sqlSeed} * 5)
                ) as discovery_score
            FROM users u
            WHERE u.user_id != ? 
        `;

        const params = [
            currentUserId, // for is_followed
            currentUserId, // for request_status
            currentUserId, // for mutual_connections count
            currentUserId, // for mutual_connections in score
            me[0].major,   // for academic similarity
            me[0].campus,  // for campus proximity
            currentUserId  // for u.user_id != ?
        ];

        // Apply Tab Logic
        if (tab === 'following') {
            sql += ` AND u.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)`;
            params.push(currentUserId);
        } else if (tab === 'for you') {
            // "For You" shows everyone (including people you follow)
        } else if (tab === 'similar') {
            sql += ` AND (u.major = ? OR u.campus = ?)`;
            sql += ` AND u.user_id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)`;
            params.push(me[0].major, me[0].campus, currentUserId);
        } else {
            // Default: Suggested (people you don't follow)
            sql += ` AND u.user_id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)`;
            params.push(currentUserId);
        }

        // Apply Filter Logic
        if (filter === 'campus') {
            sql += ` AND u.campus = ?`;
            params.push(me[0].campus);
        } else if (filter === 'interests') {
            sql += ` AND u.major = ?`;
            params.push(me[0].major);
        } else if (filter === 'level') {
            sql += ` AND u.year_of_study = ?`;
            params.push(me[0].year_of_study);
        }

        // Apply Search Query
        if (query && query.trim()) {
            sql += ` AND (u.name LIKE ? OR u.username LIKE ? OR u.major LIKE ? OR u.campus LIKE ?)`;
            params.push(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);
        }

        // Apply Sorting
        sql += ` ORDER BY discovery_score DESC`;

        sql += ` LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const [users] = await pool.query(sql, params);
        
        // Fetch detailed mutual connections for the avatar stack
        const userIds = users.map(u => u.user_id);
        let mutualDetailsMap = {};
        
        if (userIds.length > 0) {
            const [mutuals] = await pool.query(`
                SELECT f2.follower_id as target_user_id, u.user_id, u.username, u.name, u.avatar_url
                FROM follows f1
                JOIN follows f2 ON f1.following_id = f2.following_id
                JOIN users u ON f1.following_id = u.user_id
                WHERE f1.follower_id = ? AND f2.follower_id IN (?)
            `, [currentUserId, userIds]);
            
            mutuals.forEach(m => {
                if (!mutualDetailsMap[m.target_user_id]) mutualDetailsMap[m.target_user_id] = [];
                if (mutualDetailsMap[m.target_user_id].length < 5) {
                    mutualDetailsMap[m.target_user_id].push({
                        id: m.user_id,
                        name: m.name || m.username,
                        avatar: m.avatar_url
                    });
                }
            });
        }
        
        // Map fields and generate "reason" for suggestion
        return users.map(u => {
            const mapped = this.mapGeneralizedFields(u);
            mapped.mutual_followers = mutualDetailsMap[u.user_id] || [];
            
            // Add suggestion reason
            if (u.mutual_connections > 0) {
                mapped.suggestion_reason = `${u.mutual_connections} mutual friend${u.mutual_connections > 1 ? 's' : ''}`;
            } else if (u.major === me[0].major) {
                mapped.suggestion_reason = `Same major: ${u.major}`;
            } else if (u.campus === me[0].campus) {
                mapped.suggestion_reason = `On ${u.campus}`;
            } else {
                mapped.suggestion_reason = `Suggested for you`;
            }
            return mapped;
        });
    } catch (error) {
        console.error('[User Model] getSuggestions error:', error.message, error.stack);
        throw error;
    }
}

    /**
     * Get user with profile stats
     */
    static async getProfileWithStats(identifier, currentUserId) {
        const [users] = await pool.query(
            `SELECT u.*, 
                    (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) as followers_count,
                    (SELECT COUNT(*) FROM follows WHERE follower_id = u.user_id) as following_count,
                    (SELECT COUNT(*) FROM posts WHERE user_id = u.user_id) as posts_count,
                    (SELECT COUNT(*) FROM stories WHERE user_id = u.user_id AND (expires_at > NOW() OR (expires_at IS NULL AND created_at > NOW() - INTERVAL 24 HOUR))) > 0 as has_story,
                    (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.user_id) as is_followed_by_me,
                    (SELECT COUNT(*) FROM follow_requests WHERE requester_id = ? AND target_user_id = u.user_id AND status = 'pending') as is_requested_by_me
             FROM users u 
             WHERE u.username = ? OR u.user_id = ?`,
            [currentUserId, currentUserId, identifier, identifier]
        );
        const user = users[0] || null;
        if (user) {
            user.userType = this.deriveUserType(user);
            this.mapGeneralizedFields(user);
        }
        return user;
    }

    /**
     * Mark account for deletion (Soft Delete - Algorithm 10)
     */
    static async delete(userId) {
        // Set deletion_marked_at. We keep the record for 30 days for restoration.
        // We also "soft delete" by setting deleted_at to NOW() for display purposes.
        await pool.query(
            `UPDATE users SET 
                deletion_marked_at = NOW(), 
                deleted_at = NOW(),
                account_status = 'deactivated'
             WHERE user_id = ?`, 
            [userId]
        );
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
        if (isOnline) {
            // Just mark online, don't update last_seen_at yet
            await pool.query('UPDATE users SET is_online = 1 WHERE user_id = ?', [userId]);
        } else {
            // Mark offline AND record the exit time (last seen)
            await pool.query('UPDATE users SET is_online = 0, last_seen_at = NOW() WHERE user_id = ?', [userId]);
        }
        return true;
    }

    /**
     * Get user presence information
     */
    static async getUserPresence(userId) {
        const [rows] = await pool.query(
            'SELECT user_id, is_online, last_seen_at FROM users WHERE user_id = ?',
            [userId]
        );
        return rows[0] || null;
    }

    /**
     * Follow a user or send a follow request if the profile is private
     */
    static async follow(followerId, followingId) {
        if (followerId === followingId) throw new Error('You cannot follow yourself');

        // Check if the target user is private
        const [targetUser] = await pool.query(
            'SELECT is_private, profile_visibility FROM users WHERE user_id = ?',
            [followingId]
        );

        if (!targetUser[0]) throw new Error('User not found');

        // Priority to is_private as per prompt Step 4
        const isPrivate = targetUser[0].is_private || targetUser[0].profile_visibility === 'private';

        if (isPrivate) {
            // Send follow request
            try {
                const requestId = crypto.randomUUID();
                await pool.query(
                    'INSERT INTO follow_requests (request_id, requester_id, target_user_id, status) VALUES (?, ?, ?, "pending")',
                    [requestId, followerId, followingId]
                );

                // Create notification for follow request (Step 7)
                await require('../controllers/notification.controller').createNotification({
                    user_id: followingId,
                    type: 'follow_request',
                    title: 'Follow Request',
                    content: 'requested to follow you.',
                    actor_id: followerId,
                    action_url: '/follow-requests'
                }, pool);

                return { status: 'requested' };
            } catch (error) {
                if (error.code === 'ER_DUP_ENTRY') return { status: 'requested' };
                throw error;
            }
        }

        try {
            await pool.query(
                'INSERT INTO follows (follower_id, following_id) VALUES (?, ?)',
                [followerId, followingId]
            );

            // Create notification for follow
            const [[user]] = await pool.query('SELECT username FROM users WHERE user_id = ?', [followerId]);
            await require('../controllers/notification.controller').createNotification({
                user_id: followingId,
                type: 'follow',
                title: 'New Follower',
                content: 'started following you.',
                actor_id: followerId,
                action_url: '/profile/' + user.username
            }, pool);

            return { status: 'following' };
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') return { status: 'following' };
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
     * Get detailed follower list
     */
    static async getFollowersDetailed(userId, currentUserId) {
        const mutualQuery = `(SELECT COUNT(*) FROM follows f1 JOIN follows f2 ON f1.following_id = f2.following_id WHERE f1.follower_id = ? AND f2.follower_id = u.user_id)`;
        const [followers] = await pool.query(
            `SELECT u.user_id, u.name, u.username, u.avatar_url, u.campus, u.bio,
                    (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.user_id) as is_followed_by_me,
                    ${mutualQuery} as mutual_connections
             FROM follows f
             JOIN users u ON f.follower_id = u.user_id
             WHERE f.following_id = ?`,
            [currentUserId, currentUserId, userId]
        );
        return followers;
    }

    /**
     * Get detailed following list
     */
    static async getFollowingDetailed(userId, currentUserId) {
        const mutualQuery = `(SELECT COUNT(*) FROM follows f1 JOIN follows f2 ON f1.following_id = f2.following_id WHERE f1.follower_id = ? AND f2.follower_id = u.user_id)`;
        const [following] = await pool.query(
            `SELECT u.user_id, u.name, u.username, u.avatar_url, u.campus, u.bio,
                    (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.user_id) as is_followed_by_me,
                    ${mutualQuery} as mutual_connections
             FROM follows f
             JOIN users u ON f.following_id = u.user_id
             WHERE f.follower_id = ?`,
            [currentUserId, currentUserId, userId]
        );
        return following;
    }

    /**
     * Get mutual connections between two users
     */
    static async getMutualConnections(userAId, userBId) {
        const [mutual] = await pool.query(
            `SELECT u.user_id, u.name, u.username, u.avatar_url
             FROM follows f1
             JOIN follows f2 ON f1.following_id = f2.following_id
             JOIN users u ON f1.following_id = u.user_id
             WHERE f1.follower_id = ? AND f2.follower_id = ?`,
            [userAId, userBId]
        );
        return mutual;
    }

    /**
     * Block a user
     */
    static async blockUser(blockerId, blockedId) {
        if (blockerId === blockedId) throw new Error('You cannot block yourself');

        // Remove any existing follow relationship
        await pool.query(
            'DELETE FROM follows WHERE (follower_id = ? AND following_id = ?) OR (follower_id = ? AND following_id = ?)',
            [blockerId, blockedId, blockedId, blockerId]
        );

        try {
            await pool.query(
                'INSERT INTO user_blocks (block_id, blocker_id, blocked_id) VALUES (UUID(), ?, ?)',
                [blockerId, blockedId]
            );
            return true;
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') return true;
            throw error;
        }
    }

    /**
     * Unblock a user
     */
    static async unblockUser(blockerId, blockedId) {
        await pool.query(
            'DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?',
            [blockerId, blockedId]
        );
        return true;
    }

    /**
     * Get list of users blocked by current user
     */
    static async getBlockedUsers(userId) {
        const [blocks] = await pool.query(
            `SELECT u.user_id, u.username, u.name, u.avatar_url
             FROM user_blocks b
             JOIN users u ON b.blocked_id = u.user_id
             WHERE b.blocker_id = ?`,
            [userId]
        );
        return blocks;
    }

    /**
     * Get pending follow requests
     */
    static async getPendingFollowRequests(userId) {
        const [requests] = await pool.query(
            `SELECT fr.*, u.username, u.name, u.avatar_url, u.campus
             FROM follow_requests fr
             JOIN users u ON fr.requester_id = u.user_id
             WHERE fr.target_user_id = ? AND fr.status = 'pending'
             ORDER BY fr.created_at DESC`,
            [userId]
        );
        return requests;
    }

    /**
     * Accept follow request (Step 6)
     */
    static async acceptFollowRequest(requestId, userId) {
        const [request] = await pool.query(
            'SELECT * FROM follow_requests WHERE request_id = ? AND target_user_id = ?',
            [requestId, userId]
        );

        if (!request[0]) throw new Error('Request not found or unauthorized');

        // Update request status to accepted
        await pool.query('UPDATE follow_requests SET status = "accepted" WHERE request_id = ?', [requestId]);

        try {
            // Create follower relationship
            await pool.query(
                'INSERT INTO follows (follower_id, following_id) VALUES (?, ?)',
                [request[0].requester_id, request[0].target_user_id]
            );

            // Notify requester that they were accepted (Step 7)
            await pool.query(`
                INSERT INTO notifications (notification_id, user_id, type, title, content, actor_id, action_url)
                VALUES (UUID(), ?, 'follow_accepted', 'Request Accepted', 'accepted your follow request.', ?, CONCAT('/profile/', (SELECT username FROM users WHERE user_id = ?)))
            `, [request[0].requester_id, userId, userId]);

            return true;
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') return true;
            throw error;
        }
    }

    /**
     * Reject follow request (Step 6)
     */
    static async rejectFollowRequest(requestId, userId) {
        await pool.query(
            'UPDATE follow_requests SET status = "declined" WHERE request_id = ? AND target_user_id = ?',
            [requestId, userId]
        );
        return true;
    }
}

module.exports = User;
