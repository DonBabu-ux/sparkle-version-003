const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;
const helmet = require('helmet');
const csrf = require('csurf');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * Rate limiting configuration
 */
// Authenticated requests are limited per USER (valid JWT), anonymous per IP.
// Without this, hundreds of users behind one campus NAT share a single
// 500/min bucket and get 429'd together. Invalid/expired tokens fall back
// to the IP key so token-flooding cannot bypass the limiter.
const rateLimitKey = (req) => {
    const fromToken = (token) => {
        if (!token || token === 'null' || token === 'undefined') return null;
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (decoded && decoded.userId) return 'u:' + decoded.userId;
        } catch (e) { logger.debug('rate-limit key: invalid/expired token, falling back to IP key'); }
        return null;
    };
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const userKey = fromToken(authHeader.slice(7));
        if (userKey) return userKey;
    }
    if (req.cookies && req.cookies.sparkleToken) {
        const userKey = fromToken(req.cookies.sparkleToken);
        if (userKey) return userKey;
    }
    return ipKeyGenerator(req.ip);
};

const createRateLimiter = (windowMs = 15 * 60 * 1000, max = 100) => {
    return rateLimit({
        windowMs,
        max,
        keyGenerator: rateLimitKey,
        message: 'Too many requests. Please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
    });
};

/**
 * Strict rate limiter for auth endpoints
 */
const authRateLimiter = createRateLimiter(15 * 60 * 1000, 20); // 20 attempts per 15 minutes

/**
 * General API rate limiter
 * Increased to 500 per minute to handle high-fidelity telemetry (dwell, exit, etc)
 */
const apiRateLimiter = createRateLimiter(1 * 60 * 1000, 500); // 500 requests per minute 

/**
 * Listings/feed rate limiter — prevents page hammering the DB
 * 100 requests per minute per IP (e.g., fetching marketplace, posts)
 */
const feedRateLimiter = createRateLimiter(10 * 1000, 60); // 60 requests per 10 seconds

/**
 * Mutation rate limiter — POST/PUT/DELETE that write to DB
 * 10 requests per minute per IP
 */
const mutationRateLimiter = createRateLimiter(1 * 60 * 1000, 30); // 30 writes per minute

/**
 * Static image rate limiter — stops 400+ identical image requests
 * 60 requests per minute per IP for any single static path
 */
const imageLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Only rate-limit repeated fetches of the same default/placeholder images
        return !req.path.match(/default-|placeholder/);
    },
    validate: false
});

/**
 * CSRF Protection middleware (double-submit token in the httpOnly `_csrf`
 * cookie), scoped to mutations that actually ride cookie auth:
 *  - Bearer-token clients are exempt — a cross-site attacker page cannot set
 *    the Authorization header, so those requests cannot be forged.
 *  - Requests without the `sparkleToken` cookie have no session to protect
 *    (login/signup/refresh, Paystack webhooks, probes).
 *  - login/signup/refresh are exempt by path (A.4 #2): they carry their own
 *    secret (credentials or the refresh token itself) and must work from a
 *    browser that already holds the httpOnly session cookie — a cookie-auth
 *    `/auth/refresh` with no CSRF header was 403-ing refresh (masked in
 *    practice by the H26 x-refresh-token header renewal).
 * A browser session (cookie present, no Bearer) must present the token.
 */
const csurfProtection = csrf({
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
});

const csrfProtection = (req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    // A.4 #2 — auth bootstrap paths: their body/credentials ARE the proof and
    // SameSite=Strict already blocks cross-site cookie sends. A logged-in
    // browser attaches sparkleToken to /auth/refresh (path '/'), which used to
    // drag csurf onto refresh and 403 it whenever H26 hadn't renewed first.
    if (req.path === '/auth/login' || req.path === '/auth/signup' || req.path === '/auth/refresh') return next();
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) return next();
    if (!req.cookies || !req.cookies.sparkleToken) return next();
    return csurfProtection(req, res, next);
};

/**
 * Sanitization middleware to prevent XSS
 */
const sanitizeInput = (req, res, next) => {
    const sanitize = (obj) => {
        if (typeof obj === 'string') {
            return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        }
        if (typeof obj === 'object' && obj !== null) {
            Object.keys(obj).forEach(key => {
                obj[key] = sanitize(obj[key]);
            });
        }
        return obj;
    };

    if (req.body) req.body = sanitize(req.body);
    if (req.query) req.query = sanitize(req.query);
    if (req.params) req.params = sanitize(req.params);

    next();
};

/**
 * Helmet security headers
 */
const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com", "https://cdn.tailwindcss.com", "https://cdn.jsdelivr.net"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://www.gstatic.com", "https://cdn.tailwindcss.com", "https://unpkg.com", "https://cdn.jsdelivr.net"],
            scriptSrcAttr: ["'unsafe-inline'"],
            imgSrc: ["'self'", "blob:", "data:", "https:", "http:"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            connectSrc: ["'self'", "https://*.firebaseio.com", "wss://*.firebaseio.com", "https://*.googleapis.com", "https://www.gstatic.com", "https://cdn.tailwindcss.com", "https://unpkg.com", "https://*.supabase.co", "https://cdn.jsdelivr.net", "https://api.tenor.com", "https://api.giphy.com"],
            mediaSrc: ["'self'", "blob:", "data:", "https:", "http:"],
        },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false
});

module.exports = {
    createRateLimiter,
    authRateLimiter,
    apiRateLimiter,
    feedRateLimiter,
    mutationRateLimiter,
    imageLimiter,
    csrfProtection,
    csrfTokenProtection: csurfProtection,
    sanitizeInput,
    securityHeaders
};
