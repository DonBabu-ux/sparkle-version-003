const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { JWT_SECRET } = require('../config/constants');

const authMiddleware = async (req, res, next) => {
    let token = null;
    const authHeader = req.headers['authorization'];
    if (authHeader) {
        token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.sparkleToken) {
        token = req.cookies.sparkleToken;
    }

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const [users] = await pool.query('SELECT user_id, name, username, campus, avatar_url FROM users WHERE user_id = ?', [decoded.userId]);

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        req.user = { ...decoded, ...users[0] };
        next();
    } catch (err) {
        console.error('❌ Auth Middleware Error:', err.message);
        res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
};

const ejsAuthMiddleware = async (req, res, next) => {
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });

    const token = req.cookies?.sparkleToken;
    if (!token) return res.redirect('/login');

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const [users] = await pool.query('SELECT user_id, name, username, campus, avatar_url FROM users WHERE user_id = ?', [decoded.userId]);

        if (users.length === 0) return res.redirect('/login');

        req.user = { ...decoded, ...users[0] };
        res.locals.user = req.user;
        next();
    } catch (err) {
        res.clearCookie('sparkleToken');
        res.redirect('/login');
    }
};

module.exports = {
    authMiddleware,
    ejsAuthMiddleware
};
