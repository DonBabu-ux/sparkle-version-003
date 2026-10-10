-- Migration: Add persistent message deletion support
-- This script is idempotent for a fresh dev database.

-- ------------------------------------------------------------
-- 1. Drop the old table if it exists (dev only – safe because the table is newly introduced)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS message_hidden;

-- ------------------------------------------------------------
-- 2. Create message_hidden with correct FK types
-- ------------------------------------------------------------
CREATE TABLE message_hidden (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    message_id CHAR(36) NOT NULL,
    hidden_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_hidden (user_id, message_id),
    INDEX idx_hidden_user (user_id),
    INDEX idx_hidden_message (message_id),

    CONSTRAINT fk_hidden_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_hidden_message
        FOREIGN KEY (message_id) REFERENCES messages(message_id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 3. Add deletion‑metadata columns to messages
-- ------------------------------------------------------------
ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS deleted_for_everyone TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL,
    ADD COLUMN IF NOT EXISTS deleted_by CHAR(36) NULL;

-- ------------------------------------------------------------
-- 4. Indexes for fast look‑ups (run only once)
-- ------------------------------------------------------------
-- Simplified migration: only add columns if not exists. Index creation and FK addition omitted to avoid duplicate errors.
    ALTER TABLE messages
        ADD COLUMN IF NOT EXISTS deleted_for_everyone TINYINT(1) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL,
        ADD COLUMN IF NOT EXISTS deleted_by CHAR(36) NULL;
    -- Indexes and foreign key omitted for idempotency.

