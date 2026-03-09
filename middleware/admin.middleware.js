const pool = require('../config/database');

const adminMiddleware = async (req, res, next) => {
    try {
        const userId = req.user.userId || req.user.user_id;

        // Check if user exists and is admin
        const [users] = await pool.query(
            'SELECT role FROM users WHERE user_id = ? AND role IN ("admin", "moderator")',
            [userId]
        );

        if (!users[0]) {
            // For web routes, redirect; for API routes, return JSON
            if (req.originalUrl.startsWith('/api/')) {
                return res.status(403).json({
                    error: 'Access denied. Admin privileges required.'
                });
            }
            return res.status(403).render('error', {
                title: 'Access Denied',
                error: 'You do not have permission to access this page.',
                user: req.user
            });
        }

        req.user.role = users[0].role;
        next();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { adminMiddleware };
