const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { JWT_SECRET } = require('../config/constants');

// Memory cache to prevent constant logouts during DB instability
const userCache = new Map();
const CACHE_TTL = 2 * 60 * 1000; // 2 Minutes

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
        
        // CHECK CACHE FIRST
        const cached = userCache.get(decoded.userId);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
            req.user = cached.user;
            return next();
        }

        // DB FALLBACK
        const [users] = await pool.query('SELECT * FROM users WHERE user_id = ?', [decoded.userId]);

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userData = { ...decoded, ...users[0] };
        
        // UPDATE CACHE
        userCache.set(decoded.userId, { user: userData, timestamp: Date.now() });
        
        req.user = userData;
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

    const token = req.cookies?.sparkleToken;
    if (!token) {
        return res.redirect('/login?reason=no_token');
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // CHECK CACHE FIRST
        const cached = userCache.get(decoded.userId);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
            req.user = cached.user;
            res.locals.user = req.user;
            return next();
        }

        // DB FALLBACK
        const [users] = await pool.query('SELECT * FROM users WHERE user_id = ?', [decoded.userId]);

        if (users.length === 0) {
            return res.redirect('/login?reason=user_not_found');
        }

        const userData = { ...decoded, ...users[0] };
        
        // UPDATE CACHE
        userCache.set(decoded.userId, { user: userData, timestamp: Date.now() });

        req.user = userData;
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
