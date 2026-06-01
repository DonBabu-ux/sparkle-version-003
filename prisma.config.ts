// prisma.config.ts - Prisma 7 configuration
// Constructs DATABASE_URL from existing env variables.
import 'dotenv/config';
import { defineConfig } from '@prisma/client';

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
});


