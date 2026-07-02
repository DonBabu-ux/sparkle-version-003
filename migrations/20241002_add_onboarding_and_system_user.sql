/*
  Migration: Add onboarding columns to users table and insert system user
*/

DROP PROCEDURE IF EXISTS seed_system_user;
CREATE PROCEDURE seed_system_user()
BEGIN
  DECLARE sys_user_id CHAR(36);
  SET sys_user_id = UUID();
  INSERT INTO users (user_id, name, username, email, password_hash, avatar_url, profile_reminder_disabled, profile_remind_after)
  VALUES (
    sys_user_id,
    'Sparkle System',
    'sparkle_system',
    'system@sparkleapp.com',
    '',
    '/uploads/avatars/system.png',
    TRUE,
    NULL
  );
  SELECT sys_user_id INTO @SPARKLE_SYSTEM_USER_ID;
END;

-- Add onboarding columns
ALTER TABLE users
  ADD COLUMN profile_reminder_disabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN profile_remind_after TIMESTAMP NULL;

-- Seed system user
CALL seed_system_user();

-- Cleanup
DROP PROCEDURE IF EXISTS seed_system_user;
