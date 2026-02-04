const pool = require('../config/database');

// Helper to sanitize avatars - prioritizes internal uploads
const getSafeAvatarUrl = (url) => {
    if (url && url.startsWith('/uploads/')) return url;
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

module.exports = { renderConnect };
