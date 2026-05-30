-- Migration: Add privacy settings JSON columns and FCM tokens table

-- FCM Tokens table (if not already present)
CREATE TABLE IF NOT EXISTS `fcm_tokens` (
    `token_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `device_type` ENUM('android','ios','web') DEFAULT 'android',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `last_used_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`token_id`),
    UNIQUE KEY `unique_user_token` (`user_id`,`token`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
    INDEX `idx_user_tokens` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add privacy settings JSON to group chats
ALTER TABLE `group_chats`
ADD COLUMN `privacy_settings` JSON NOT NULL DEFAULT '{"allowForward":true,"allowCopy":true,"blockScreenshots":false,"blurScreenRecording":true,"notifyScreenshotAttempts":true}';

-- Add privacy settings JSON to personal chats
ALTER TABLE `personal_chats`
ADD COLUMN `privacy_settings` JSON NOT NULL DEFAULT '{"allowForward":true,"allowCopy":true,"blockScreenshots":false,"blurScreenRecording":true,"notifyScreenshotAttempts":true}';
