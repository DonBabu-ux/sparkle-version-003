-- ============================================================
-- Migration 010: Email verification rewards & optional verification
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS sparkle_points INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS email_verification_rewards (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL UNIQUE,
    points_awarded INT NOT NULL DEFAULT 25,
    status VARCHAR(32) NOT NULL DEFAULT 'credited',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_evr_user_id (user_id)
);
