// backend/middleware/rateLimiter.js
// Simple in-memory rate limiter for per-user per-chat requests.
// Limits to maxRequests requests per windowMs milliseconds.
// Used for privacy settings PATCH and capture-attempt POST routes.

const rateLimits = new Map(); // key: `${userId}:${chatId}` => array of timestamps

function rateLimiter({ maxRequests = 10, windowMs = 60 * 1000 } = {}) {
  return (req, res, next) => {
    try {
      const user = req.user;
      const chatId = req.params.chatId;
      if (!user || !chatId) {
        return res.status(400).json({ error: 'Missing user or chatId for rate limiting' });
      }
      const key = `${user.id}:${chatId}`;
      const now = Date.now();
      const timestamps = rateLimits.get(key) || [];
      const windowStart = now - windowMs;
      const recent = timestamps.filter(t => t > windowStart);
      if (recent.length >= maxRequests) {
        return res.status(429).json({ error: `Too many requests. Limit is ${maxRequests} per ${windowMs / 1000}s.` });
      }
      recent.push(now);
      rateLimits.set(key, recent);
      next();
    } catch (e) {
      console.error('Rate limiter error:', e);
      next();
    }
  };
}

module.exports = rateLimiter;
