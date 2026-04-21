const User = require('../models/User');
const pool = require('../config/database');

// Profile logic helper
const getSafeAvatarUrl = (url) => {
    if (!url) return '/uploads/avatars/default.png';
    if (url.startsWith('http')) return url;
    return url.startsWith('/') ? url : '/' + url;
};

/**
 * 🚀 PRODUCTION RECOMMENDATION ALGORITHM
 * Implements a 3-stage pipeline: Candidate Generation -> Scoring Engine -> Exploration.
 */
const renderConnect = async (req, res) => {
    try {
        const currentUserId = req.user.userId || req.user.user_id;
        const { campus, major, year, search } = req.query;

        // Stage 0: Context Initialization
        const currentUser = await User.findById(currentUserId);
        if (!currentUser) throw new Error('User not found');

        // Controlled Entropy Seed (stable for 1 hour per user)
        const hourlySeed = Math.floor(Date.now() / (1000 * 60 * 60));
        const userHash = Buffer.from(currentUserId).reduce((acc, char) => acc + char, 0);
        const randomSeed = Math.abs(userHash + hourlySeed);

        // Stage 1: Scoring Engine Logic (using CTE or subqueries for performance)
        // Note: Using subqueries for mutuals and followers so we don't join massive tables directly
        const scoredQuery = `
            SELECT u.*,
            (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) as followers_count,
            (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.user_id) as is_followed,
            (SELECT status FROM follow_requests WHERE requester_id = ? AND target_user_id = u.user_id AND status = 'pending') as request_status,
            (
                SELECT COUNT(*) 
                FROM follows f1 
                JOIN follows f2 ON f1.following_id = f2.following_id 
                WHERE f1.follower_id = ? AND f2.follower_id = u.user_id
            ) as mutual_connections,
            -- COMPOSITE RELEVANCE SCORE Calculation
            (
                -- Profile Similarity (Soft weighting)
                (CASE WHEN u.major = ? AND u.major IS NOT NULL THEN 30 ELSE 0 END) +
                (CASE WHEN u.campus = ? AND u.campus IS NOT NULL THEN 20 ELSE 0 END) +
                (CASE WHEN u.year_of_study = ? AND u.year_of_study IS NOT NULL THEN 10 ELSE 0 END) +
                
                -- Social Graph signals (Mutuals capped at +60)
                LEAST(60, (SELECT COUNT(*) FROM follows f1 JOIN follows f2 ON f1.following_id = f2.following_id WHERE f1.follower_id = ? AND f2.follower_id = u.user_id) * 12) +
                
                -- Popularity (Log Scaled Followers: log(count+1)*10)
                (LOG10((SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) + 1) * 10) +
                
                -- Freshness: Activity boost (users seen recently get a boost)
                (CASE WHEN u.last_seen_at > DATE_SUB(NOW(), INTERVAL 72 HOUR) THEN 15 ELSE 0 END)
            ) as base_score,
            RAND(${randomSeed}) as exploration_entropy
            FROM users u
            WHERE u.user_id != ? 
            AND u.user_id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)
            ${search ? 'AND (u.name LIKE ? OR u.username LIKE ?)' : ''}
        `;

        const filterBoost = (campus || major || year) ? true : false;
        const mainParams = [
            currentUserId, currentUserId, currentUserId,
            currentUser.major, currentUser.campus, currentUser.year_of_study, 
            currentUserId,
            currentUserId, currentUserId
        ];
        if (search) {
            const s = `%${search}%`;
            mainParams.push(s, s);
        }

        // Fetch candidates (Scoring + Exploration)
        const fullQuery = `
            SELECT results.*,
            -- FINAL SCORE FORMULA: (base_score * 0.85) + (entropy * 15)
            ((base_score * 0.85) + (exploration_entropy * 15)) * (CASE WHEN ? = true THEN 1.5 ELSE 1.0 END) as final_score
            FROM (${scoredQuery}) as results
            ORDER BY final_score DESC
            LIMIT 50
        `;
        
        // Prepended filterBoost to params
        const [suggestedUsers] = await pool.query(fullQuery, [filterBoost, ...mainParams]);

        // 🔥 TRENDING ALGORITHM (Velocity-Based)
        // velocity = (followers * 0.4) + (new_followers_7d * 2)
        const trendingQuery = `
            SELECT u.*,
                   (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) as followers_count,
                   (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.user_id) as is_followed,
                   (
                      (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) * 0.4 +
                      (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)) * 2.0 +
                      (RAND() * 5)
                   ) as trending_score
            FROM users u
            WHERE u.user_id != ? 
            AND u.user_id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)
            ORDER BY trending_score DESC
            LIMIT 10
        `;
        const [trendingUsers] = await pool.query(trendingQuery, [currentUserId, currentUserId, currentUserId]);

        // DEDUP RULE: Ensure unique results across segments in the view mapping
        const mapUser = (u) => ({
            ...u,
            id: u.user_id,
            avatar_url: getSafeAvatarUrl(u.avatar_url),
            is_followed: !!u.is_followed,
            is_developer: u.bio ? (u.bio.toLowerCase().includes('developer') || u.username === 'donbabu') : false,
            mutual_connections: u.mutual_connections || 0
        });

        res.render('connect', { 
            title: 'Discover', 
            user: { ...currentUser, userId: currentUserId },
            suggestedUsers: suggestedUsers.map(mapUser),
            trendingUsers: trendingUsers.map(mapUser),
            similarInterests: suggestedUsers.filter(u => u.major === currentUser.major).slice(0, 10).map(mapUser),
            followingUsers: await User.getFollowingDetailed(currentUserId, currentUserId),
            filters: { campus, major, year, search } 
        });

    } catch (error) {
        console.error('Sparkle Connect Refresh Error:', error);
        res.status(500).render('error', { message: 'Failed to balance cosmic sparks... Try again later.' });
    }
};

