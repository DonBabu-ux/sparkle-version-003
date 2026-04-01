const User = require('../models/User');
const pool = require('../config/database');

// Helper to sanitize avatars - prioritizes internal uploads
const getSafeAvatarUrl = (url) => {
    if (url) {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        if (url.startsWith('uploads/')) {
            return '/' + url;
        }
        if (url.startsWith('/uploads/')) {
            return url;
        }
    }
    return '/uploads/avatars/default.png';
};

const renderConnect = async (req, res) => {
    try {
        const currentUserId = req.user.userId || req.user.user_id;
        const { campus, major, year, search } = req.query;

        // Device-level randomness seed (same logic as Batch 1)
        const getSeedFromDevice = (req) => {
            const ua = req.headers['user-agent'] || 'sparkle-default';
            let hash = 0;
            for (let i = 0; i < ua.length; i++) {
                hash = ((hash << 5) - hash) + ua.charCodeAt(i);
                hash |= 0;
            }
            // Add a "refresh session" component - rotate every hour
            const hourlySeed = Math.floor(Date.now() / (1000 * 60 * 60));
            return Math.abs(hash + hourlySeed);
        };
        const randomSeed = getSeedFromDevice(req);

        // 1. Fetch current user to get their major/campus/year for suggestions ranking
        const currentUser = await User.findById(currentUserId);
        if (!currentUser) throw new Error('User not found');

        // 2. Active Friends
        const activeFriends = await User.getActiveFriends(currentUserId, 15);

        // 3. For You (Scored Recommendations with high entropy)
        let suggestionQuery = `
            SELECT u.*, 
            (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) as followers_count,
            (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.user_id) as is_followed,
            (SELECT status FROM follow_requests WHERE requester_id = ? AND target_user_id = u.user_id AND status = 'pending') as request_status,
            (SELECT COUNT(*) FROM follows f1 JOIN follows f2 ON f1.following_id = f2.following_id WHERE f1.follower_id = ? AND f2.follower_id = u.user_id) as mutual_connections,
            (
                (CASE WHEN u.major = ? AND u.major IS NOT NULL AND u.major != '' THEN 30 ELSE 0 END) +
                ((SELECT COUNT(*) FROM follows f1 JOIN follows f2 ON f1.following_id = f2.following_id WHERE f1.follower_id = ? AND f2.follower_id = u.user_id) * 8) +
                (CASE WHEN u.campus = ? AND u.campus IS NOT NULL AND u.campus != '' THEN 20 ELSE 0 END) +
                (CASE WHEN u.year_of_study = ? AND u.year_of_study IS NOT NULL AND u.year_of_study != '' THEN 10 ELSE 0 END) +
                (RAND(${randomSeed}) * 40) +
                (CASE WHEN ? != 'all' AND u.campus = ? THEN 100 ELSE 0 END) +
                (CASE WHEN ? != 'all' AND u.major = ? THEN 100 ELSE 0 END) +
                (CASE WHEN ? != 'all' AND u.year_of_study = ? THEN 100 ELSE 0 END)
            ) as match_score
            FROM users u 
            WHERE u.user_id != ? 
            AND u.user_id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)`;
        
        const safeCampusFilter = (campus && campus !== 'all') ? campus : 'all';
        const safeMajorFilter = (major && major !== 'all') ? major : 'all';
        const safeYearFilter = (year && year !== 'all') ? year : 'all';

        const suggestionParams = [
            currentUserId, currentUserId, currentUserId,
            currentUser.major || '', currentUserId, currentUser.campus || '', currentUser.year_of_study || '',
            safeCampusFilter, safeCampusFilter,
            safeMajorFilter, safeMajorFilter,
            safeYearFilter, safeYearFilter,
            currentUserId, currentUserId
        ];

        if (search) { 
            suggestionQuery += ' AND (u.name LIKE ? OR u.username LIKE ?)'; 
            const s = `%${search}%`; 
            suggestionParams.push(s, s); 
        }

        suggestionQuery += `
            ORDER BY match_score DESC
            LIMIT 30`;

        const [suggestedUsers] = await pool.query(suggestionQuery, suggestionParams);

        // 4. Trending People (Rotation Logic: Base on followers but shuffle with seed)
        const [trendingUsers] = await pool.query(`
            SELECT u.*, 
            (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) as followers_count,
            (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.user_id) as is_followed,
            (SELECT status FROM follow_requests WHERE requester_id = ? AND target_user_id = u.user_id AND status = 'pending') as request_status
            FROM users u 
            WHERE u.user_id != ? 
            AND u.user_id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)
            ORDER BY (followers_count * 0.7) + (RAND(${randomSeed}) * 100) DESC
            LIMIT 10`, [currentUserId, currentUserId, currentUserId, currentUserId]);

        // 5. Same Affiliation (Randomized within group)
        const [sameAffiliation] = currentUser.campus ? await pool.query(`
            SELECT u.*, 
            (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) as followers_count,
            (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.user_id) as is_followed,
            (SELECT status FROM follow_requests WHERE requester_id = ? AND target_user_id = u.user_id AND status = 'pending') as request_status
            FROM users u 
            WHERE u.user_id != ? AND u.campus = ?
            AND u.user_id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)
            ORDER BY RAND(${randomSeed})
            LIMIT 10`, [currentUserId, currentUserId, currentUserId, currentUser.campus, currentUserId]) : [[]];

        // 6. Similar Interests (Randomized within group)
        const [similarInterests] = currentUser.major ? await pool.query(`
            SELECT u.*, 
            (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) as followers_count,
            (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.user_id) as is_followed,
            (SELECT status FROM follow_requests WHERE requester_id = ? AND target_user_id = u.user_id AND status = 'pending') as request_status
            FROM users u 
            WHERE u.user_id != ? AND u.major = ?
            AND u.user_id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)
            ORDER BY RAND(${randomSeed})
            LIMIT 10`, [currentUserId, currentUserId, currentUserId, currentUser.major, currentUserId]) : [[]];

        // 7. People You Follow
        const followingUsers = await User.getFollowingDetailed(currentUserId, currentUserId);

        const mapUser = (u) => ({
            ...u,
            id: u.user_id,
            avatar_url: getSafeAvatarUrl(u.avatar_url),
            is_followed: !!u.is_followed,
            request_status: u.request_status,
            is_developer: u.bio ? (u.bio.toLowerCase().includes('developer') || u.bio.toLowerCase().includes('creator') || (u.username && ['sparkle', 'admin', 'donbabu'].includes(u.username.toLowerCase()))) : false
        });

        res.render('connect', { 
            title: 'Connect', 
            user: { ...currentUser, userId: currentUserId },
            activeFriends: activeFriends ? activeFriends.map(mapUser) : [],
            suggestedUsers: suggestedUsers ? suggestedUsers.map(mapUser) : [],
            trendingUsers: trendingUsers ? trendingUsers.map(mapUser) : [],
            sameAffiliation: sameAffiliation ? sameAffiliation.map(mapUser) : [],
            similarInterests: similarInterests ? similarInterests.map(mapUser) : [],
            followingUsers: followingUsers ? followingUsers.map(mapUser) : [],
            filters: { campus, major, year, search } 
        });
    } catch (error) {
        console.error('Connect Error:', error);
        res.render('connect', { 
            title: 'Connect', 
            user: req.user, 
            activeFriends: [],
            suggestedUsers: [],
            creators: [],
            followingUsers: [],
            filters: {} 
        });
    }
};

