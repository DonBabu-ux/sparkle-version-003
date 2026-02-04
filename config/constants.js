require('dotenv').config();

module.exports = {
    JWT_SECRET: process.env.JWT_SECRET || 'sparkle_secret',
    PORT: process.env.PORT || 5000,
    NODE_ENV: process.env.NODE_ENV || 'development'
};
