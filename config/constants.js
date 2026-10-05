require('dotenv').config();

// Fail fast: a missing/empty JWT_SECRET would otherwise silently fall back to a
// guessable literal, making issued tokens forgeable. Refuse to boot instead.
if (!process.env.JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET is not set. Refusing to start — set JWT_SECRET in .env (local) or the Render environment (prod).');
}

const jwtSecret = process.env.JWT_SECRET;
const SPARKLE_SYSTEM_USER_ID = process.env.SPARKLE_SYSTEM_USER_ID || 'd75fe3b5-7a45-4581-ab13-91934d8b54de';

module.exports = {
    JWT_SECRET: jwtSecret,
    SPARKLE_SYSTEM_USER_ID: SPARKLE_SYSTEM_USER_ID,
    PORT: process.env.PORT || 3001,
    NODE_ENV: process.env.NODE_ENV || 'development'
};