const renderSearch = async (req, res) => {
    res.render('search', {
        title: 'Search results - Sparkle',
        user: req.user,
        query: req.query.q || ''
    });
};

const renderFollowRequests = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const requests = await User.getPendingFollowRequests(userId);
        res.render('follow-requests', { 
            title: 'Follow Requests', 
            user: req.user, 
            requests: requests || [] 
        });
    } catch (error) {
        console.error('Render Follow Requests Error:', error);
        res.render('follow-requests', { title: 'Follow Requests', user: req.user, requests: [] });
    }
};

const blockUser = async (req, res) => {
    try {
        const blockerId = req.user.userId || req.user.user_id;
        const blockedId = req.params.id;

        await User.blockUser(blockerId, blockedId);
        res.json({ message: 'User blocked successfully' });
    } catch (error) {
        console.error('Block user error:', error);
        res.status(500).json({ error: 'Failed to block user' });
    }
};

const unblockUser = async (req, res) => {
    try {
        const blockerId = req.user.userId || req.user.user_id;
        const blockedId = req.params.id;

        await User.unblockUser(blockerId, blockedId);
        res.json({ message: 'User unblocked successfully' });
    } catch (error) {
        console.error('Unblock user error:', error);
        res.status(500).json({ error: 'Failed to unblock user' });
    }
};

