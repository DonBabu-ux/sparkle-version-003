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

        // 1. Fetch current user to get their major/campus/year for suggestions ranking
        const currentUser = await User.findById(currentUserId);
        if (!currentUser) throw new Error('User not found');

        // 2. Active Friends
        const activeFriends = await User.getActiveFriends(currentUserId, 15);

        // 3. Suggested Users (Ranked)
        let suggestionQuery = `
            SELECT u.*, 
            (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) as followers_count,
            (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.user_id) as is_followed,
            (SELECT status FROM follow_requests WHERE requester_id = ? AND target_user_id = u.user_id AND status = 'pending') as request_status,
            (SELECT COUNT(*) FROM follows f1 JOIN follows f2 ON f1.following_id = f2.following_id WHERE f1.follower_id = ? AND f2.follower_id = u.user_id) as mutual_connections
            FROM users u 
            WHERE u.user_id != ? 
            AND u.user_id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)`;
        
        const suggestionParams = [currentUserId, currentUserId, currentUserId, currentUserId, currentUserId];

        // Apply filters if present
        if (campus && campus !== 'all') { suggestionQuery += ' AND u.campus = ?'; suggestionParams.push(campus); }
        if (major && major !== 'all') { suggestionQuery += ' AND u.major = ?'; suggestionParams.push(major); }
        if (year && year !== 'all') { suggestionQuery += ' AND u.year_of_study = ?'; suggestionParams.push(year); }
        if (search) { 
            suggestionQuery += ' AND (u.name LIKE ? OR u.username LIKE ?)'; 
            const s = `%${search}%`; 
            suggestionParams.push(s, s); 
        }

        suggestionQuery += `
            ORDER BY 
                CASE WHEN u.major = ? THEN 0 ELSE 1 END,
                CASE WHEN u.year_of_study = ? THEN 0 ELSE 1 END,
                CASE WHEN u.campus = ? THEN 0 ELSE 1 END,
                followers_count DESC
            LIMIT 20`;
        suggestionParams.push(currentUser.major, currentUser.year_of_study, currentUser.campus);

        const [suggestedUsers] = await pool.query(suggestionQuery, suggestionParams);

        // 4. Developers / Creators
        const [creators] = await pool.query(`
            SELECT u.*, 
            (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.user_id) as is_followed,
            (SELECT status FROM follow_requests WHERE requester_id = ? AND target_user_id = u.user_id AND status = 'pending') as request_status
            FROM users u 
            WHERE u.user_id != ? 
            AND (u.bio LIKE '%developer%' OR u.bio LIKE '%creator%' OR u.username IN ('sparkle', 'admin', 'donbabu'))
            LIMIT 10`, [currentUserId, currentUserId, currentUserId]);

        // 5. People You Follow
        const followingUsers = await User.getFollowingDetailed(currentUserId, currentUserId);

        // helper to map users
        const mapUser = (u) => ({
            ...u,
            id: u.user_id,
            avatar_url: getSafeAvatarUrl(u.avatar_url),
            is_followed: !!u.is_followed,
            request_status: u.request_status,
            is_developer: u.bio ? (u.bio.toLowerCase().includes('developer') || u.bio.toLowerCase().includes('creator')) : false
        });

        res.render('connect', { 
            title: 'Connect', 
            user: { ...currentUser, userId: currentUserId },
            activeFriends: activeFriends.map(mapUser),
            suggestedUsers: suggestedUsers.map(mapUser),
            creators: creators.map(mapUser),
            followingUsers: followingUsers.map(mapUser),
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
    rejectRequest
};
