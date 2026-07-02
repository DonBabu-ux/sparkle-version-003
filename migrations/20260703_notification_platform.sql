-- ============================================================
-- Migration: Sparkle Notification Platform
-- Date: 2026-07-03
-- Description: Upgrades notifications table to support structured
--   payloads, priorities, categories, entities, and official flags.
--   Also enforces the system account as a non-user entity.
-- ============================================================

-- ── 1. Upgrade `notifications` table ─────────────────────────────────────────
-- Add structured columns if they don't already exist

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS sender_id   VARCHAR(36)  NULL COMMENT 'NULL = platform itself, UUID = actor user',
  ADD COLUMN IF NOT EXISTS icon        VARCHAR(100) NULL COMMENT 'Icon key (e.g. shield, bell, party)',
  ADD COLUMN IF NOT EXISTS entities    JSON         NOT NULL DEFAULT ('[]') COMMENT 'Rich-text entity spans [{type,id,text}]',
  ADD COLUMN IF NOT EXISTS actions     JSON         NOT NULL DEFAULT ('[]') COMMENT 'CTA buttons [{label,route,style}]',
  ADD COLUMN IF NOT EXISTS priority    ENUM('critical','high','normal','low') NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS category    ENUM('security','social','system','announcement','onboarding','commerce','community') NOT NULL DEFAULT 'social',
  ADD COLUMN IF NOT EXISTS is_official BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'TRUE = sent by Sparkle platform';

-- Index for fast unread + category queries
ALTER TABLE notifications
  ADD INDEX IF NOT EXISTS idx_user_category   (user_id, category),
  ADD INDEX IF NOT EXISTS idx_user_priority   (user_id, priority),
  ADD INDEX IF NOT EXISTS idx_user_official   (user_id, is_official),
  ADD INDEX IF NOT EXISTS idx_created_at_desc (created_at DESC);

-- ── 2. Upgrade `push_notifications` table (keep in sync) ─────────────────────
ALTER TABLE push_notifications
  ADD COLUMN IF NOT EXISTS sender_id   VARCHAR(36)  NULL,
  ADD COLUMN IF NOT EXISTS icon        VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS entities    JSON         NOT NULL DEFAULT ('[]'),
  ADD COLUMN IF NOT EXISTS actions     JSON         NOT NULL DEFAULT ('[]'),
  ADD COLUMN IF NOT EXISTS priority    ENUM('critical','high','normal','low') NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS category    ENUM('security','social','system','announcement','onboarding','commerce','community') NOT NULL DEFAULT 'social',
  ADD COLUMN IF NOT EXISTS is_official BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 3. Ensure Sparkle System Account exists with fixed UUID ──────────────────
-- SPARKLE_SYSTEM_USER_ID = d75fe3b5-7a45-4581-ab13-91934d8b54de
INSERT INTO users (
  user_id, name, username, email, password_hash,
  user_type, account_status, is_verified, onboarding_step,
  profile_reminder_disabled
)
VALUES (
  'd75fe3b5-7a45-4581-ab13-91934d8b54de',
  'Sparkle',
  'sparkle',
  'official@sparkle.app',
  'NO_LOGIN',
  'system',
  'active',
  1,
  6,
  TRUE
)
ON DUPLICATE KEY UPDATE
  name     = VALUES(name),
  username = VALUES(username),
  user_type = 'system',
  account_status = 'active',
  is_verified = 1;

-- ── 4. Add `is_system_account` flag to users (for backend guard queries) ──────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_system_account BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark the system account
UPDATE users
  SET is_system_account = TRUE
  WHERE user_id = 'd75fe3b5-7a45-4581-ab13-91934d8b54de';

-- ── 5. Rename old `content` column alias to `body` via a generated column ────
-- We keep `content` for backward compatibility and add `body` as an alias.
-- If your MySQL version supports generated columns (5.7+):
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS body TEXT GENERATED ALWAYS AS (content) STORED COMMENT 'Alias of content; used by structured payload schema';
