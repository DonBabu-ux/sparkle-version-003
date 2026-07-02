require('dotenv').config();

const jwtSecret = process.env.JWT_SECRET || 'sparkle_secret';
const SPARKLE_SYSTEM_USER_ID = process.env.SPARKLE_SYSTEM_USER_ID || 'd75fe3b5-7a45-4581-ab13-91934d8b54de';

module.exports = {
    JWT_SECRET: jwtSecret,
    SPARKLE_SYSTEM_USER_ID: SPARKLE_SYSTEM_USER_ID,
    JWT_SECRET: jwtSecret,
    PORT: process.env.PORT || 3001,
    NODE_ENV: process.env.NODE_ENV || 'development'
};
