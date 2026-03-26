const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { JWT_SECRET } = require('../config/constants');

const authMiddleware = async (req, res, next) => {
    try {
        let token = null;
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.split(' ')[1] !== 'null' && authHeader.split(' ')[1] !== 'undefined') {
            token = authHeader.split(' ')[1];
        } else if (req.cookies && req.cookies.sparkleToken) {
            token = req.cookies.sparkleToken;
        }

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized: No token provided' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const [users] = await pool.query('SELECT * FROM users WHERE user_id = ?', [decoded.userId]);

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


    // This is a safety net to ensure public routes are never blocked even if path normalization fails.
    const urlCheck = req.originalUrl.toLowerCase().split('?')[0];
    if (
        urlCheck === '/' ||
        urlCheck.startsWith('/login') ||
        urlCheck.startsWith('/signup') ||
        urlCheck.startsWith('/about') ||
        urlCheck.startsWith('/logout') ||
        urlCheck.startsWith('/legal') ||
        urlCheck.startsWith('/favicon.ico') ||
        urlCheck.startsWith('/public') ||
        urlCheck.startsWith('/uploads')
    ) {
        return next();
    }

    const pathFromReq = req.path.toLowerCase().replace(/\/+$/, '') || '/';
    const pathFromOriginal = req.originalUrl.split('?')[0].toLowerCase().replace(/\/+$/, '') || '/';
    const publicPaths = ['/login', '/signup', '/about', '/', '/logout', '/legal', '/terms', '/privacy', '/favicon.ico'];

    if (publicPaths.includes(pathFromReq) || publicPaths.includes(pathFromOriginal)) {
        return next();
    }

    res.setHeader('X-Auth-Decision', 'No Token/Redirect');

    const token = req.cookies?.sparkleToken;
    if (!token) {
        console.warn(`⚠️ ejsAuthMiddleware: No token found for protected path: ${req.path} (normalized: ${pathFromReq}), redirecting to login`);
        return res.redirect('/login?reason=no_token');
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const [users] = await pool.query('SELECT * FROM users WHERE user_id = ?', [decoded.userId]);

        if (users.length === 0) {
            console.warn('⚠️ authMiddleware: User not found in DB for valid token');
            return res.redirect('/login?reason=user_not_found');
        }

        req.user = { ...decoded, ...users[0] };
        res.locals.user = req.user;
        next();
    } catch (err) {
        console.error('❌ ejsAuthMiddleware Error:', err.message);
        res.clearCookie('sparkleToken');
        res.redirect('/login?reason=auth_failed');
    }
};

module.exports = {
    authMiddleware,
    ejsAuthMiddleware
};
