-- ============================================================
-- Migration: 20261122_media_registry_v2
-- Evolution of media_registry for Multi-Tier Cloud Storage
-- Supports Cloudflare R2 (Primary Active), Backblaze B2 (Archive/Cold),
-- and legacy Cloudinary provider independence.
-- ============================================================

ALTER TABLE media_registry
  ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(32) NOT NULL DEFAULT 'cloudinary' AFTER owner_id,
  ADD COLUMN IF NOT EXISTS bucket_name VARCHAR(128) NULL AFTER storage_provider,
  ADD COLUMN IF NOT EXISTS object_key VARCHAR(512) NULL AFTER bucket_name,
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(128) NULL AFTER object_key,
  ADD COLUMN IF NOT EXISTS checksum_sha256 VARCHAR(64) NULL AFTER hash_checksum,
  ADD COLUMN IF NOT EXISTS width INT NULL AFTER file_size_bytes,
  ADD COLUMN IF NOT EXISTS height INT NULL AFTER width,
  ADD COLUMN IF NOT EXISTS duration_seconds FLOAT NULL AFTER height,
  ADD COLUMN IF NOT EXISTS lifecycle_tier VARCHAR(32) NOT NULL DEFAULT 'active' AFTER lifecycle_state,
  ADD COLUMN IF NOT EXISTS migration_status VARCHAR(32) NOT NULL DEFAULT 'pending' AFTER lifecycle_tier,
  ADD COLUMN IF NOT EXISTS migrated_at DATETIME NULL AFTER migration_status,
  ADD COLUMN IF NOT EXISTS migration_error TEXT NULL AFTER migrated_at;
