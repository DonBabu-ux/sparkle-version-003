SET FOREIGN_KEY_CHECKS = 0;

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `user_id` CHAR(36) NOT NULL,  
  `name` VARCHAR(255) NOT NULL,
  `username` VARCHAR(100) NOT NULL UNIQUE,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `avatar_url` VARCHAR(500) DEFAULT NULL,
  `campus` VARCHAR(100) DEFAULT NULL,
  `major` VARCHAR(100) DEFAULT NULL,
  `year_of_study` VARCHAR(50) DEFAULT NULL,
  `bio` TEXT DEFAULT NULL,
  `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `last_seen_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_online` TINYINT(1) DEFAULT 0,
  `anonymous_enabled` TINYINT(1) DEFAULT 0,
  `dark_mode_enabled` TINYINT(1) DEFAULT 0,
  `account_status` ENUM('active', 'suspended', 'deactivated') DEFAULT 'active',
  `email_notifications` TINYINT(1) DEFAULT 1,
  `push_notifications` TINYINT(1) DEFAULT 1,
  `profile_visibility` ENUM('public', 'campus', 'private') DEFAULT 'public',
  PRIMARY KEY (`user_id`),
  INDEX `idx_users_campus` (`campus`),
  INDEX `idx_users_username` (`username`),
  INDEX `idx_users_joined` (`joined_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `password_reset_tokens`;
