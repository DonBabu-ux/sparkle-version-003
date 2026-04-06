const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const csrf = require('csurf');
const { body, validationResult } = require('express-validator');

/**
 * Rate limiting configuration
 */
const createRateLimiter = (windowMs = 15 * 60 * 1000, max = 100) => {
    return rateLimit({
        windowMs,
        max,
        message: 'Too many requests from this IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
    });
};

/**
 * Strict rate limiter for auth endpoints
 */
const authRateLimiter = createRateLimiter(15 * 60 * 1000, 5); // 5 requests per 15 minutes

/**
 * General API rate limiter
 */
const apiRateLimiter = createRateLimiter(1 * 60 * 1000, 60); // 60 requests per minute

/**
 * Listings/feed rate limiter — prevents page hammering the DB
 * 30 requests per minute per IP (e.g., fetching marketplace, posts)
 */
const feedRateLimiter = createRateLimiter(1 * 60 * 1000, 30);

/**
 * Mutation rate limiter — POST/PUT/DELETE that write to DB
 * 10 requests per minute per IP
 */
const mutationRateLimiter = createRateLimiter(1 * 60 * 1000, 10);

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
 * CSRF Protection middleware
 */
const csrfProtection = csrf({
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    }
});

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
});

module.exports = {
    createRateLimiter,
    authRateLimiter,
    apiRateLimiter,
    feedRateLimiter,
    mutationRateLimiter,
    imageLimiter,
    csrfProtection,
    sanitizeInput,
    securityHeaders
};