-- Migration to align with Sparkle Algorithm Specifications

-- 1. Track login attempts for Feature 1.9 (Rate Limiting)
CREATE TABLE IF NOT EXISTS `login_attempts` (
  `attempt_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) DEFAULT NULL,
  `login_id` VARCHAR(255) NOT NULL, -- email or username attempted
  `ip_address` VARCHAR(45) NOT NULL,
  `attempt_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `is_successful` TINYINT(1) DEFAULT 0,
  PRIMARY KEY (`attempt_id`),
  INDEX `idx_login_attempts_id_time` (`login_id`, `attempt_time`),
  INDEX `idx_login_attempts_ip_time` (`ip_address`, `attempt_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Update users table for Algorithm 2.5 (User Types) and Algorithm 10 (Soft Delete)
ALTER TABLE `users` 
ADD COLUMN IF NOT EXISTS `user_type` ENUM('student', 'alumni', 'teacher', 'faculty') DEFAULT 'student' AFTER `role`,
ADD COLUMN IF NOT EXISTS `student_id` VARCHAR(50) DEFAULT NULL AFTER `user_type`,
ADD COLUMN IF NOT EXISTS `deleted_at` TIMESTAMP NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS `deletion_marked_at` TIMESTAMP NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS `two_factor_secret` VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS `two_factor_backup_codes` JSON DEFAULT NULL;

-- 2.1 Update posts table for Algorithm 11.7 (Scheduling), Algorithm 12.11 (Sharing), and Algorithm 15.6 (Comments Toggle)
ALTER TABLE `posts`
ADD COLUMN IF NOT EXISTS `scheduled_at` TIMESTAMP NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS `share_count` INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS `comments_enabled` TINYINT(1) DEFAULT 1;


ALTER TABLE `moments`
ADD COLUMN IF NOT EXISTS `share_count` INT DEFAULT 0;

ALTER TABLE `stories`
ADD COLUMN IF NOT EXISTS `share_count` INT DEFAULT 0;




-- 3. Add rate limiting for verification codes (Algorithm 3.3) and Identity Verification (Badge)
CREATE TABLE IF NOT EXISTS `verification_requests` (
  `request_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `type` ENUM('email', 'sms', 'password_reset', 'identity') NOT NULL,
  `status` ENUM('pending', 'approved', 'rejected', 'expired') DEFAULT 'pending',
  `id_document_url` VARCHAR(255) DEFAULT NULL, -- for identity verification
  `requested_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `reviewed_by` CHAR(36) DEFAULT NULL,
  `review_notes` TEXT DEFAULT NULL,
  `reviewed_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`request_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL,
  INDEX `idx_verif_requests_user_time` (`user_id`, `type`, `requested_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Add follow requests table (Algorithm 18)
CREATE TABLE IF NOT EXISTS `follow_requests` (
  `id` CHAR(36) NOT NULL,
  `requester_id` CHAR(36) NOT NULL,
  `target_user_id` CHAR(36) NOT NULL,
  `status` ENUM('pending', 'accepted', 'rejected', 'cancelled') DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_follow_request` (`requester_id`, `target_user_id`, `status`),
  FOREIGN KEY (`requester_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  FOREIGN KEY (`target_user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- 5. Add reporting tables for content moderation (Algorithm 35)
CREATE TABLE IF NOT EXISTS `post_reports` (
  `report_id` CHAR(36) NOT NULL,
  `post_id` CHAR(36) NOT NULL,
  `reporter_id` CHAR(36) NOT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `status` ENUM('pending', 'resolved', 'dismissed') DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` TIMESTAMP NULL DEFAULT NULL,
  `resolved_by` CHAR(36) DEFAULT NULL,
  PRIMARY KEY (`report_id`),
  FOREIGN KEY (`post_id`) REFERENCES `posts`(`post_id`) ON DELETE CASCADE,
  FOREIGN KEY (`reporter_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  FOREIGN KEY (`resolved_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `listing_reports` (
  `report_id` CHAR(36) NOT NULL,
  `listing_id` CHAR(36) NOT NULL,
  `reporter_id` CHAR(36) NOT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `details` TEXT DEFAULT NULL,
  `status` ENUM('pending', 'resolved', 'dismissed') DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` TIMESTAMP NULL DEFAULT NULL,
  `resolved_by` CHAR(36) DEFAULT NULL,
  `resolution_notes` TEXT DEFAULT NULL,
  PRIMARY KEY (`report_id`),
  FOREIGN KEY (`listing_id`) REFERENCES `marketplace_listings`(`listing_id`) ON DELETE CASCADE,
  FOREIGN KEY (`reporter_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  FOREIGN KEY (`resolved_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `confession_reports` (
  `report_id` CHAR(36) NOT NULL,
  `confession_id` CHAR(36) NOT NULL,
  `reporter_id` CHAR(36) NOT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`report_id`),
  FOREIGN KEY (`confession_id`) REFERENCES `confessions`(`confession_id`) ON DELETE CASCADE,
  FOREIGN KEY (`reporter_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Add admin logs table for audit (Algorithm 30)
CREATE TABLE IF NOT EXISTS `admin_logs` (
  `log_id` CHAR(36) NOT NULL,
  `admin_id` CHAR(36) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `target_type` VARCHAR(50) DEFAULT NULL,
  `target_id` VARCHAR(100) DEFAULT NULL,
  `details` JSON DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  FOREIGN KEY (`admin_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
