const rateLimit = require('express-rate-limit');

/**
 * Returns a rate limiter middleware based on whether the request has an authenticated user.
 * Logged‑in users are rate limited by the per‑user limits, otherwise we fall back to per‑IP limits.
 */
function createAIrateLimiter() {
  // per‑user limits (if req.user exists)
  const userLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute window for burst limits
    max: 20, // 20 requests per minute per user
    keyGenerator: (req) => (req.user && req.user.id ? `user-${req.user.id}` : `ip-${req.ip}`),
    handler: (req, res) => {
      return res.status(429).json({ error: 'Too many requests (per‑user limit)' });
    },
  });

  // per‑IP fallback limits (if no authenticated user)
  const ipLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 50, // 50 requests per minute per IP
    skip: (req) => !!(req.user && req.user.id), // skip IP limiter for logged‑in users
    handler: (req, res) => {
      return res.status(429).json({ error: 'Too many requests (per‑IP limit)' });
    },
  });

  // Combine: run userLimiter first, then ipLimiter if not skipped
  return [userLimiter, ipLimiter];
}

module.exports = { createAIrateLimiter };
