// backend/middleware/auth.middleware.js
// Simple authentication middleware stub.
// Checks for a JWT in the Authorization header and attaches decoded payload to req.user.
// If no token or verification fails, request proceeds without user info.

const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    // No auth header – continue as unauthenticated.
    return next();
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return next();
  }

  try {
    const secret = process.env.JWT_SECRET || 'default_jwt_secret';
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
  } catch (err) {
    console.warn('[WARN] Invalid JWT:', err.message);
    // Proceed without attaching user information.
  }

  next();
}

module.exports = { authMiddleware };
