// middleware/sparklyRateLimit.middleware.js
// Dedicated rate limiter for Sparkly AI Assistant

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');

/**
 * Key generator: Rate limit per authenticated user ID; fallback to IP
 */
const sparklyRateLimitKey = (req) => {
    if (req.user && (req.user.user_id || req.user.id)) {
        return `sparkly_u:${req.user.user_id || req.user.id}`;
    }

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
            if (decoded && (decoded.userId || decoded.id)) {
                return `sparkly_u:${decoded.userId || decoded.id}`;
            }
        } catch (e) {}
    }

    if (req.cookies && req.cookies.sparkleToken) {
        try {
            const decoded = jwt.verify(req.cookies.sparkleToken, JWT_SECRET);
            if (decoded && (decoded.userId || decoded.id)) {
                return `sparkly_u:${decoded.userId || decoded.id}`;
            }
        } catch (e) {}
    }

    return ipKeyGenerator(req.ip);
};

/**
 * Standard chat rate limiter: 40 requests per minute per user
 */
const sparklyChatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 40,
    keyGenerator: sparklyRateLimitKey,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false, default: true },
    message: {
        success: false,
        message: 'You are chatting with Sparkly too fast. Please take a breath and try again in a minute.'
    }
});

module.exports = {
    sparklyChatLimiter
};
