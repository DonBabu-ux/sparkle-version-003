// prisma.config.ts - Prisma 7 configuration
// Constructs DATABASE_URL from existing env variables.
import { defineConfig } from '@prisma/client';

const databaseUrl = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

export default defineConfig({
  datasource: {
    url: databaseUrl,
  },
});
