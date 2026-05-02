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
            // STALENESS CHECK: Ensure the cached user matches the current token's user
            if (cached.user.user_id === decoded.userId || cached.user.userId === decoded.userId) {
                if (decoded.tokenVersion === cached.user.token_version) {
                    req.user = cached.user;
                    return next();
                }
            } else {
                // Identity mismatch in cache (likely switched accounts quickly)
                userCache.delete(decoded.userId);
            }
        }

        // DB FALLBACK
        const [users] = await pool.query('SELECT * FROM users WHERE user_id = ?', [decoded.userId]);

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = users[0];
        const userData = { ...decoded, ...user, userType: user.user_role }; 

        // GLOBAL LOGOUT CHECK (Token Versioning)
        if (decoded.tokenVersion !== undefined && decoded.tokenVersion < user.token_version) {
            return res.status(401).json({ error: 'Session expired: Global logout performed' });
        }
        
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
    const token = req.cookies?.sparkleToken;

    if (publicPaths.includes(pathFromReq) || publicPaths.includes(pathFromOriginal)) {
        if (token && ['/', '/login', '/signup'].includes(pathFromReq)) {
            try {
                jwt.verify(token, JWT_SECRET);
                return res.redirect('/dashboard');
            } catch (err) {
                // Invalid token, proceed to public page
            }
        }
        return next();
    }

    if (!token) {
        return res.redirect('/login?reason=no_token');
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // CHECK CACHE FIRST
        const cached = userCache.get(decoded.userId);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
            // STALENESS CHECK: Ensure the cached user matches the current token's user
            if (cached.user.user_id === decoded.userId || cached.user.userId === decoded.userId) {
                req.user = cached.user;
                res.locals.user = req.user;
                return next();
            } else {
                userCache.delete(decoded.userId);
            }
        }

        // DB FALLBACK
        const [users] = await pool.query('SELECT * FROM users WHERE user_id = ?', [decoded.userId]);

        if (users.length === 0) {
            return res.redirect('/login?reason=user_not_found');
        }

        const user = users[0];
        const userData = { ...decoded, ...user, userType: user.user_role }; 
        
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

const optionalAuthMiddleware = async (req, res, next) => {
    try {
        let token = null;
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.split(' ')[1] !== 'null' && authHeader.split(' ')[1] !== 'undefined') {
            token = authHeader.split(' ')[1];
        } else if (req.cookies && req.cookies.sparkleToken) {
            token = req.cookies.sparkleToken;
        }

        if (!token) {
            return next();
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const [users] = await pool.query('SELECT * FROM users WHERE user_id = ?', [decoded.userId]);

        if (users.length > 0) {
            const user = users[0];
            req.user = { ...decoded, ...user, userType: user.user_role };
        }
        next();
    } catch (err) {
        // Just proceed without user
        next();
    }
};

module.exports = {
    authMiddleware,
    ejsAuthMiddleware,
    optionalAuthMiddleware
};
