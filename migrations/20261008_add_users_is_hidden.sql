-- C1 Ghost Mode (A.3 P2 #5): users.is_hidden never existed in the live schema,
-- so user.controller.js:616's UPDATE failed silently and login/2FA payloads
-- had nothing to seed Settings' visibility toggle from.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_hidden TINYINT(1) NOT NULL DEFAULT 0;
