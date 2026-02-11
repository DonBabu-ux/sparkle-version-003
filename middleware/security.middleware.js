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
 * CSRF Protection middleware
 */
const csrfProtection = csrf({
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
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
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://www.gstatic.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            imgSrc: ["'self'", "blob:", "data:", "https:", "http:"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            connectSrc: ["'self'", "https://*.firebaseio.com", "wss://*.firebaseio.com", "https://*.googleapis.com", "https://www.gstatic.com"],
            mediaSrc: ["'self'", "blob:", "data:", "https:", "http:"],
        },
    },
});

module.exports = {
    createRateLimiter,
    authRateLimiter,
    apiRateLimiter,
    csrfProtection,  // Added this
    sanitizeInput,
    securityHeaders
};