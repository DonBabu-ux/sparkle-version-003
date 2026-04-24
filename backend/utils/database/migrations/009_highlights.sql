-- ============================================
-- HIGHLIGHTS SYSTEM MIGRATION
-- Run this in your MySQL database
-- ============================================

-- Add is_archived flag to existing stories table
ALTER TABLE `stories` 
  ADD COLUMN IF NOT EXISTS `is_archived` TINYINT(1) DEFAULT 0 AFTER `share_count`;

-- Auto-archive expired stories (optional trigger)
-- UPDATE `stories` SET is_archived = 1 WHERE expires_at <= NOW() AND is_archived = 0;

-- ============================================
-- HIGHLIGHTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS `highlights` (
  `highlight_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `title` VARCHAR(100) NOT NULL,
  `cover_url` VARCHAR(500) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`highlight_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  INDEX `idx_highlights_user` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- HIGHLIGHT STORIES MAPPING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS `highlight_stories` (
  `id` CHAR(36) NOT NULL,
  `highlight_id` CHAR(36) NOT NULL,
  `story_id` CHAR(36) NOT NULL,
  `position` INT DEFAULT 0,
  `added_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_highlight_story` (`highlight_id`, `story_id`),
  FOREIGN KEY (`highlight_id`) REFERENCES `highlights`(`highlight_id`) ON DELETE CASCADE,
  FOREIGN KEY (`story_id`) REFERENCES `stories`(`story_id`) ON DELETE CASCADE,
  INDEX `idx_hs_highlight` (`highlight_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