const getBlockedUsers = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const blocks = await User.getBlockedUsers(userId);
        res.json(blocks);
    } catch (error) {
        console.error('Get blocked users error:', error);
        res.status(500).json({ error: 'Failed to get blocked users' });
    }
};

const getFollowRequests = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const requests = await User.getPendingFollowRequests(userId);
        res.json(requests);
    } catch (error) {
        console.error('Get follow requests error:', error);
        res.status(500).json({ error: 'Failed to get follow requests' });
    }
};

const respondToFollowRequest = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { requestId, action } = req.body; // action: 'accept' or 'reject'
        const rId = requestId || req.params.requestId;

        if (action === 'accept' || req.path.endsWith('/accept')) {
            await User.acceptFollowRequest(rId, userId);
            res.json({ success: true, message: 'Follow request accepted' });
        } else {
            await User.rejectFollowRequest(rId, userId);
            res.json({ success: true, message: 'Follow request rejected' });
        }
    } catch (error) {
        console.error('Respond to follow request error:', error);
        res.status(500).json({ error: 'Failed to process follow request' });
    }
};

const acceptRequest = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { requestId } = req.params;
        await User.acceptFollowRequest(requestId, userId);
        res.json({ success: true, message: 'Follow request accepted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const rejectRequest = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { requestId } = req.params;
        await User.rejectFollowRequest(requestId, userId);
        res.json({ success: true, message: 'Follow request rejected' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const muteUser = async (req, res) => {
    try {
        const blockerId = req.user.userId || req.user.user_id;
        const mutedId = req.params.id;
        // In a real app, this would update a 'user_mutes' table
        // For Sparkle MVP, we'll use a pool query directly if table exists, or just mock success
        await pool.query('INSERT IGNORE INTO user_blocks (block_id, blocker_id, blocked_id) VALUES (UUID(), ?, ?)', [blockerId, mutedId]);
        res.json({ success: true, message: 'User muted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to mute user' });
    }
};

const unmuteUser = async (req, res) => {
    try {
        const blockerId = req.user.userId || req.user.user_id;
        const mutedId = req.params.id;
        await pool.query('DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?', [blockerId, mutedId]);
        res.json({ success: true, message: 'User unmuted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to unmute user' });
    }
};

const reportUser = async (req, res) => {
    try {
        const reporterId = req.user.userId || req.user.user_id;
        const reportedId = req.params.id;
        const { reason } = req.body;
        // Mocking report storage
        console.log(`User ${reporterId} reported ${reportedId} for: ${reason}`);
        res.json({ success: true, message: 'User reported. Thank you for keeping Sparkle safe!' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to report user' });
    }
};

module.exports = {
    renderConnect,
    renderSearch,
    renderFollowRequests,
    blockUser,
    unblockUser,
    getBlockedUsers,
    getFollowRequests,
    respondToFollowRequest,
    acceptRequest,
    rejectRequest,
    muteUser,
    unmuteUser,
    reportUser
};
