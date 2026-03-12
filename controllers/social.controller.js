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
        let query = 'SELECT u.*, (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.user_id) as is_followed FROM users u WHERE u.user_id != ?';
        const params = [currentUserId, currentUserId];

        if (campus && campus !== 'all') { query += ' AND u.campus = ?'; params.push(campus); }
        if (major && major !== 'all') { query += ' AND u.major = ?'; params.push(major); }
        if (year && year !== 'all') { query += ' AND u.year_of_study = ?'; params.push(year); }
        if (search) { query += ' AND (u.name LIKE ? OR u.username LIKE ?)'; const s = `%${search}%`; params.push(s, s); }

        const [users] = await pool.query(query + ' LIMIT 50', params);

        // Sanitize avatars - prioritizing internal uploads
        const sanitizedUsers = users.map(user => ({
            ...user,
            avatar_url: getSafeAvatarUrl(user.avatar_url)
        }));

        res.render('connect', { title: 'Connect', initialUsers: sanitizedUsers || [], filters: { campus, major, year, search } });
    } catch (error) {
        console.error('Connect Error:', error);
        res.render('connect', { title: 'Connect', initialUsers: [], filters: {} });
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
        const { requestId, action } = req.body; // action: 'accept' or 'decline'

        if (action === 'accept') {
            await User.acceptFollowRequest(requestId, userId);
            res.json({ message: 'Follow request accepted' });
        } else {
            await User.declineFollowRequest(requestId, userId);
            res.json({ message: 'Follow request declined' });
        }
    } catch (error) {
        console.error('Respond to follow request error:', error);
        res.status(500).json({ error: 'Failed to process follow request' });
    }
};

module.exports = {
    renderConnect,
    blockUser,
    unblockUser,
    getBlockedUsers,
    getFollowRequests,
    respondToFollowRequest
};