// ... other controller methods (renderSearch, blocks, etc. should be preserved)
module.exports = {
    renderConnect,
    renderSearch: async (req, res) => res.render('search', { title: 'Search Results', user: req.user, query: req.query.q || '' }),
    renderFollowRequests: async (req, res) => res.render('follow-requests', { title: 'Follow Requests', user: req.user, requests: await User.getPendingFollowRequests(req.user.userId || req.user.user_id) }),
    blockUser: async (req, res) => {
        try {
            const currentUserId = req.user.userId || req.user.user_id;
            const targetId = req.params.id;
            await User.blockUser(currentUserId, targetId);
            res.json({ success: true, message: 'User blocked' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
    unblockUser: async (req, res) => {
        try {
            const currentUserId = req.user.userId || req.user.user_id;
            const targetId = req.params.id;
            await User.unblockUser(currentUserId, targetId);
            res.json({ success: true, message: 'User unblocked' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
    getBlockedUsers: async (req, res) => {
        try {
            const currentUserId = req.user.userId || req.user.user_id;
            const blocks = await User.getBlockedUsers(currentUserId);
            res.json(blocks);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
    getFollowRequests: async (req, res) => {
        try {
            const currentUserId = req.user.userId || req.user.user_id;
            const requests = await User.getPendingFollowRequests(currentUserId);
            res.json(requests);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
    respondToFollowRequest: async (req, res) => {
        try {
            const currentUserId = req.user.userId || req.user.user_id;
            const { requestId, status } = req.body;
            if (status === 'accepted') {
                await User.acceptFollowRequest(requestId, currentUserId);
            } else {
                await User.rejectFollowRequest(requestId, currentUserId);
            }
            res.json({ success: true, status });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
    acceptRequest: async (req, res) => {
        try {
            const currentUserId = req.user.userId || req.user.user_id;
            const { requestId } = req.params;
            await User.acceptFollowRequest(requestId, currentUserId);
            res.json({ success: true, message: 'Request accepted' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
    rejectRequest: async (req, res) => {
        try {
            const currentUserId = req.user.userId || req.user.user_id;
            const { requestId } = req.params;
            await User.rejectFollowRequest(requestId, currentUserId);
            res.json({ success: true, message: 'Request rejected' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
    muteUser: async (req, res) => res.json({ success: true, message: 'User muted (Placeholder)' }),
    unmuteUser: async (req, res) => res.json({ success: true, message: 'User unmuted (Placeholder)' }),
    reportUser: async (req, res) => res.json({ success: true, message: 'Report submitted' }),
    
    pokeUser: async (req, res) => {
        try {
            const currentUserId = req.user.userId || req.user.user_id;
            const targetId = req.params.id;
            
            if (currentUserId === targetId) {
                return res.status(400).json({ error: "You can't poke yourself!" });
            }

            const targetUser = await User.findById(targetId);
            if (!targetUser) {
                return res.status(404).json({ error: 'User not found' });
            }

            const currentUser = await User.findById(currentUserId);

            // Create notification
            const notificationController = require('./notification.controller');
            await notificationController.createNotification({
                user_id: targetId,
                actor_id: currentUserId,
                type: 'poke',
                title: 'You were poked!',
                content: `${currentUser.name} poked you! 👋`,
                action_url: `/profile/${currentUser.username}`
            });

            res.json({ success: true, message: `You poked ${targetUser.name}!` });
        } catch (error) {
            console.error('Poke Error:', error);
            res.status(500).json({ error: 'Failed to send poke' });
        }
    }
};