CREATE TABLE `password_reset_tokens` (
  `token_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `token` VARCHAR(255) NOT NULL UNIQUE,
  `expires_at` TIMESTAMP NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `used_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`token_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  INDEX `idx_token_expiry` (`expires_at`),
  INDEX `idx_token_user` (`user_id`, `used_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- ACHIEVEMENTS
-- ============================================
DROP TABLE IF EXISTS `achievements`;
CREATE TABLE `achievements` (
  `achievement_id` CHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `icon_url` VARCHAR(500) DEFAULT NULL,
  `criteria` JSON NOT NULL,
  `category` VARCHAR(50) DEFAULT NULL,
  `points` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`achievement_id`),
  INDEX `idx_achievements_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `user_achievements`;
CREATE TABLE `user_achievements` (
  `user_achievement_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `achievement_id` CHAR(36) NOT NULL,
  `unlocked_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `notified_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`user_achievement_id`),
  UNIQUE KEY `unique_user_achievement` (`user_id`, `achievement_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  FOREIGN KEY (`achievement_id`) REFERENCES `achievements`(`achievement_id`) ON DELETE CASCADE,
  INDEX `idx_user_achievements_user` (`user_id`, `unlocked_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- SOCIAL FEATURES
-- ============================================
DROP TABLE IF EXISTS `follows`;
CREATE TABLE `follows` (
  `follower_id` CHAR(36) NOT NULL,
  `following_id` CHAR(36) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `muted` TINYINT(1) DEFAULT 0,
  PRIMARY KEY (`follower_id`, `following_id`),
  FOREIGN KEY (`follower_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  FOREIGN KEY (`following_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  INDEX `idx_follows_follower` (`follower_id`, `created_at`),
  INDEX `idx_follows_following` (`following_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `posts`;
CREATE TABLE `posts` (
  `post_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `content` TEXT NOT NULL,
  `media_url` VARCHAR(500) DEFAULT NULL,
  `media_type` ENUM('image', 'video', 'audio', 'file') DEFAULT NULL,
  `post_type` ENUM('public', 'campus_only', 'anonymous', 'private') DEFAULT 'public',
  `campus` VARCHAR(100) DEFAULT NULL,
  `group_id` CHAR(36) DEFAULT NULL,
  `spark_count` INT DEFAULT 0,
  `comment_count` INT DEFAULT 0,
  `share_count` INT DEFAULT 0,
  `view_count` INT DEFAULT 0,
  `is_edited` TINYINT(1) DEFAULT 0,
  `edited_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`post_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  INDEX `idx_posts_user` (`user_id`, `created_at`),
  INDEX `idx_posts_campus_type` (`campus`, `post_type`, `created_at`),
  INDEX `idx_posts_group` (`group_id`),
  INDEX `idx_posts_popularity` (`spark_count`, `created_at`),
  INDEX `idx_posts_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `comments`;
CREATE TABLE `comments` (
  `comment_id` CHAR(36) NOT NULL,
  `post_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `parent_comment_id` CHAR(36) DEFAULT NULL,
  `content` TEXT NOT NULL,
  `spark_count` INT DEFAULT 0,
  `is_edited` TINYINT(1) DEFAULT 0,
  `edited_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`comment_id`),
  FOREIGN KEY (`post_id`) REFERENCES `posts`(`post_id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  FOREIGN KEY (`parent_comment_id`) REFERENCES `comments`(`comment_id`) ON DELETE CASCADE,
  INDEX `idx_comments_post` (`post_id`, `created_at` ASC),
  INDEX `idx_comments_user` (`user_id`, `created_at`),
  INDEX `idx_comments_parent` (`parent_comment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `sparks`;
CREATE TABLE `sparks` (
  `spark_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `post_id` CHAR(36) DEFAULT NULL,
  `comment_id` CHAR(36) DEFAULT NULL,
  `reaction_type` ENUM('like', 'fire', 'heart', 'laugh', 'sad', 'wow') DEFAULT 'like',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`spark_id`),
  UNIQUE KEY `unique_user_post_spark` (`user_id`, `post_id`),
  UNIQUE KEY `unique_user_comment_spark` (`user_id`, `comment_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  FOREIGN KEY (`post_id`) REFERENCES `posts`(`post_id`) ON DELETE CASCADE,
  FOREIGN KEY (`comment_id`) REFERENCES `comments`(`comment_id`) ON DELETE CASCADE,
  INDEX `idx_sparks_post` (`post_id`, `created_at`),
  INDEX `idx_sparks_comment` (`comment_id`),
  INDEX `idx_sparks_user` (`user_id`, `created_at`),
  CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR 
    (post_id IS NULL AND comment_id IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `bookmarks`;
CREATE TABLE `bookmarks` (
  `bookmark_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `post_id` CHAR(36) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`bookmark_id`),
  UNIQUE KEY `unique_user_post_bookmark` (`user_id`, `post_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  FOREIGN KEY (`post_id`) REFERENCES `posts`(`post_id`) ON DELETE CASCADE,
  INDEX `idx_bookmarks_user` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- NOTIFICATIONS
-- ============================================
DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `notification_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `type` ENUM('spark', 'comment', 'follow', 'message', 'group_invite', 'achievement', 'mention', 'share', 'marketplace_contact') NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `content` TEXT NOT NULL,
  `related_id` VARCHAR(50) DEFAULT NULL,
  `related_type` VARCHAR(50) DEFAULT NULL,
  `actor_id` CHAR(36) DEFAULT NULL,
  `is_read` TINYINT(1) DEFAULT 0,
  `is_actionable` TINYINT(1) DEFAULT 1,
  `action_url` VARCHAR(500) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `read_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`notification_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  FOREIGN KEY (`actor_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL,
  INDEX `idx_notifications_user` (`user_id`, `is_read`, `created_at`),
  INDEX `idx_notifications_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- CLUBS
-- ============================================
DROP TABLE IF EXISTS `clubs`;
CREATE TABLE `clubs` (
  `club_id` CHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL UNIQUE,
  `description` TEXT NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `campus` VARCHAR(100) NOT NULL,
  `logo_url` VARCHAR(500) DEFAULT NULL,
  `banner_url` VARCHAR(500) DEFAULT NULL,
  `is_verified` TINYINT(1) DEFAULT 0,
  `is_active` TINYINT(1) DEFAULT 1,
  `admin_id` CHAR(36) NOT NULL,
  `member_count` INT DEFAULT 0,
  `meeting_schedule` TEXT DEFAULT NULL,
  `contact_email` VARCHAR(255) DEFAULT NULL,
  `social_links` JSON DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`club_id`),
  FOREIGN KEY (`admin_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT,
  INDEX `idx_clubs_campus` (`campus`, `is_verified`, `created_at`),
  INDEX `idx_clubs_category` (`category`, `campus`),
  INDEX `idx_clubs_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `club_members`;
CREATE TABLE `club_members` (
  `membership_id` CHAR(36) NOT NULL,
  `club_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `role` ENUM('member', 'moderator', 'admin') DEFAULT 'member',
  `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `invited_by` CHAR(36) DEFAULT NULL,
  `status` ENUM('active', 'pending', 'rejected', 'left') DEFAULT 'active',
  PRIMARY KEY (`membership_id`),
  UNIQUE KEY `unique_club_member` (`club_id`, `user_id`),
  FOREIGN KEY (`club_id`) REFERENCES `clubs`(`club_id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  FOREIGN KEY (`invited_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL,
  INDEX `idx_club_members_user` (`user_id`, `joined_at`),
  INDEX `idx_club_members_club` (`club_id`, `role`, `joined_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `club_events`;
CREATE TABLE `club_events` (
  `event_id` CHAR(36) NOT NULL,
  `club_id` CHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `event_type` VARCHAR(50) DEFAULT NULL,
  `location` VARCHAR(255) NOT NULL,
  `campus` VARCHAR(100) NOT NULL,
  `start_time` TIMESTAMP NOT NULL,
  `end_time` TIMESTAMP NOT NULL,
  `image_url` VARCHAR(500) DEFAULT NULL,
  `max_attendees` INT DEFAULT NULL,
  `is_public` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`event_id`),
  FOREIGN KEY (`club_id`) REFERENCES `clubs`(`club_id`) ON DELETE CASCADE,
  INDEX `idx_club_events_club` (`club_id`, `start_time`),
  INDEX `idx_club_events_campus` (`campus`, `start_time`),
  INDEX `idx_club_events_upcoming` (`start_time`, `is_public`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- EVENTS
-- ============================================
DROP TABLE IF EXISTS `campus_events`;
CREATE TABLE `campus_events` (
  `event_id` CHAR(36) NOT NULL,
  `creator_id` CHAR(36) NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `description` TEXT NOT NULL,
  `event_type` VARCHAR(50) DEFAULT NULL,
  `location` VARCHAR(200) NOT NULL,
  `campus` VARCHAR(100) NOT NULL,
  `start_time` TIMESTAMP NOT NULL,
  `end_time` TIMESTAMP DEFAULT NULL,
  `image_url` VARCHAR(500) DEFAULT NULL,
  `max_attendees` INT DEFAULT NULL,
  `total_rsvps` INT DEFAULT 0,
  `is_public` TINYINT(1) DEFAULT 1,
  `is_official` TINYINT(1) DEFAULT 0,
  `contact_email` VARCHAR(255) DEFAULT NULL,
  `contact_phone` VARCHAR(20) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`event_id`),
  FOREIGN KEY (`creator_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  INDEX `idx_campus_events_campus` (`campus`, `start_time`),
  INDEX `idx_campus_events_upcoming` (`start_time`, `is_public`),
  INDEX `idx_campus_events_creator` (`creator_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `event_rsvps`;
CREATE TABLE `event_rsvps` (
  `rsvp_id` CHAR(36) NOT NULL,
  `event_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `event_type` ENUM('club_event', 'campus_event') NOT NULL,
  `status` ENUM('going', 'maybe', 'not_going') DEFAULT 'going',
  `guests_count` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`rsvp_id`),
  UNIQUE KEY `unique_event_rsvp` (`event_id`, `user_id`, `event_type`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  INDEX `idx_rsvps_user` (`user_id`, `created_at`),
  INDEX `idx_rsvps_event` (`event_id`, `event_type`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- CONFESSIONS
-- ============================================
DROP TABLE IF EXISTS `confessions`;
CREATE TABLE `confessions` (
  `confession_id` CHAR(36) NOT NULL,
  `content` TEXT NOT NULL,
  `campus` VARCHAR(100) NOT NULL,
  `category` VARCHAR(50) DEFAULT NULL,
  `rating_count` INT DEFAULT 0,
  `comment_count` INT DEFAULT 0,
  `is_approved` TINYINT(1) DEFAULT 1,
  `is_best_of_day` TINYINT(1) DEFAULT 0,
  `is_best_of_week` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `approved_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`confession_id`),
  INDEX `idx_confessions_campus` (`campus`, `created_at`),
  INDEX `idx_confessions_popular` (`rating_count`, `created_at`),
  INDEX `idx_confessions_best` (`is_best_of_day`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `confession_reactions`;
CREATE TABLE `confession_reactions` (
  `reaction_id` CHAR(36) NOT NULL,
  `confession_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `reaction_type` ENUM('upvote', 'downvote', 'fire', 'heart') DEFAULT 'upvote',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`reaction_id`),
  UNIQUE KEY `unique_user_confession_reaction` (`user_id`, `confession_id`),
  FOREIGN KEY (`confession_id`) REFERENCES `confessions`(`confession_id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  INDEX `idx_confession_reactions_confession` (`confession_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- GROUPS
-- ============================================
DROP TABLE IF EXISTS `groups`;
CREATE TABLE `groups` (
  `group_id` CHAR(36) NOT NULL,
  `creator_id` CHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL UNIQUE,
  `description` TEXT DEFAULT NULL,
  `campus` VARCHAR(100) NOT NULL,
  `category` VARCHAR(50) DEFAULT NULL,
  `is_public` TINYINT(1) DEFAULT 1,
  `requires_approval` TINYINT(1) DEFAULT 0,
  `banner_url` VARCHAR(500) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`group_id`),
  FOREIGN KEY (`creator_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  INDEX `idx_groups_campus` (`campus`, `created_at`),
  INDEX `idx_groups_category` (`category`),
  INDEX `idx_groups_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `group_members`;
CREATE TABLE `group_members` (
  `membership_id` CHAR(36) NOT NULL,
  `group_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `role` ENUM('member', 'moderator', 'admin') DEFAULT 'member',
  `status` ENUM('active', 'pending', 'rejected', 'left') DEFAULT 'active',
  `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `invited_by` CHAR(36) DEFAULT NULL,
  PRIMARY KEY (`membership_id`),
  UNIQUE KEY `unique_group_member` (`group_id`, `user_id`),
  FOREIGN KEY (`group_id`) REFERENCES `groups`(`group_id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  FOREIGN KEY (`invited_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL,
  INDEX `idx_group_members_user` (`user_id`, `joined_at`),
  INDEX `idx_group_members_group` (`group_id`, `role`, `joined_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- CHAT & MESSAGING
-- ============================================
DROP TABLE IF EXISTS `group_chats`;
CREATE TABLE `group_chats` (
  `chat_id` CHAR(36) NOT NULL,
  `creator_id` CHAR(36) NOT NULL,
  `name` VARCHAR(100) DEFAULT NULL,
  `photo_url` VARCHAR(500) DEFAULT NULL,
  `privacy` ENUM('open', 'locked') DEFAULT 'open',
  `is_private` TINYINT(1) DEFAULT 1,
  `approval_required` TINYINT(1) DEFAULT 0,
  `allow_media` TINYINT(1) DEFAULT 1,
  `allow_voice_notes` TINYINT(1) DEFAULT 1,
  `allow_video_calls` TINYINT(1) DEFAULT 1,
  `allow_reactions` TINYINT(1) DEFAULT 1,
  `allow_message_sharing` TINYINT(1) DEFAULT 1,
  `last_message_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`chat_id`),
  FOREIGN KEY (`creator_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  INDEX `idx_group_chats_creator` (`creator_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- NEW TABLE: Personal chats for 1-on-1 conversations
DROP TABLE IF EXISTS `personal_chats`;
CREATE TABLE `personal_chats` (
  `chat_id` CHAR(36) NOT NULL,
  `participant1_id` CHAR(36) NOT NULL,
  `participant2_id` CHAR(36) NOT NULL,
  `listing_id` CHAR(36) DEFAULT NULL,
  `last_message` TEXT DEFAULT NULL,
  `last_message_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`chat_id`),
  FOREIGN KEY (`participant1_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  FOREIGN KEY (`participant2_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  FOREIGN KEY (`listing_id`) REFERENCES `marketplace_listings`(`listing_id`) ON DELETE SET NULL,
  UNIQUE KEY `unique_personal_chat` (`participant1_id`, `participant2_id`, `listing_id`),
  INDEX `idx_personal_chats_participant1` (`participant1_id`, `last_message_time`),
  INDEX `idx_personal_chats_participant2` (`participant2_id`, `last_message_time`),
  INDEX `idx_personal_chats_listing` (`listing_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `group_chat_members`;
CREATE TABLE `group_chat_members` (
  `membership_id` CHAR(36) NOT NULL,
  `chat_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `role` ENUM('member', 'admin', 'creator') DEFAULT 'member',
  `status` ENUM('active', 'muted', 'left', 'removed', 'pending') DEFAULT 'active',
  `nickname` VARCHAR(50) DEFAULT NULL,
  `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `last_seen` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`membership_id`),
  UNIQUE KEY `unique_chat_member` (`chat_id`, `user_id`),
  FOREIGN KEY (`chat_id`) REFERENCES `group_chats`(`chat_id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  INDEX `idx_chat_members_user` (`user_id`, `joined_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `video_calls`;
CREATE TABLE `video_calls` (
  `call_id` CHAR(36) NOT NULL,
  `chat_id` CHAR(36) NOT NULL,
  `started_by` CHAR(36) NOT NULL,
  `status` ENUM('active', 'ended', 'missed') DEFAULT 'active',
  `started_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `ended_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`call_id`),
  FOREIGN KEY (`chat_id`) REFERENCES `group_chats`(`chat_id`) ON DELETE CASCADE,
  FOREIGN KEY (`started_by`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Updated messages table to support both personal and group chats
DROP TABLE IF EXISTS `messages`;
CREATE TABLE `messages` (
  `message_id` CHAR(36) NOT NULL,
  `chat_id` CHAR(36) DEFAULT NULL,
  `personal_chat_id` CHAR(36) DEFAULT NULL,
  `sender_id` CHAR(36) NOT NULL,
  `type` ENUM('text', 'image', 'video', 'voice_note', 'post_share', 'system', 'call', 'marketplace_listing') DEFAULT 'text',
  `content` TEXT DEFAULT NULL,
  `media_url` VARCHAR(500) DEFAULT NULL,
  `is_read` TINYINT(1) DEFAULT 0,
  `sent_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `read_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`message_id`),
  FOREIGN KEY (`chat_id`) REFERENCES `group_chats`(`chat_id`) ON DELETE CASCADE,
  FOREIGN KEY (`personal_chat_id`) REFERENCES `personal_chats`(`chat_id`) ON DELETE CASCADE,
  FOREIGN KEY (`sender_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  INDEX `idx_messages_group_chat` (`chat_id`, `sent_at`),
  INDEX `idx_messages_personal_chat` (`personal_chat_id`, `sent_at`),
  INDEX `idx_messages_sender` (`sender_id`, `sent_at`),
  INDEX `idx_messages_unread` (`sender_id`, `is_read`, `sent_at`),
  CHECK (
    (chat_id IS NOT NULL AND personal_chat_id IS NULL) OR 
    (chat_id IS NULL AND personal_chat_id IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- MARKETPLACE
-- ============================================
DROP TABLE IF EXISTS `marketplace_listings`;
CREATE TABLE `marketplace_listings` (
  `listing_id` CHAR(36) NOT NULL,
  `seller_id` CHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `price` DECIMAL(10, 2) NOT NULL,
  `category` VARCHAR(50) DEFAULT NULL,
  `condition` ENUM('new', 'like_new', 'good', 'fair', 'poor') DEFAULT 'good',
  `campus` VARCHAR(100) NOT NULL,
  `location` VARCHAR(255) DEFAULT NULL,
  `is_sold` TINYINT(1) DEFAULT 0,
  `status` ENUM('active', 'sold', 'pending', 'deleted') DEFAULT 'active',
  `sold_at` TIMESTAMP NULL DEFAULT NULL,
  `tags` JSON DEFAULT NULL,
  `view_count` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`listing_id`),
  FOREIGN KEY (`seller_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  INDEX `idx_marketplace_campus` (`campus`, `status`, `created_at`),
  INDEX `idx_marketplace_category` (`category`, `status`),
  INDEX `idx_marketplace_seller` (`seller_id`, `created_at`),
  INDEX `idx_marketplace_price` (`price`),
  INDEX `idx_marketplace_status` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- NEW TABLE: Multiple media files per listing
DROP TABLE IF EXISTS `listing_media`;
CREATE TABLE `listing_media` (
  `media_id` CHAR(36) NOT NULL,
  `listing_id` CHAR(36) NOT NULL,
  `media_url` VARCHAR(500) NOT NULL,
  `media_type` ENUM('image', 'video') NOT NULL,
  `upload_order` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`media_id`),
  FOREIGN KEY (`listing_id`) REFERENCES `marketplace_listings`(`listing_id`) ON DELETE CASCADE,
  INDEX `idx_listing_media_listing` (`listing_id`, `upload_order`),
  INDEX `idx_listing_media_type` (`media_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `lost_found_items`;
CREATE TABLE `lost_found_items` (
  `item_id` CHAR(36) NOT NULL,
  `reporter_id` CHAR(36) NOT NULL,
  `type` ENUM('lost', 'found') NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `category` VARCHAR(50) DEFAULT NULL,
  `campus` VARCHAR(100) NOT NULL,
  `location` VARCHAR(255) DEFAULT NULL,
  `date_lost_found` DATE DEFAULT NULL,
  `image_url` VARCHAR(500) DEFAULT NULL,
  `status` ENUM('open', 'claimed', 'closed') DEFAULT 'open',
  `claimed_by` CHAR(36) DEFAULT NULL,
  `claimed_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`item_id`),
  FOREIGN KEY (`reporter_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  FOREIGN KEY (`claimed_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL,
  INDEX `idx_lost_found_campus` (`campus`, `status`, `created_at`),
  INDEX `idx_lost_found_type` (`type`, `status`, `created_at`),
  INDEX `idx_lost_found_reporter` (`reporter_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `skill_offers`;
CREATE TABLE `skill_offers` (
  `offer_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `category` VARCHAR(50) DEFAULT NULL,
  `skill_type` VARCHAR(100) DEFAULT NULL,
  `price` DECIMAL(10, 2) DEFAULT NULL,
  `is_free` TINYINT(1) DEFAULT 0,
  `campus` VARCHAR(100) NOT NULL,
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`offer_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  INDEX `idx_skill_offers_campus` (`campus`, `is_active`, `created_at`),
  INDEX `idx_skill_offers_category` (`category`, `is_active`),
  INDEX `idx_skill_offers_user` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- STORIES & MOMENTS
-- ============================================
DROP TABLE IF EXISTS `stories`;
CREATE TABLE `stories` (
  `story_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `media_url` VARCHAR(500) NOT NULL,
  `media_type` ENUM('image', 'video') DEFAULT 'image',
  `caption` VARCHAR(255) DEFAULT NULL,
  `view_count` INT DEFAULT 0,
  `share_count` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `expires_at` TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL 24 HOUR),
  PRIMARY KEY (`story_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  INDEX `idx_stories_user` (`user_id`, `created_at`),
  INDEX `idx_stories_active` (`expires_at`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `moments`;
CREATE TABLE `moments` (
  `moment_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `media_url` VARCHAR(500) NOT NULL,
  `media_type` ENUM('image', 'video') DEFAULT 'image',
  `caption` TEXT DEFAULT NULL,
  `view_count` INT DEFAULT 0,
  `like_count` INT DEFAULT 0,
  `comment_count` INT DEFAULT 0,
  `share_count` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`moment_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  INDEX `idx_moments_user` (`user_id`, `created_at`),
  INDEX `idx_moments_popular` (`like_count`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- LIVE STREAMS
-- ============================================
DROP TABLE IF EXISTS `live_streams`;
CREATE TABLE `live_streams` (
  `stream_id` CHAR(36) NOT NULL,
  `streamer_id` CHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `campus` VARCHAR(100) NOT NULL,
  `category` VARCHAR(50) DEFAULT NULL,
  `stream_url` VARCHAR(500) NOT NULL,
  `thumbnail_url` VARCHAR(500) DEFAULT NULL,
  `viewer_count` INT DEFAULT 0,
  `status` ENUM('live', 'ended', 'scheduled') DEFAULT 'live',
  `started_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `ended_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`stream_id`),
  FOREIGN KEY (`streamer_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  INDEX `idx_live_streams_status` (`status`, `started_at`),
  INDEX `idx_live_streams_campus` (`campus`, `status`),
  INDEX `idx_live_streams_streamer` (`streamer_id`, `started_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- POLLS
-- ============================================
DROP TABLE IF EXISTS `polls`;
CREATE TABLE `polls` (
  `poll_id` CHAR(36) NOT NULL,
  `creator_id` CHAR(36) NOT NULL,
  `question` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `campus` VARCHAR(100) NOT NULL,
  `category` VARCHAR(50) DEFAULT NULL,
  `is_anonymous` TINYINT(1) DEFAULT 0,
  `expires_at` TIMESTAMP NULL DEFAULT NULL,
  `total_votes` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`poll_id`),
  FOREIGN KEY (`creator_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  INDEX `idx_polls_campus` (`campus`, `created_at`),
  INDEX `idx_polls_creator` (`creator_id`, `created_at`),
  INDEX `idx_polls_active` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `poll_options`;
CREATE TABLE `poll_options` (
  `option_id` CHAR(36) NOT NULL,
  `poll_id` CHAR(36) NOT NULL,
  `option_text` VARCHAR(255) NOT NULL,
  `vote_count` INT DEFAULT 0,
  `option_order` INT DEFAULT 0,
  PRIMARY KEY (`option_id`),
  FOREIGN KEY (`poll_id`) REFERENCES `polls`(`poll_id`) ON DELETE CASCADE,
  INDEX `idx_poll_options_poll` (`poll_id`, `option_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `poll_votes`;
CREATE TABLE `poll_votes` (
  `vote_id` CHAR(36) NOT NULL,
  `poll_id` CHAR(36) NOT NULL,
  `option_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `voted_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`vote_id`),
  UNIQUE KEY `unique_poll_vote` (`poll_id`, `user_id`),
  FOREIGN KEY (`poll_id`) REFERENCES `polls`(`poll_id`) ON DELETE CASCADE,
  FOREIGN KEY (`option_id`) REFERENCES `poll_options`(`option_id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  INDEX `idx_poll_votes_poll` (`poll_id`, `voted_at`),
  INDEX `idx_poll_votes_user` (`user_id`, `voted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- USER MODERATION
-- ============================================
DROP TABLE IF EXISTS `user_blocks`;
CREATE TABLE `user_blocks` (
  `block_id` CHAR(36) NOT NULL,
  `blocker_id` CHAR(36) NOT NULL,
  `blocked_id` CHAR(36) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`block_id`),
  UNIQUE KEY `unique_block` (`blocker_id`, `blocked_id`),
  FOREIGN KEY (`blocker_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  FOREIGN KEY (`blocked_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  INDEX `idx_blocks_blocker` (`blocker_id`),
  INDEX `idx_blocks_blocked` (`blocked_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `user_reports`;
CREATE TABLE `user_reports` (
  `report_id` CHAR(36) NOT NULL,
  `reporter_id` CHAR(36) NOT NULL,
  `reported_id` CHAR(36) NOT NULL,
  `reason` TEXT NOT NULL,
  `status` ENUM('pending', 'reviewed', 'resolved') DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`report_id`),
  FOREIGN KEY (`reporter_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  FOREIGN KEY (`reported_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  INDEX `idx_reports_reporter` (`reporter_id`),
  INDEX `idx_reports_reported` (`reported_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `user_mutes`;
CREATE TABLE `user_mutes` (
  `mute_id` CHAR(36) NOT NULL,
  `muter_id` CHAR(36) NOT NULL,
  `muted_id` CHAR(36) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`mute_id`),
  UNIQUE KEY `unique_mute` (`muter_id`, `muted_id`),
  FOREIGN KEY (`muter_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  FOREIGN KEY (`muted_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  INDEX `idx_mutes_muter` (`muter_id`),
  INDEX `idx_mutes_muted` (`muted_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- ADDITIONAL TABLES FOR MARKETPLACE
-- ============================================
-- NEW TABLE: Marketplace favorites/wishlist
DROP TABLE IF EXISTS `marketplace_favorites`;
CREATE TABLE `marketplace_favorites` (
  `favorite_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `listing_id` CHAR(36) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`favorite_id`),
  UNIQUE KEY `unique_user_listing_favorite` (`user_id`, `listing_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  FOREIGN KEY (`listing_id`) REFERENCES `marketplace_listings`(`listing_id`) ON DELETE CASCADE,
  INDEX `idx_marketplace_favorites_user` (`user_id`, `created_at`),
  INDEX `idx_marketplace_favorites_listing` (`listing_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- NEW TABLE: Marketplace search history
DROP TABLE IF EXISTS `marketplace_search_history`;
CREATE TABLE `marketplace_search_history` (
  `search_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `search_query` VARCHAR(255) NOT NULL,
  `category` VARCHAR(50) DEFAULT NULL,
  `campus` VARCHAR(100) DEFAULT NULL,
  `min_price` DECIMAL(10, 2) DEFAULT NULL,
  `max_price` DECIMAL(10, 2) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`search_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  INDEX `idx_marketplace_search_user` (`user_id`, `created_at`),
  INDEX `idx_marketplace_search_query` (`search_query`),
  INDEX `idx_marketplace_search_time` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- NEW TABLE: Marketplace notifications
DROP TABLE IF EXISTS `marketplace_notifications`;
CREATE TABLE `marketplace_notifications` (
  `notification_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `type` ENUM('new_message', 'price_drop', 'similar_item', 'item_sold', 'item_viewed') NOT NULL,
  `listing_id` CHAR(36) DEFAULT NULL,
  `title` VARCHAR(255) NOT NULL,
  `content` TEXT NOT NULL,
  `is_read` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `read_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`notification_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  FOREIGN KEY (`listing_id`) REFERENCES `marketplace_listings`(`listing_id`) ON DELETE SET NULL,
  INDEX `idx_marketplace_notifications_user` (`user_id`, `is_read`, `created_at`),
  INDEX `idx_marketplace_notifications_type` (`type`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
