-- Migration: create screenshot_audit table
-- Adjust for your DB (PostgreSQL shown)

CREATE TABLE screenshot_audit (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  chat_id VARCHAR(255) NOT NULL,
  attempted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  method VARCHAR(20) NOT NULL CHECK (method IN ('screenshot', 'screenrecording')),
  ip_address VARCHAR(45) NULL
);

-- Indexes for quick lookup
CREATE INDEX idx_screenshot_audit_user ON screenshot_audit(user_id);
CREATE INDEX idx_screenshot_audit_chat ON screenshot_audit(chat_id);
CREATE INDEX idx_screenshot_audit_time ON screenshot_audit(attempted_at);
