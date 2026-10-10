// middleware/referralRateLimit.middleware.js
// Rate limiter for public and authenticated referral endpoints
const rateLimit = require('express-rate-limit');

// Public invite click / view limiter (prevents click flood / scraping while allowing real humans)
const referralClickLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 120, // 120 requests per 15 mins per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many invite requests. Please try again in a few moments.'
  }
});

// User action limiter (e.g. manual referral claim, resolving handoff)
const referralActionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // 30 requests per 5 mins
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    keyGeneratorIpFallback: false
  },
  keyGenerator: (req) => {
    const userId = req.user?.userId || req.user?.user_id || req.user?.id;
    return userId ? `user-${userId}` : (req.ip || 'unknown');
  },
  message: {
    status: 'error',
    message: 'Too many referral operations. Please slow down.'
  }
});

module.exports = {
  referralClickLimiter,
  referralActionLimiter
};
