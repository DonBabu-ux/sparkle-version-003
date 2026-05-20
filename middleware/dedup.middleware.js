// middleware/dedup.middleware.js
// Prevents duplicate concurrent requests (double-submit, accidental retries)
// Uses Redis to create a short-lived lock keyed on user+action fingerprint
const redisClient = require('../config/redis');
const crypto = require('crypto');

/**
 * @param {number} ttlMs - Lock duration in milliseconds (default 5s)
 */
const dedupRequest = (ttlMs = 5000) => async (req, res, next) => {
    try {
        // Fingerprint = IP + method + path + body hash
        const bodyHash = crypto
            .createHash('sha1')
            .update(JSON.stringify(req.body || {}))
            .digest('hex')
            .slice(0, 12);

        const ip = req.headers['x-forwarded-for'] || req.ip || 'unknown';
        const key = `dedup:${ip}:${req.method}:${req.path}:${bodyHash}`;

        // NX = Only set if key does not exist
        const set = await redisClient.set(key, '1', 'PX', ttlMs, 'NX');

        if (set === null) {
            // Lock already exists — duplicate request
            return res.status(429).json({
                status: 'error',
                message: 'Duplicate request. Please wait before retrying.'
            });
        }

        next();
    } catch (err) {
        // Redis down — fail open (do not block the request)
        next();
    }
};

module.exports = { dedupRequest };
