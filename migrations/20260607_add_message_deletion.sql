-- Migration: Add persistent message deletion support
-- Idempotent creation of message_hidden table and alteration of messages table

-- 1. Create message_hidden table to store per‑user hidden messages
CREATE TABLE IF NOT EXISTS message_hidden (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    message_id BIGINT NOT NULL,
    hidden_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_hidden (user_id, message_id),
    INDEX idx_hidden_user (user_id),
    INDEX idx_hidden_message (message_id),
    CONSTRAINT fk_hidden_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_hidden_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Add deletion metadata columns to messages table
ALTER TABLE messages 
    ADD COLUMN IF NOT EXISTS deleted_for_everyone BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL,
    ADD COLUMN IF NOT EXISTS deleted_by BIGINT NULL;

-- 3. Indexes for fast look‑ups (if they do not already exist)
CREATE INDEX IF NOT EXISTS idx_messages_deleted ON messages(deleted_for_everyone);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

-- 4. Optional foreign key for deleted_by (points to users)
ALTER TABLE messages 
    ADD CONSTRAINT fk_message_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL;

-- End of migration
