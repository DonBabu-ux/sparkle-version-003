-- ============================================================
-- Migration: 20260815_create_group_channels
-- Adds the group_channels table that replaces any hardcoded
-- channel lists in the UI.  Channels belong to a group_chat
-- row via chat_id.
-- ============================================================

CREATE TABLE IF NOT EXISTS group_channels (
  channel_id   CHAR(36)     NOT NULL,
  chat_id      CHAR(36)     NOT NULL,             -- FK → group_chats.chat_id
  name         VARCHAR(80)  NOT NULL,
  type         ENUM('TEXT','VOICE','ANNOUNCEMENT','MEDIA','POLL') NOT NULL DEFAULT 'TEXT',
  icon         VARCHAR(32)  NOT NULL DEFAULT '💬',
  position     INT          NOT NULL DEFAULT 0,
  created_by   CHAR(36)     NULL,                 -- user_id of creator
  is_default   TINYINT(1)   NOT NULL DEFAULT 0,
  is_read_only TINYINT(1)   NOT NULL DEFAULT 0,
  is_archived  TINYINT(1)   NOT NULL DEFAULT 0,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (channel_id),
  INDEX idx_gc_chat_id   (chat_id),
  INDEX idx_gc_position  (chat_id, position),
  INDEX idx_gc_archived  (chat_id, is_archived)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Seed default channels for every existing group chat ─────────────────────
-- Insert a single #general channel for any chat that has none yet.
INSERT INTO group_channels (channel_id, chat_id, name, type, icon, position, created_by, is_default)
SELECT
  UUID()           AS channel_id,
  gc.chat_id       AS chat_id,
  'general'        AS name,
  'TEXT'           AS type,
  '📢'             AS icon,
  0                AS position,
  gc.creator_id    AS created_by,
  1                AS is_default
FROM group_chats gc
WHERE NOT EXISTS (
  SELECT 1 FROM group_channels gch WHERE gch.chat_id = gc.chat_id
);
