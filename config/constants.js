require('dotenv').config();

const jwtSecret = process.env.JWT_SECRET || 'sparkle_secret';

module.exports = {
    JWT_SECRET: jwtSecret,
    PORT: process.env.PORT || 3001,
    NODE_ENV: process.env.NODE_ENV || 'development'
};
