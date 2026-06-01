// prisma.config.js - Prisma 7 configuration
require('dotenv').config();

module.exports = {
  datasource: {
    url: process.env.DATABASE_URL,
  },
};

