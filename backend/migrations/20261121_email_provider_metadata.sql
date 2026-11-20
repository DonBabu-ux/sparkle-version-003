-- ============================================================
-- Migration 20261121: Email provider delivery metadata columns
-- ============================================================
-- Adds an optional column to record which email provider accepted
-- the OTP delivery. This is diagnostic metadata ONLY — it is never
-- read during OTP verification, which remains purely code-hash based.
-- Running this migration twice is safe (IF NOT EXISTS is idempotent).
-- ============================================================

ALTER TABLE email_verifications
  ADD COLUMN IF NOT EXISTS delivery_provider VARCHAR(20) NULL
    COMMENT 'gmail | resend — which provider accepted the message submission'
  AFTER verified_at;

ALTER TABLE otp_verifications
  ADD COLUMN IF NOT EXISTS delivery_provider VARCHAR(20) NULL
    COMMENT 'gmail | resend — which provider accepted the message submission'
  AFTER verified_at;

-- Note: MariaDB/MySQL 10.3+ supports IF NOT EXISTS on ALTER TABLE ADD COLUMN.
-- If using MySQL < 8.0.0, run the following instead (wrap in a stored procedure
-- or run manually only if the column does not already exist):
--
-- ALTER TABLE email_verifications ADD COLUMN delivery_provider VARCHAR(20) NULL AFTER verified_at;
-- ALTER TABLE otp_verifications   ADD COLUMN delivery_provider VARCHAR(20) NULL AFTER verified_at;
