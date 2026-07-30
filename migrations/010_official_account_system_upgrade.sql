-- migrations/010_official_account_system_upgrade.sql
-- Sparkle Official Account System Platform Capability Schema Upgrade

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Add account_type to users table if not exists
ALTER TABLE `users` 
  ADD COLUMN IF NOT EXISTS `account_type` ENUM('user', 'system', 'business', 'creator', 'bot', 'organization') NOT NULL DEFAULT 'user';

-- 2. Add conversation_type to personal_chats table if not exists
ALTER TABLE `personal_chats`
  ADD COLUMN IF NOT EXISTS `conversation_type` ENUM('dm', 'group', 'system', 'marketplace', 'support', 'ai') NOT NULL DEFAULT 'dm';

-- 3. Upgrade messages table for rich official messaging
ALTER TABLE `messages`
  ADD COLUMN IF NOT EXISTS `message_category` ENUM('announcement', 'feature', 'security', 'welcome', 'tips', 'promotion', 'maintenance', 'warning') DEFAULT 'announcement',
  ADD COLUMN IF NOT EXISTS `publish_at` TIMESTAMP NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `expires_at` TIMESTAMP NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `payload` JSON DEFAULT NULL;

-- 4. Backfill existing system accounts and conversations
UPDATE `users` 
SET `account_type` = 'system' 
WHERE `user_id` = 'd75fe3b5-7a45-4581-ab13-91934d8b54de' 
   OR `username` IN ('sparkle', 'sparkleofficialaccount', 'sparkle_updates', 'sparkle_safety', 'sparkle_ai', 'sparkle_support', 'sparkle_marketplace', 'sparkle_campus');

UPDATE `personal_chats` pc
JOIN `users` u1 ON pc.participant1_id = u1.user_id
JOIN `users` u2 ON pc.participant2_id = u2.user_id
SET pc.`conversation_type` = 'system'
WHERE u1.`account_type` = 'system' OR u2.`account_type` = 'system';

SET FOREIGN_KEY_CHECKS = 1;
