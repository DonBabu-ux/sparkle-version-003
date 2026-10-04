const rateLimit = require('express-rate-limit');

exports.rateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        success: false,
        message: 'Too many requests, please try again later after a while.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

exports.strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10, // Very strict limit for sensitive endpoints
    message: {
        success: false,
        message: 'Too many requests. Please wait before trying again later after a while.'
    }
});

exports.loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            status: 'error',
            code: 'TOO_MANY_ATTEMPTS',
            message: "You've tried to log in too many times. Please wait a moment before trying again."
        });
    }
});