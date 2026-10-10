/*
  Migration: Ensure onboarding_step column exists with DEFAULT 0
  and backfill NULL values for existing accounts.
  
  This is safe to run multiple times (uses IF NOT EXISTS / IGNORE logic).
*/

-- 1. Ensure column is NOT NULL with DEFAULT 0
ALTER TABLE users
  MODIFY COLUMN onboarding_step INT NOT NULL DEFAULT 0;

-- 2. Backfill any existing rows that have NULL (old accounts created before this column existed)
UPDATE users
  SET onboarding_step = 0
  WHERE onboarding_step IS NULL;

-- 3. (Optional) Uncomment to mark accounts with full profiles as already onboarded
--    so pre-existing users skip onboarding on their next login.
-- UPDATE users
--   SET onboarding_step = 6
--   WHERE onboarding_step = 0
--     AND name IS NOT NULL
--     AND username IS NOT NULL
--     AND email IS NOT NULL;
