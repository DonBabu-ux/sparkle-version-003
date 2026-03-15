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
        // Updated to use the new join and status check
        let query = `
            SELECT u.*, 
            (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.user_id) as is_followed,
            (SELECT status FROM follow_requests WHERE requester_id = ? AND target_user_id = u.user_id AND status = 'pending') as request_status
            FROM users u 
            WHERE u.user_id != ?`;
        const params = [currentUserId, currentUserId, currentUserId];

        if (campus && campus !== 'all') { query += ' AND u.campus = ?'; params.push(campus); }
        if (major && major !== 'all') { query += ' AND u.major = ?'; params.push(major); }
        if (year && year !== 'all') { query += ' AND u.year_of_study = ?'; params.push(year); }
        if (search) { query += ' AND (u.name LIKE ? OR u.username LIKE ?)'; const s = `%${search}%`; params.push(s, s); }

        const [users] = await pool.query(query + ' LIMIT 50', params);

        // Sanitize avatars
        const sanitizedUsers = users.map(user => ({
            ...user,
            id: user.user_id,
            avatar_url: getSafeAvatarUrl(user.avatar_url),
            is_followed: !!user.is_followed,
            request_status: user.request_status
        }));

        res.render('connect', { 
            title: 'Connect', 
            user: { ...req.user, userId: currentUserId }, // Ensure user object persists
            initialUsers: sanitizedUsers || [], 
            filters: { campus, major, year, search } 
        });
    } catch (error) {
        console.error('Connect Error:', error);
        res.render('connect', { title: 'Connect', user: req.user, initialUsers: [], filters: {} });
    }
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
    renderFollowRequests,
    blockUser,
    unblockUser,
    getBlockedUsers,
    getFollowRequests,
    respondToFollowRequest,
    acceptRequest,
    rejectRequest
};
