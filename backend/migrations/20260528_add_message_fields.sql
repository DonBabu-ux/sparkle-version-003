-- Migration: add new columns to messages table
-- Adjust for your DB (PostgreSQL shown)

ALTER TABLE messages
  ADD COLUMN permissions JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN reactions JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN deleted_for TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN pinned BOOLEAN DEFAULT FALSE,
  ADD COLUMN edited BOOLEAN DEFAULT FALSE,
  ADD COLUMN edited_at TIMESTAMP NULL,
  ADD COLUMN forward_count INTEGER DEFAULT 0,
  ADD COLUMN reply_to_message_id TEXT NULL,
  ADD COLUMN reply_preview_text TEXT NULL,
  ADD COLUMN reply_preview_type VARCHAR(20) NULL;

-- Indexes for fast queries
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_pinned ON messages(pinned);
CREATE INDEX idx_messages_deleted_for ON messages USING GIN (deleted_for);
