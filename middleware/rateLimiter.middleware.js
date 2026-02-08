const rateLimit = require('express-rate-limit');

exports.rateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        success: false,
        message: 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

exports.strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10, // Very strict limit for sensitive endpoints
    message: {
        success: false,
        message: 'Too many requests. Please wait before trying again.'
    }
});