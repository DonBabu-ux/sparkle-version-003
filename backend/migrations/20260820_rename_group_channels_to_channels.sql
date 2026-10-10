-- ============================================================
-- Migration: 20260820_rename_group_channels_to_channels
-- Renames group_channels table to channels and updates constraints.
-- ============================================================

-- Rename the table
ALTER TABLE group_channels RENAME TO channels;

-- Update foreign key references if any (e.g., in other tables referencing group_channels)
-- Assuming no direct FK, otherwise add statements.

-- Adjust indexes to match new table name
DROP INDEX idx_gc_chat_id ON channels;
CREATE INDEX idx_channels_chat_id ON channels(chat_id);

DROP INDEX idx_gc_position ON channels;
CREATE INDEX idx_channels_position ON channels(chat_id, position);

DROP INDEX idx_gc_archived ON channels;
CREATE INDEX idx_channels_archived ON channels(chat_id, is_archived);

-- Ensure primary key name consistency (optional)
ALTER TABLE channels DROP PRIMARY KEY;
ALTER TABLE channels ADD PRIMARY KEY (channel_id);

-- End of migration
