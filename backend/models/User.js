const pool = require('../config/database');
const crypto = require('crypto');
const { SPARKLE_SYSTEM_USER_ID } = require('../config/constants');

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
     * Derives Social RPG Reputation Metrics
     */
    static deriveReputation(user) {
        const followers = user.followers_count || 0;
        const posts = user.posts_count || 0;
        
        let trustLevel = 1;
        if (followers >= 5000) trustLevel = 5;
        else if (followers >= 1000) trustLevel = 4;
        else if (followers >= 500) trustLevel = 3;
        else if (followers >= 100) trustLevel = 2;

        const prestigeScore = Math.min(100, Math.round(
            (followers / 1000) * 40 + 
            (posts / 50) * 20 +
            (trustLevel * 8)
        ));

        return {
            trustLevel,
            prestigeScore,
            nextThreshold: trustLevel < 5 ? [100, 500, 1000, 5000][trustLevel-1] : 5000,
            isVerified: !!user.is_verified
        };
    }

    /**
     * Helper to ensure avatar URLs are properly formatted
     */
    static getSafeAvatarUrl(url) {
        if (!url) return '/uploads/avatars/no-profile.png';
        if (url.startsWith('http')) return url;
        if (url.includes('uploads/')) {
            return url.startsWith('/') ? url : `/${url}`;
        }
        return '/uploads/avatars/no-profile.png';
    }

    /**
     * Helper to map legacy database columns to generalized concepts
     */
    static mapGeneralizedFields(user) {
        if (!user) return;
        const { formatSystemUser } = require('../helpers/systemAccount.helper');
        const formatted = formatSystemUser(user);
        Object.assign(user, formatted);
        user.affiliation = user.affiliation || user.campus;
        user.interests = user.interests || user.major;
        user.experience_level = user.experience_level || user.year_of_study;
        if (!user.is_system_account) {
            if (user.display_name === 'Sparkle Official') {
                user.display_name = user.name || user.username;
            }
            user.avatar_url = this.getSafeAvatarUrl(user.avatar_url || user.profile_picture || user.avatar);
        }
        return user;
    }

    /**
     * Find user by ID
     */
    // Superuser accounts bypass all account-status filters and always have live access
    static SUPERUSER_EMAILS = ['lewismwangi990@gmail.com'];

    static async findById(userId) {
        // use wildcard select so migration is optional; extra columns will be
        // ignored if they don't exist yet.
        // Note: no account_status filter here — the auth middleware handles lifecycle
        // gating; this query must succeed for all accounts including superusers.
        const [users] = await pool.query(
            `SELECT u.*,
                    (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) as followers_count,
                    (SELECT COUNT(*) FROM follows WHERE follower_id = u.user_id) as following_count,
                    (SELECT COUNT(*) FROM posts WHERE user_id = u.user_id) as posts_count,
                    (SELECT COUNT(*) FROM stories WHERE user_id = u.user_id AND (expires_at > NOW() OR (expires_at IS NULL AND created_at > NOW() - INTERVAL 24 HOUR))) > 0 as has_story
             FROM users u
             WHERE u.user_id = ?`,
            [userId]
        );
        const user = users[0] || null;
        if (user) {
            user.userType = this.deriveUserType(user);
            user.reputation = this.deriveReputation(user);
            this.mapGeneralizedFields(user);
            // Superuser boost: ensure followers_count >= 1000 so live-streams gate passes
            if (User.SUPERUSER_EMAILS.includes((user.email || '').toLowerCase())) {
                user.followers_count = Math.max(Number(user.followers_count) || 0, 1000);
            }
        }
        return user;
    }

    /**
     * Find user by username
     */
    static async findByUsername(username) {
        if (!username) return null;
        const { normalizeUsername } = require('../utils/validation/username');
        const norm = normalizeUsername(username);
        const [users] = await pool.query(
            'SELECT * FROM users WHERE username_normalized = ? OR username = ? LIMIT 1',
            [norm, username]
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
                userData.avatar_url || '/uploads/avatars/no-profile.png'
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
                   WHERE u.user_id != ? AND u.user_id != ?`;
        
        const params = [currentUserId, currentUserId, currentUserId, currentUserId, SPARKLE_SYSTEM_USER_ID];

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
        const relationshipQuery = `
            (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.user_id) as is_followed_by_me,
            (SELECT COUNT(*) FROM follows WHERE follower_id = u.user_id AND following_id = ?) as is_follower,
            (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) as followers_count
        `;

        if (!query || !query.trim()) {
            const [users] = await pool.query(
                `SELECT u.user_id, u.name, u.username, u.avatar_url, u.campus, u.major,
                        ${relationshipQuery}
                 FROM follows f
                 JOIN users u ON f.following_id = u.user_id
                 WHERE f.follower_id = ? AND u.user_id != ? AND u.user_id != ?
                 LIMIT ?`,
                [currentUserId, currentUserId, currentUserId, currentUserId, SPARKLE_SYSTEM_USER_ID, limit]
            );
            return users.map(u => ({ ...u, is_mutual: (u.is_followed_by_me && u.is_follower) }));
        }

        const [users] = await pool.query(
            `SELECT u.user_id, u.name, u.username, u.avatar_url, u.campus, u.major,
                    ${relationshipQuery}
             FROM follows f
             JOIN users u ON f.following_id = u.user_id
             WHERE f.follower_id = ? 
              AND u.user_id != ? AND u.user_id != ?
              AND (u.name LIKE ? OR u.username LIKE ?)
              LIMIT ?`,
            [currentUserId, currentUserId, currentUserId, currentUserId, SPARKLE_SYSTEM_USER_ID, `%${query}%`, `%${query}%`, limit]
        );
        return users.map(u => ({ ...u, is_mutual: (u.is_followed_by_me && u.is_follower) }));
    }

    /**
     * Get active friends (online or seen recently)
     */
    static async getActiveFriends(currentUserId, limit = 20) {
        const [users] = await pool.query(
            `SELECT DISTINCT u.user_id, u.username, u.name, u.avatar_url, u.campus, u.is_online, u.last_seen_at, u.note
             FROM users u
             WHERE u.user_id != ? AND u.user_id != ?
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
            [currentUserId, SPARKLE_SYSTEM_USER_ID, currentUserId, currentUserId, currentUserId, limit]
        );
        return users;
    }

    /**
     * Fetch a small set of users that the current user isn't already following.
     * Uses a weighted matching algorithm for discovery.
     */
    static async getSuggestions(currentUserId, options = {}) {
        try {
            const { limit = 20, offset = 0, seed = null, tab = 'for_you', filter = null, query = null } = options;

            // Fetch current user details for ranking
            const [me] = await pool.query('SELECT major, year_of_study, campus FROM users WHERE user_id = ?', [currentUserId]);
            if (!me[0]) return [];

            // Accept legacy ('for you') and new ('for_you') spellings; unknown tabs fall back to the blended feed.
            const tabKey = String(tab || '').toLowerCase().replace(/\s+/g, '_');
            const activeTab = ['for_you', 'follow_back', 'similar', 'same_campus', 'following'].includes(tabKey)
                ? tabKey
                : 'for_you';

            const numericSeed = seed ? parseInt(crypto.createHash('md5').update(String(seed)).digest('hex').substring(0, 8), 16) : null;
            const sqlSeed = numericSeed ? `(${numericSeed})` : '()';

            // ---- Signals (Facebook "people you may know" + Instagram "suggested for you", blended) ----
            // 1. Mutual follows - the strongest signal (Facebook's mutual friends).
            const mutualQuery = `(SELECT COUNT(*) FROM follows f1 JOIN follows f2 ON f1.following_id = f2.following_id WHERE f1.follower_id = ? AND f2.follower_id = u.user_id)`;
            // 2. Second degree: people followed by the people I follow (friends-of-friends).
            const secondDegreeQuery = `(SELECT COUNT(*) FROM follows mine JOIN follows theirs ON mine.following_id = theirs.follower_id WHERE mine.follower_id = ? AND theirs.following_id = u.user_id)`;
            // 3. Follows me but I don't follow back (Instagram's follow-back).
            const followsMeQuery = `(SELECT COUNT(*) FROM follows WHERE follower_id = u.user_id AND following_id = ?)`;
            // 4. Structured interest overlap.
            const interestOverlapQuery = `(SELECT COUNT(*) FROM user_interests a JOIN user_interests b ON a.interest_slug = b.interest_slug WHERE a.user_id = ? AND b.user_id = u.user_id)`;
            // 5. Engagement overlap (Instagram's interest graph): we engaged with the SAME posts / moments.
            // NOTE: MariaDB cannot correlate u.* from inside a derived table nested in a
            // select-list subquery, so this is a plain sum of correlated subqueries.
            const engagementOverlapQuery = `(
                (SELECT COUNT(*) FROM comments c
                   WHERE c.user_id = u.user_id
                     AND c.post_id IN (SELECT post_id FROM comments WHERE user_id = ?))
                +
                (SELECT COUNT(*) FROM moment_likes m
                   WHERE m.user_id = u.user_id
                     AND m.moment_id IN (SELECT moment_id FROM moment_likes WHERE user_id = ?))
                +
                (SELECT COUNT(*) FROM moment_comments mc
                   WHERE mc.user_id = u.user_id
                     AND mc.moment_id IN (SELECT moment_id FROM moment_comments WHERE user_id = ?))
            )`;

            let sql = `
                SELECT
                    u.*,
                    (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.user_id) as is_followed,
                    (SELECT status FROM follow_requests WHERE requester_id = ? AND target_user_id = u.user_id AND status = 'pending') as request_status,
                    (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) as follower_count,
                    ${mutualQuery} as mutual_connections,
                    ${secondDegreeQuery} as second_degree,
                    ${followsMeQuery} as follows_me,
                    ${interestOverlapQuery} as interest_overlap,
                    ${engagementOverlapQuery} as engagement_overlap,
                    (
                        -- 1. Mutual connections: 8 points each, capped at 48
                        (LEAST(${mutualQuery}, 6) * 8) +
                        -- 2. Friends-of-friends: 2 points each, capped at 16
                        (LEAST(${secondDegreeQuery}, 8) * 2) +
                        -- 3. Same campus / year / major
                        (CASE WHEN u.campus = ? THEN 12 ELSE 0 END) +
                        (CASE WHEN u.year_of_study = ? THEN 4 ELSE 0 END) +
                        (CASE WHEN u.major = ? THEN 10 ELSE 0 END) +
                        -- 4. Interest overlap: 4 points each, capped at 16
                        (LEAST(${interestOverlapQuery}, 4) * 4) +
                        -- 5. Engagement overlap: 3 points each, capped at 15
                        (LEAST(${engagementOverlapQuery}, 5) * 3) +
                        -- 6. Follows me (follow-back): flat 10
                        (CASE WHEN ${followsMeQuery} > 0 THEN 10 ELSE 0 END) +
                        -- 7. Activity + completeness as tie-breakers
                        (CASE WHEN u.is_online = 1 OR u.last_seen_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 5 ELSE 0 END) +
                        (CASE WHEN u.bio IS NOT NULL AND u.bio != '' THEN 2 ELSE 0 END) +
                        (CASE WHEN u.avatar_url IS NOT NULL AND u.avatar_url NOT LIKE '%default%' THEN 2 ELSE 0 END) +
                        -- 8. Variety so a refresh surfaces new faces
                        (RAND${sqlSeed} * 5)
                    ) as discovery_score
                FROM users u
                WHERE u.user_id != ? AND u.user_id != ?
            `;

            const params = [
                currentUserId, // is_followed
                currentUserId, // request_status
                currentUserId, // mutual_connections
                currentUserId, // second_degree
                currentUserId, // follows_me
                currentUserId, // interest_overlap
                currentUserId, // engagement: comments
                currentUserId, // engagement: moment_likes
                currentUserId, // engagement: moment_comments
                currentUserId, // mutual in score
                currentUserId, // second degree in score
                currentUserId, // interest overlap in score
                currentUserId, // engagement in score: comments
                currentUserId, // engagement in score: moment_likes
                currentUserId, // engagement in score: moment_comments
                currentUserId, // follows_me in score
                me[0].campus,   // campus match
                me[0].year_of_study, // year match
                me[0].major,    // major match
                currentUserId, // u.user_id != ?
                SPARKLE_SYSTEM_USER_ID // u.user_id != ?
            ];

            // ---- Exclusions (never force: no already-followed, no pending requests, no dismissed, no blocked) ----
            if (activeTab !== 'following') {
                sql += ` AND u.user_id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)`;
                params.push(currentUserId);
            }
            sql += ` AND u.user_id NOT IN (SELECT target_user_id FROM follow_requests WHERE requester_id = ? AND status = 'pending')`;
            params.push(currentUserId);
            sql += ` AND u.user_id NOT IN (SELECT target_user_id FROM suggestion_dismissals WHERE user_id = ?)`;
            params.push(currentUserId);
            sql += ` AND u.user_id NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = ?)`;
            params.push(currentUserId);
            sql += ` AND u.user_id NOT IN (SELECT blocker_id FROM user_blocks WHERE blocked_id = ?)`;
            params.push(currentUserId);

            // ---- Tab semantics ----
            if (activeTab === 'following') {
                sql += ` AND u.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)`;
                params.push(currentUserId);
            } else if (activeTab === 'follow_back') {
                sql += ` AND ${followsMeQuery} > 0`;
                params.push(currentUserId);
            } else if (activeTab === 'similar') {
                sql += ` AND (u.major = ? OR ${interestOverlapQuery} > 0)`;
                params.push(me[0].major, currentUserId);
            } else if (activeTab === 'same_campus') {
                sql += ` AND u.campus = ?`;
                params.push(me[0].campus);
            }

            // ---- Optional filters ----
            if (filter === 'campus') {
                sql += ` AND u.campus = ?`;
                params.push(me[0].campus);
            } else if (filter === 'interests') {
                sql += ` AND (u.major = ? OR ${interestOverlapQuery} > 0)`;
                params.push(me[0].major, currentUserId);
            } else if (filter === 'level') {
                sql += ` AND u.year_of_study = ?`;
                params.push(me[0].year_of_study);
            }

            // ---- Search query ----
            if (query && query.trim()) {
                sql += ` AND (u.name LIKE ? OR u.username LIKE ? OR u.major LIKE ? OR u.campus LIKE ?)`;
                params.push(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);
            }

            // MariaDB rejects placeholders in LIMIT/OFFSET; inline sanitized ints.
            const limitInt = Math.max(1, Math.min(parseInt(limit, 10) || 20, 50));
            const offsetInt = Math.max(0, parseInt(offset, 10) || 0);
            sql += ` ORDER BY discovery_score DESC LIMIT ${limitInt} OFFSET ${offsetInt}`;

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

            // Map fields and build human reasons (top 3) - the "why", so nothing feels forced.
            return users.map(u => {
                const mapped = this.mapGeneralizedFields(u);
                mapped.mutual_followers = mutualDetailsMap[u.user_id] || [];
                mapped.mutual_connections = Number(u.mutual_connections) || 0;

                const reasons = [];
                if (mapped.mutual_connections > 0) {
                    reasons.push(`${mapped.mutual_connections} mutual connection${mapped.mutual_connections > 1 ? 's' : ''}`);
                }
                if (Number(u.follows_me) > 0) reasons.push('Follows you');
                if (u.second_degree >= 2) reasons.push(`${u.second_degree} friends of your friends`);
                if (me[0].campus && u.campus === me[0].campus) reasons.push(`Same campus: ${u.campus}`);
                if (me[0].major && u.major === me[0].major) reasons.push(`Studies ${u.major}`);
                if (me[0].year_of_study && u.year_of_study === me[0].year_of_study) reasons.push(`Year ${u.year_of_study}`);
                if (Number(u.interest_overlap) > 0) reasons.push(`${u.interest_overlap} shared interest${u.interest_overlap > 1 ? 's' : ''}`);
                if (Number(u.engagement_overlap) > 0) reasons.push('Engages with posts you like');

                mapped.reasons = reasons.slice(0, 3);
                mapped.suggestion_reason = reasons[0] || 'Suggested for you';
                return mapped;
            });
        } catch (error) {
            console.error('[User Model] getSuggestions error:', error.message, error.stack);
            throw error;
        }
    }

    /**
     * Remember a dismissed suggestion so it never resurfaces (Facebook-style
     * "Remove suggestion"). Idempotent.
     */
    static async dismissSuggestion(currentUserId, targetUserId) {
        if (!currentUserId || !targetUserId || currentUserId === targetUserId) return false;
        await pool.query(
            `INSERT IGNORE INTO suggestion_dismissals (user_id, target_user_id) VALUES (?, ?)`,
            [currentUserId, targetUserId]
        );
        return true;
    }

    /**
     * Restore dismissed suggestions (used by "Undo" affordances).
     */
    static async undismissSuggestion(currentUserId, targetUserId) {
        if (!currentUserId || !targetUserId) return false;
        await pool.query(
            `DELETE FROM suggestion_dismissals WHERE user_id = ? AND target_user_id = ?`,
            [currentUserId, targetUserId]
        );
        return true;
    }

    /**
     * Get user with profile stats
     */
    static async getProfileWithStats(identifier, currentUserId) {
        if (!identifier) return null;
        const { normalizeUsername } = require('../utils/validation/username');
        const norm = normalizeUsername(identifier);
        const [users] = await pool.query(
            `SELECT u.*, 
                    (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) as followers_count,
                    (SELECT COUNT(*) FROM follows WHERE follower_id = u.user_id) as following_count,
                    (SELECT COUNT(*) FROM posts WHERE user_id = u.user_id) as posts_count,
                    (SELECT COUNT(*) FROM stories WHERE user_id = u.user_id AND (expires_at > NOW() OR (expires_at IS NULL AND created_at > NOW() - INTERVAL 24 HOUR))) > 0 as has_story,
                    (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.user_id) as is_followed_by_me,
                    (SELECT COUNT(*) FROM follow_requests WHERE requester_id = ? AND target_user_id = u.user_id AND status = 'pending') as is_requested_by_me
             FROM users u 
             WHERE u.username_normalized = ? OR u.username = ? OR u.user_id = ?`,
            [currentUserId, currentUserId, norm, identifier, identifier]
        );
        const user = users[0] || null;
        if (user) {
            user.userType = this.deriveUserType(user);
            user.reputation = this.deriveReputation(user);
            this.mapGeneralizedFields(user);
        }
        return user;
    }

    /**
     * Mark account for deletion (30-day pending deletion workflow)
     */
    static async delete(userId, reason = 'User requested deletion') {
        const accountLifecycleService = require('../services/accountLifecycle.service');
        return accountLifecycleService.requestDeletion({ userId, reason });
    }

    /**
     * Suspend account
     */
    static async suspend(userId, reason = 'Temporary suspension', expiresAt = null, actorId = 'self', actorRole = 'user') {
        const accountLifecycleService = require('../services/accountLifecycle.service');
        return accountLifecycleService.suspendAccount({ userId, reason, expiresAt, actorId, actorRole });
    }

    /**
     * Terminate account
     */
    static async terminate(userId, reason = 'Account terminated', actorId = 'self', actorRole = 'user') {
        const accountLifecycleService = require('../services/accountLifecycle.service');
        return accountLifecycleService.terminateAccount({ userId, reason, actorId, actorRole });
    }

    /**
     * Cancel deletion
     */
    static async cancelDeletion(userId, actorId = 'self') {
        const accountLifecycleService = require('../services/accountLifecycle.service');
        return accountLifecycleService.cancelDeletion({ userId, actorId });
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
            // Mark offline AND record the exit time (last seen) in UTC
            await pool.query('UPDATE users SET is_online = 0, last_seen_at = UTC_TIMESTAMP() WHERE user_id = ?', [userId]);
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
            'SELECT profile_visibility FROM users WHERE user_id = ?',
            [followingId]
        );

        if (!targetUser[0]) throw new Error('User not found');

        const isPrivate = targetUser[0].profile_visibility === 'private';

        if (isPrivate) {
            // Send follow request
            try {
                const requestId = crypto.randomUUID();
                await pool.query(
                    'INSERT INTO follow_requests (id, requester_id, target_user_id, status) VALUES (?, ?, ?, "pending")',
                    [requestId, followerId, followingId]
                );

                // Create notification for follow request (Step 7)
                const notificationController = require('../controllers/notification.controller');
                await notificationController.createNotification({
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
            try {
                const [rows] = await pool.query('SELECT username FROM users WHERE user_id = ?', [followerId]);
                const followerUsername = rows.length > 0 ? rows[0].username : 'someone';
                
                const notificationController = require('../controllers/notification.controller');
                if (notificationController && notificationController.createNotification) {
                    await notificationController.createNotification({
                        user_id: followingId,
                        type: 'follow',
                        title: 'New Follower',
                        content: 'started following you.',
                        actor_id: followerId,
                        action_url: `/profile/${followerUsername}`
                    }, pool);
                }
            } catch (notifyErr) {
                console.error('Non-blocking error creating follow notification:', notifyErr);
            }

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
            `SELECT u.user_id, u.name, u.username, u.avatar_url, u.campus, u.bio, u.note, u.is_online,
                    (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.user_id) as is_followed_by_me,
                    ${mutualQuery} as mutual_connections
             FROM follows f
             JOIN users u ON f.follower_id = u.user_id
             WHERE f.following_id = ? AND u.user_id != ? AND u.user_id != ?`,
            [currentUserId, currentUserId, userId, currentUserId, SPARKLE_SYSTEM_USER_ID]
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
             WHERE f.follower_id = ? AND u.user_id != ? AND u.user_id != ?`,
            [currentUserId, currentUserId, userId, currentUserId, SPARKLE_SYSTEM_USER_ID]
        );
        return following;
    }

    /**
     * Get mutual connections (people you follow who follow you back) for People Hub
     */
    static async getMutualFollowersList(currentUserId) {
        const [rows] = await pool.query(
            `SELECT u.user_id, u.name, u.username, u.avatar_url, u.campus, u.bio, u.is_online, u.last_seen_at,
                    GREATEST(f1.created_at, f2.created_at) as mutual_since,
                    pc.chat_id, pc.last_message_time
             FROM follows f1
             JOIN follows f2 ON f1.following_id = f2.follower_id AND f1.follower_id = f2.following_id
             JOIN users u ON f1.following_id = u.user_id
             LEFT JOIN personal_chats pc ON (
                (pc.participant1_id = ? AND pc.participant2_id = u.user_id) OR
                (pc.participant2_id = ? AND pc.participant1_id = u.user_id)
             )
             WHERE f1.follower_id = ? AND u.user_id != ? AND u.account_status = 'active'
             ORDER BY mutual_since DESC`,
            [currentUserId, currentUserId, currentUserId, currentUserId]
        );
        return rows;
    }

    /**
     * Match phone contacts / names against registered Sparkle users for People Hub
     */
    static async matchContactsList(currentUserId, searchQueries = []) {
        let queryParams = [currentUserId, currentUserId, currentUserId, currentUserId, currentUserId, SPARKLE_SYSTEM_USER_ID];

        let whereSql = '';
        if (Array.isArray(searchQueries) && searchQueries.length > 0) {
            const cleanQueries = searchQueries.filter(q => typeof q === 'string' && q.trim().length > 0).slice(0, 10);
            if (cleanQueries.length > 0) {
                const conds = cleanQueries.map(() => `(u.name LIKE ? OR u.username LIKE ?)`).join(' OR ');
                whereSql = `AND (${conds})`;
                cleanQueries.forEach(q => {
                    const term = `%${q.trim()}%`;
                    queryParams.push(term, term);
                });
            }
        }

        const [rows] = await pool.query(
            `SELECT u.user_id, u.name, u.username, u.avatar_url, u.campus, u.bio, u.is_online, u.last_seen_at,
                    (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.user_id) as is_following,
                    (SELECT COUNT(*) FROM follows WHERE follower_id = u.user_id AND following_id = ?) as follows_me,
                    pc.chat_id
             FROM users u
             LEFT JOIN personal_chats pc ON (
                (pc.participant1_id = ? AND pc.participant2_id = u.user_id) OR
                (pc.participant2_id = ? AND pc.participant1_id = u.user_id)
             )
             WHERE u.user_id != ? AND u.user_id != ? AND u.account_status = 'active' ${whereSql}
             ORDER BY u.name ASC
             LIMIT 60`,
            queryParams
        );

        return rows.map(r => ({
            ...r,
            is_following: !!r.is_following,
            follows_me: !!r.follows_me,
            is_mutual: !!(r.is_following && r.follows_me)
        }));
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
                'INSERT INTO user_blocks (block_id, blocker_id, blocked_id) VALUES (?, ?, ?)',
                [crypto.randomUUID(), blockerId, blockedId]
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
            'SELECT * FROM follow_requests WHERE id = ? AND target_user_id = ?',
            [requestId, userId]
        );

        if (!request[0]) throw new Error('Request not found or unauthorized');

        // Update request status to accepted
        await pool.query('UPDATE follow_requests SET status = "accepted" WHERE id = ?', [requestId]);

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
            'UPDATE follow_requests SET status = "rejected" WHERE id = ? AND target_user_id = ?',
            [requestId, userId]
        );
        return true;
    }
}

User.pool = pool;

module.exports = User;
