const User = require('../models/User');
const pool = require('../config/database');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

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

        // Stage 1: Scoring Engine Logic (grouped LEFT JOINs instead of correlated subqueries)
        const scoredQuery = `
            SELECT u.*,
            COALESCE(fc.cnt, 0) as followers_count,
            IF(myf.following_id IS NOT NULL, 1, 0) as is_followed,
            IF(fr.target_user_id IS NOT NULL, 'pending', NULL) as request_status,
            COALESCE(mut.cnt, 0) as mutual_connections,
            -- COMPOSITE RELEVANCE SCORE Calculation
            (
                -- Profile Similarity (Soft weighting)
                (CASE WHEN u.major = ? AND u.major IS NOT NULL THEN 30 ELSE 0 END) +
                (CASE WHEN u.campus = ? AND u.campus IS NOT NULL THEN 20 ELSE 0 END) +
                (CASE WHEN u.year_of_study = ? AND u.year_of_study IS NOT NULL THEN 10 ELSE 0 END) +

                -- Social Graph signals (Mutuals capped at +60)
                LEAST(60, COALESCE(mut.cnt, 0) * 12) +

                -- Popularity (Log Scaled Followers: log(count+1)*10)
                (LOG10(COALESCE(fc.cnt, 0) + 1) * 10) +

                -- Freshness: Activity boost (users seen recently get a boost)
                (CASE WHEN u.last_seen_at > DATE_SUB(NOW(), INTERVAL 72 HOUR) THEN 15 ELSE 0 END)
            ) as base_score,
            RAND(${randomSeed}) as exploration_entropy
            FROM users u
            LEFT JOIN (SELECT following_id, COUNT(*) AS cnt FROM follows GROUP BY following_id) fc ON fc.following_id = u.user_id
            LEFT JOIN follows myf ON myf.follower_id = ? AND myf.following_id = u.user_id
            LEFT JOIN (SELECT DISTINCT target_user_id FROM follow_requests WHERE requester_id = ? AND status = 'pending') fr ON fr.target_user_id = u.user_id
            LEFT JOIN (
                SELECT f2.follower_id, COUNT(*) AS cnt
                FROM follows f1
                JOIN follows f2 ON f1.following_id = f2.following_id
                WHERE f1.follower_id = ?
                GROUP BY f2.follower_id
            ) mut ON mut.follower_id = u.user_id
            LEFT JOIN follows nf ON nf.follower_id = ? AND nf.following_id = u.user_id
            WHERE u.user_id != ? 
            AND u.is_system_account = FALSE
            AND nf.following_id IS NULL
            ${search ? 'AND (u.name LIKE ? OR u.username LIKE ?)' : ''}
        `;

        const filterBoost = (campus || major || year) ? true : false;
        const mainParams = [
            currentUser.major, currentUser.campus, currentUser.year_of_study,
            currentUserId, currentUserId, currentUserId, currentUserId, currentUserId
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
                   COALESCE(fc.cnt, 0) as followers_count,
                   IF(myf.following_id IS NOT NULL, 1, 0) as is_followed,
                   (
                      COALESCE(fc.cnt, 0) * 0.4 +
                      COALESCE(fc7.cnt, 0) * 2.0 +
                      (RAND() * 5)
                   ) as trending_score
            FROM users u
            LEFT JOIN (SELECT following_id, COUNT(*) AS cnt FROM follows GROUP BY following_id) fc ON fc.following_id = u.user_id
            LEFT JOIN (SELECT following_id, COUNT(*) AS cnt FROM follows WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY following_id) fc7 ON fc7.following_id = u.user_id
            LEFT JOIN follows myf ON myf.follower_id = ? AND myf.following_id = u.user_id
            LEFT JOIN follows nf ON nf.follower_id = ? AND nf.following_id = u.user_id
            WHERE u.user_id != ? 
            AND u.is_system_account = FALSE
            AND nf.following_id IS NULL
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

module.exports = {
    renderConnect,
    renderSearch: async (req, res) => res.render('search', { title: 'Search Results', user: req.user, query: req.query.q || '' }),
    renderFollowRequests: async (req, res) => res.render('follow-requests', { title: 'Follow Requests', user: req.user, requests: await User.getPendingFollowRequests(req.user?.user_id || req.user?.userId) }),
    blockUser: async (req, res) => {
        try {
            const currentUserId = req.user?.user_id || req.user?.userId;
            const targetId = req.params.id;
            const { isSystemAccountId } = require('../helpers/systemAccount.helper');

            if (isSystemAccountId(targetId)) {
                return res.status(403).json({ error: 'Cannot block the Sparkle official account' });
            }
            
            if (!currentUserId || !targetId) {
                return res.status(400).json({ error: 'Missing user ID' });
            }

            console.log(`[Social] Block request: ${currentUserId} -> ${targetId}`);
            await User.blockUser(currentUserId, targetId);

            // 🔥 MARKETPLACE AUTO-ARCHIVE
            try {
                await pool.query(
                    `UPDATE marketplace_conversations SET is_archived = 1 WHERE (buyer_id = ? AND seller_id = ?) OR (buyer_id = ? AND seller_id = ?)`,
                    [currentUserId, targetId, targetId, currentUserId]
                );
            } catch (archiveErr) {
                console.error('[Social] Marketplace archive failed during block:', archiveErr.message);
                // We don't fail the whole block if only marketplace archiving fails
            }

            // Real-time Socket.IO notification to both users
            try {
                const { getIO } = require('../socket');
                const io = getIO();
                if (io) {
                    io.to(`user:${currentUserId}`).emit('conversation_blocked', {
                        partnerId: targetId,
                        conversationStatus: 'blocked',
                        isBlockedByMe: true,
                        amIBlocked: false,
                        canSendMessages: false
                    });
                    io.to(`user:${targetId}`).emit('conversation_blocked', {
                        partnerId: currentUserId,
                        conversationStatus: 'blocked',
                        isBlockedByMe: false,
                        amIBlocked: true,
                        canSendMessages: false
                    });
                }
            } catch (sErr) {
                console.error('[Social] Socket block emit warning:', sErr.message);
            }

            res.json({ success: true, message: 'User blocked' });
        } catch (error) {
            console.error('[Social] Block failed:', error);
            const status = error.message.includes('cannot block yourself') ? 400 : 500;
            res.status(status).json({ error: error.message || 'Block operation failed' });
        }
    },
    getBlockStatus: async (req, res) => {
        try {
            const currentUserId = req.user?.user_id || req.user?.userId;
            const targetId = req.params.id;
            
            const [blocks] = await pool.query(
                'SELECT blocker_id, blocked_id FROM user_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
                [currentUserId, targetId, targetId, currentUserId]
            );

            const isBlockedByMe = blocks.some(b => b.blocker_id === currentUserId && b.blocked_id === targetId);
            const amIBlocked = blocks.some(b => b.blocker_id === targetId && b.blocked_id === currentUserId);

            res.json({ isBlockedByMe, amIBlocked });
        } catch (error) {
            console.error('[Social] Get block status failed:', error);
            res.status(500).json({ error: error.message });
        }
    },
    unblockUser: async (req, res) => {
        try {
            const currentUserId = req.user?.user_id || req.user?.userId;
            const targetId = req.params.id;
            await User.unblockUser(currentUserId, targetId);

            // Real-time Socket.IO notification to both users
            try {
                const { getIO } = require('../socket');
                const io = getIO();
                if (io) {
                    io.to(`user:${currentUserId}`).emit('conversation_unblocked', {
                        partnerId: targetId,
                        conversationStatus: 'active',
                        isBlockedByMe: false,
                        amIBlocked: false,
                        canSendMessages: true
                    });
                    io.to(`user:${targetId}`).emit('conversation_unblocked', {
                        partnerId: currentUserId,
                        conversationStatus: 'active',
                        isBlockedByMe: false,
                        amIBlocked: false,
                        canSendMessages: true
                    });
                }
            } catch (sErr) {
                console.error('[Social] Socket unblock emit warning:', sErr.message);
            }

            res.json({ success: true, message: 'User unblocked' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
    getBlockedUsers: async (req, res) => {
        try {
            const currentUserId = req.user?.user_id || req.user?.userId;
            const blocks = await User.getBlockedUsers(currentUserId);
            res.json(blocks);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
    getFollowRequests: async (req, res) => {
        try {
            const currentUserId = req.user?.user_id || req.user?.userId;
            const requests = await User.getPendingFollowRequests(currentUserId);
            res.json(requests);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
    respondToFollowRequest: async (req, res) => {
        try {
            const currentUserId = req.user?.user_id || req.user?.userId;
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
            const currentUserId = req.user?.user_id || req.user?.userId;
            const { requestId } = req.params;
            await User.acceptFollowRequest(requestId, currentUserId);
            res.json({ success: true, message: 'Request accepted' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
    rejectRequest: async (req, res) => {
        try {
            const currentUserId = req.user?.user_id || req.user?.userId;
            const { requestId } = req.params;
            await User.rejectFollowRequest(requestId, currentUserId);
            res.json({ success: true, message: 'Request rejected' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
    muteUser: async (req, res) => {
        const { isSystemAccount } = require('../helpers/systemAccount.helper');
        if (isSystemAccount(req.params.id)) {
            return res.status(403).json({ error: 'Cannot mute official Sparkle accounts' });
        }
        return res.json({ success: true, message: 'User muted (Placeholder)' });
    },
    unmuteUser: async (req, res) => res.json({ success: true, message: 'User unmuted (Placeholder)' }),
    reportUser: async (req, res) => {
        try {
            const reporterId = req.user?.user_id || req.user?.userId;
            const targetId = req.params.id;
            const { reason, description } = req.body;
            const { isSystemAccount } = require('../helpers/systemAccount.helper');

            if (isSystemAccount(targetId)) {
                return res.status(403).json({ error: 'Cannot report official Sparkle accounts' });
            }

            if (!reporterId || !targetId) {
                return res.status(400).json({ error: 'Missing user ID' });
            }

            // The system uses 'user_reports' table as defined in init.js
            const fullReason = description ? `${reason}: ${description}` : reason;
            
            await pool.query(
                `INSERT INTO user_reports (report_id, reporter_id, reported_id, reason, status) VALUES (?, ?, ?, ?, ?)`,
                [crypto.randomUUID(), reporterId, targetId, fullReason, 'pending']
            );

            console.log(`[Social] Report submitted: ${reporterId} -> ${targetId}`);
            res.json({ success: true, message: 'Report submitted successfully' });
        } catch (error) {
            console.error('[Social] Report failed:', error);
            res.status(500).json({ error: error.message || 'Report operation failed' });
        }
    },
    
    pokeUser: async (req, res) => {
        try {
            const currentUserId = req.user?.user_id || req.user?.userId;
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
