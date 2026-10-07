-- =============================================================================
-- Core schema snapshot — tables NOT created by utils/database/init.js or the
-- migrations/ runner (users, posts, follows, groups, comments, sparks, ...).
-- Generated 2026-10-07 via SHOW CREATE TABLE against the live DB (61 tables).
--
-- PURPOSE: fresh-install / disaster-recovery safety net. The repo previously
-- shipped NO DDL for these tables — only the live database knew their shape.
--
-- APPLY (idempotent, all statements are IF NOT EXISTS):
--   mysql <db> < utils/database/core_tables.sql
--
-- NOTE: FK constraints are inline per table, so on a truly empty DB order
-- matters: run users/posts/follows first; tables with FKs into init.js-managed
-- tables (e.g. moment_likes -> moments) must run AFTER a normal boot has
-- created those. Wiring a proper core-first pass into the schema ledger with
-- scratch-DB validation = M16 in FIXES_NEEDED.md (not auto-run at boot yet).
-- =============================================================================
CREATE TABLE IF NOT EXISTS `clubs` (
  `club_id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `category` varchar(100) NOT NULL,
  `campus` varchar(100) NOT NULL,
  `logo_url` varchar(500) DEFAULT NULL,
  `banner_url` varchar(500) DEFAULT NULL,
  `is_verified` tinyint(1) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `admin_id` char(36) NOT NULL,
  `member_count` int(11) DEFAULT 0,
  `meeting_schedule` text DEFAULT NULL,
  `contact_email` varchar(255) DEFAULT NULL,
  `social_links` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`social_links`)),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_public` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`club_id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `admin_id` (`admin_id`),
  KEY `idx_clubs_campus` (`campus`,`is_verified`,`created_at`),
  KEY `idx_clubs_category` (`category`,`campus`),
  KEY `idx_clubs_slug` (`slug`),
  FULLTEXT KEY `idx_clubs_search` (`name`,`description`),
  CONSTRAINT `clubs_ibfk_1` FOREIGN KEY (`admin_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `club_members` (
  `membership_id` char(36) NOT NULL,
  `club_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `role` enum('member','moderator','admin') DEFAULT 'member',
  `joined_at` timestamp NULL DEFAULT current_timestamp(),
  `invited_by` char(36) DEFAULT NULL,
  `status` enum('active','pending','rejected','left') DEFAULT 'active',
  PRIMARY KEY (`membership_id`),
  UNIQUE KEY `unique_club_member` (`club_id`,`user_id`),
  KEY `invited_by` (`invited_by`),
  KEY `idx_club_members_user` (`user_id`,`joined_at`),
  KEY `idx_club_members_club` (`club_id`,`role`,`joined_at`),
  CONSTRAINT `club_members_ibfk_1` FOREIGN KEY (`club_id`) REFERENCES `clubs` (`club_id`) ON DELETE CASCADE,
  CONSTRAINT `club_members_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `club_members_ibfk_3` FOREIGN KEY (`invited_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `club_events` (
  `event_id` char(36) NOT NULL,
  `club_id` char(36) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `event_type` varchar(50) DEFAULT NULL,
  `location` varchar(255) NOT NULL,
  `campus` varchar(100) NOT NULL,
  `start_time` timestamp NOT NULL,
  `end_time` timestamp NOT NULL,
  `image_url` varchar(500) DEFAULT NULL,
  `max_attendees` int(11) DEFAULT NULL,
  `is_public` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`event_id`),
  KEY `idx_club_events_club` (`club_id`,`start_time`),
  KEY `idx_club_events_campus` (`campus`,`start_time`),
  KEY `idx_club_events_upcoming` (`start_time`,`is_public`),
  CONSTRAINT `club_events_ibfk_1` FOREIGN KEY (`club_id`) REFERENCES `clubs` (`club_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `moment_likes` (
  `moment_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`moment_id`,`user_id`),
  KEY `idx_ml_user` (`user_id`),
  KEY `idx_ml_moment` (`moment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `campus_events` (
  `event_id` char(36) NOT NULL,
  `creator_id` char(36) NOT NULL,
  `title` varchar(200) NOT NULL,
  `description` text NOT NULL,
  `event_type` varchar(50) DEFAULT NULL,
  `location` varchar(200) NOT NULL,
  `campus` varchar(100) NOT NULL,
  `start_time` timestamp NOT NULL,
  `end_time` timestamp NULL DEFAULT NULL,
  `image_url` varchar(500) DEFAULT NULL,
  `max_attendees` int(11) DEFAULT NULL,
  `total_rsvps` int(11) DEFAULT 0,
  `is_public` tinyint(1) DEFAULT 1,
  `is_official` tinyint(1) DEFAULT 0,
  `contact_email` varchar(255) DEFAULT NULL,
  `contact_phone` varchar(20) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `requirements` text DEFAULT NULL,
  PRIMARY KEY (`event_id`),
  KEY `idx_campus_events_campus` (`campus`,`start_time`),
  KEY `idx_campus_events_upcoming` (`start_time`,`is_public`),
  KEY `idx_campus_events_creator` (`creator_id`,`created_at`),
  CONSTRAINT `campus_events_ibfk_1` FOREIGN KEY (`creator_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `saved_moments` (
  `moment_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`moment_id`,`user_id`),
  KEY `idx_sm_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `group_members` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `group_id` char(36) DEFAULT NULL,
  `user_id` char(36) DEFAULT NULL,
  `role` enum('admin','moderator','member') DEFAULT 'member',
  `status` enum('active','pending','banned') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `muted` tinyint(1) DEFAULT 0,
  `banned` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `group_user` (`group_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `group_members_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `groups` (`group_id`) ON DELETE CASCADE,
  CONSTRAINT `group_members_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=132 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `users` (
  `user_id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `username` varchar(100) NOT NULL,
  `username_normalized` varchar(100) GENERATED ALWAYS AS (lcase(trim(`username`))) STORED,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `avatar_url` varchar(500) DEFAULT NULL,
  `campus` varchar(100) DEFAULT NULL,
  `major` varchar(100) DEFAULT NULL,
  `year_of_study` varchar(50) DEFAULT NULL,
  `bio` text DEFAULT NULL,
  `joined_at` timestamp NULL DEFAULT current_timestamp(),
  `last_seen_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_online` tinyint(1) DEFAULT 0,
  `anonymous_enabled` tinyint(1) DEFAULT 0,
  `dark_mode_enabled` tinyint(1) DEFAULT 0,
  `account_status` enum('active','suspended','deactivated') DEFAULT 'active',
  `account_type` enum('user','system','business','creator','bot','organization') NOT NULL DEFAULT 'user',
  `email_notifications` tinyint(1) DEFAULT 1,
  `push_notifications` tinyint(1) DEFAULT 1,
  `profile_visibility` enum('public','campus','private') DEFAULT 'public',
  `email_verified` tinyint(1) DEFAULT 0,
  `phone_verified` tinyint(1) DEFAULT 0,
  `phone_number` varchar(20) DEFAULT NULL,
  `is_private` tinyint(1) DEFAULT 0,
  `role` enum('member','moderator','admin') DEFAULT 'member',
  `user_type` enum('student','alumni','teacher','faculty') DEFAULT 'student',
  `student_id` varchar(50) DEFAULT NULL,
  `is_verified` tinyint(1) DEFAULT 0,
  `headline` varchar(255) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `relationship_status` varchar(100) DEFAULT NULL,
  `partner_id` char(36) DEFAULT NULL,
  `relationship_since` timestamp NULL DEFAULT NULL,
  `linkedin_url` varchar(255) DEFAULT NULL,
  `github_url` varchar(255) DEFAULT NULL,
  `instagram_url` varchar(255) DEFAULT NULL,
  `twitter_url` varchar(255) DEFAULT NULL,
  `birthday` date DEFAULT NULL,
  `show_contact_info` tinyint(1) DEFAULT 0,
  `show_birthday` tinyint(1) DEFAULT 1,
  `theme` enum('light','dark','system') DEFAULT 'system',
  `font_size` enum('small','medium','large') DEFAULT 'medium',
  `language` varchar(10) DEFAULT 'en',
  `chat_theme` varchar(50) DEFAULT 'classic_doodle',
  `two_factor_enabled` tinyint(1) DEFAULT 0,
  `two_factor_pin` varchar(255) DEFAULT NULL,
  `last_seen_visibility` varchar(20) DEFAULT 'Everyone',
  `activity_status_enabled` tinyint(1) DEFAULT 1,
  `anonymous_mode_enabled` tinyint(1) DEFAULT 0,
  `message_privacy` varchar(20) DEFAULT 'Everyone',
  `push_notifications_enabled` tinyint(1) DEFAULT 1,
  `email_notifications_enabled` tinyint(1) DEFAULT 1,
  `notifications_likes` tinyint(1) DEFAULT 1,
  `notifications_comments` tinyint(1) DEFAULT 1,
  `notifications_follows` tinyint(1) DEFAULT 1,
  `notifications_messages` tinyint(1) DEFAULT 1,
  `dnd_enabled` tinyint(1) DEFAULT 0,
  `dnd_start_time` time DEFAULT '22:00:00',
  `dnd_end_time` time DEFAULT '07:00:00',
  `token_version` int(11) DEFAULT 0,
  `security_token` varchar(255) DEFAULT NULL,
  `dm_permission` varchar(20) DEFAULT 'everyone',
  `last_seen` varchar(20) DEFAULT 'everyone',
  `font_scale` varchar(20) DEFAULT 'standard',
  `user_role` enum('user','admin') DEFAULT 'user',
  `profile_views` int(11) DEFAULT 0,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `deletion_marked_at` timestamp NULL DEFAULT NULL,
  `two_factor_secret` varchar(255) DEFAULT NULL,
  `two_factor_backup_codes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`two_factor_backup_codes`)),
  `note` varchar(60) DEFAULT NULL,
  `is_seed` tinyint(1) DEFAULT 0,
  `comment_streak` int(11) DEFAULT 0,
  `last_comment_date` date DEFAULT NULL,
  `creator_reputation` float DEFAULT 1,
  `poll_vote_streak` int(11) DEFAULT 0,
  `onboarding_step` int(11) NOT NULL DEFAULT 0,
  `is_system_account` tinyint(1) DEFAULT 0,
  `display_name` varchar(255) DEFAULT NULL,
  `official_onboarding_status` enum('NOT_STARTED','VIEWED','COMPLETED') DEFAULT 'NOT_STARTED',
  `official_onboarding_completed_at` timestamp NULL DEFAULT NULL,
  `sensitive_content_level` enum('standard','strict') DEFAULT 'standard',
  `ai_content_opt_out` tinyint(1) DEFAULT 0,
  `recommendation_personalization` tinyint(1) DEFAULT 1,
  `search_indexing_enabled` tinyint(1) DEFAULT 1,
  `profile_discoverability` enum('everyone','friends','private') DEFAULT 'everyone',
  `reduced_motion` tinyint(1) DEFAULT 0,
  `auto_download_media` varchar(20) DEFAULT 'wifi',
  `link_previews_enabled` tinyint(1) DEFAULT 1,
  `haptic_intensity` varchar(20) DEFAULT 'medium',
  `media_quality` varchar(20) DEFAULT 'standard',
  `name_updated_at` timestamp NULL DEFAULT NULL,
  `username_updated_at` timestamp NULL DEFAULT NULL,
  `default_read_receipts` tinyint(1) DEFAULT 1,
  `default_typing_indicator` tinyint(1) DEFAULT 1,
  `default_allow_media_download` tinyint(1) DEFAULT 1,
  `default_allow_copy_text` tinyint(1) DEFAULT 1,
  `default_allow_reactions` tinyint(1) DEFAULT 1,
  `default_allow_forwarding` tinyint(1) DEFAULT 1,
  `default_screenshot_notification` tinyint(1) DEFAULT 1,
  `default_disappearing_mode` varchar(50) DEFAULT 'off',
  `blur_screen_recording` tinyint(1) DEFAULT 1,
  `last_seen_privacy` varchar(50) DEFAULT 'everyone',
  `chat_pin` varchar(255) DEFAULT NULL,
  `email_2fa_enabled` tinyint(1) DEFAULT 0,
  `sms_2fa_enabled` tinyint(1) DEFAULT 0,
  `email_2fa_verified_at` timestamp NULL DEFAULT NULL,
  `sms_2fa_verified_at` timestamp NULL DEFAULT NULL,
  `security_recovery_email` varchar(255) DEFAULT NULL,
  `password_changed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `uq_users_username_normalized` (`username_normalized`),
  KEY `idx_users_campus` (`campus`),
  KEY `idx_users_joined` (`joined_at`),
  KEY `fk_partner` (`partner_id`),
  KEY `idx_onboarding_step` (`onboarding_step`),
  KEY `idx_users_email` (`email`),
  KEY `idx_users_username_normalized` (`username_normalized`),
  FULLTEXT KEY `idx_users_search` (`username`,`name`,`bio`),
  CONSTRAINT `fk_partner` FOREIGN KEY (`partner_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `token_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `used_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`token_id`),
  UNIQUE KEY `token` (`token`),
  KEY `idx_token_expiry` (`expires_at`),
  KEY `idx_token_user` (`user_id`,`used_at`),
  CONSTRAINT `password_reset_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `listing_reports` (
  `report_id` char(36) NOT NULL,
  `listing_id` char(36) NOT NULL,
  `reporter_id` char(36) NOT NULL,
  `reason` enum('spam','inappropriate','scam','misleading','duplicate','other') NOT NULL,
  `details` text DEFAULT NULL,
  `status` enum('pending','reviewed','resolved','dismissed') DEFAULT 'pending',
  `reviewed_by` char(36) DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`report_id`),
  KEY `reviewed_by` (`reviewed_by`),
  KEY `idx_status` (`status`,`created_at`),
  KEY `idx_listing` (`listing_id`),
  KEY `idx_reporter` (`reporter_id`),
  CONSTRAINT `listing_reports_ibfk_1` FOREIGN KEY (`listing_id`) REFERENCES `marketplace_listings` (`listing_id`) ON DELETE CASCADE,
  CONSTRAINT `listing_reports_ibfk_2` FOREIGN KEY (`reporter_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `listing_reports_ibfk_3` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `achievements` (
  `achievement_id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `icon_url` varchar(500) DEFAULT NULL,
  `criteria` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`criteria`)),
  `category` varchar(50) DEFAULT NULL,
  `points` int(11) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`achievement_id`),
  KEY `idx_achievements_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `user_achievements` (
  `user_achievement_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `achievement_id` char(36) NOT NULL,
  `unlocked_at` timestamp NULL DEFAULT current_timestamp(),
  `notified_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`user_achievement_id`),
  UNIQUE KEY `unique_user_achievement` (`user_id`,`achievement_id`),
  KEY `achievement_id` (`achievement_id`),
  KEY `idx_user_achievements_user` (`user_id`,`unlocked_at`),
  CONSTRAINT `user_achievements_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `user_achievements_ibfk_2` FOREIGN KEY (`achievement_id`) REFERENCES `achievements` (`achievement_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `follows` (
  `follower_id` char(36) NOT NULL,
  `following_id` char(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `muted` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`follower_id`,`following_id`),
  KEY `idx_follows_follower` (`follower_id`,`created_at`),
  KEY `idx_follows_following` (`following_id`,`created_at`),
  CONSTRAINT `follows_ibfk_1` FOREIGN KEY (`follower_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `follows_ibfk_2` FOREIGN KEY (`following_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `posts` (
  `post_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `content` text NOT NULL,
  `media_url` varchar(500) DEFAULT NULL,
  `media_type` enum('image','video','audio','file') DEFAULT NULL,
  `post_type` enum('public','campus_only','anonymous','private') DEFAULT 'public',
  `campus` varchar(100) DEFAULT NULL,
  `group_id` char(36) DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `spark_count` int(11) DEFAULT 0,
  `comment_count` int(11) DEFAULT 0,
  `share_count` int(11) DEFAULT 0,
  `view_count` int(11) DEFAULT 0,
  `is_edited` tinyint(1) DEFAULT 0,
  `edited_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `club_id` char(36) DEFAULT NULL,
  `original_post_id` char(36) DEFAULT NULL,
  `language` varchar(10) DEFAULT 'en',
  `reshare_count` int(11) DEFAULT 0,
  `scheduled_at` timestamp NULL DEFAULT NULL,
  `comments_enabled` tinyint(1) DEFAULT 1,
  `status` enum('active','limited','removed') DEFAULT 'active',
  `visibility_score` float DEFAULT 1,
  `is_seed` tinyint(1) DEFAULT 0,
  `category` varchar(50) DEFAULT 'General',
  `feeling` varchar(50) DEFAULT NULL,
  `activity` varchar(100) DEFAULT NULL,
  `tagged_users` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`tagged_users`)),
  `approval_status` enum('pending','approved','rejected') DEFAULT 'approved',
  PRIMARY KEY (`post_id`),
  KEY `idx_posts_user` (`user_id`,`created_at`),
  KEY `idx_posts_campus_type` (`campus`,`post_type`,`created_at`),
  KEY `idx_posts_popularity` (`spark_count`,`created_at`),
  KEY `idx_posts_club` (`club_id`),
  KEY `idx_posts_location` (`location`),
  KEY `idx_posts_created_at` (`created_at`),
  KEY `idx_posts_group_created` (`group_id`,`created_at`),
  KEY `idx_posts_campus` (`campus`),
  KEY `idx_posts_user_id` (`user_id`),
  FULLTEXT KEY `idx_posts_search` (`content`),
  CONSTRAINT `posts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `comments` (
  `comment_id` char(36) NOT NULL,
  `post_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `parent_comment_id` char(36) DEFAULT NULL,
  `content` text NOT NULL,
  `spark_count` int(11) DEFAULT 0,
  `is_edited` tinyint(1) DEFAULT 0,
  `edited_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `like_count` int(11) DEFAULT 0,
  `is_seed` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`comment_id`),
  KEY `idx_comments_post` (`post_id`,`created_at`),
  KEY `idx_comments_user` (`user_id`,`created_at`),
  KEY `idx_comments_parent` (`parent_comment_id`),
  CONSTRAINT `comments_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `posts` (`post_id`) ON DELETE CASCADE,
  CONSTRAINT `comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `comments_ibfk_3` FOREIGN KEY (`parent_comment_id`) REFERENCES `comments` (`comment_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `sparks` (
  `spark_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `post_id` char(36) DEFAULT NULL,
  `comment_id` char(36) DEFAULT NULL,
  `reaction_type` enum('like','fire','heart','laugh','sad','wow') DEFAULT 'like',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `is_seed` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`spark_id`),
  UNIQUE KEY `unique_user_post_spark` (`user_id`,`post_id`),
  UNIQUE KEY `unique_user_comment_spark` (`user_id`,`comment_id`),
  KEY `idx_sparks_post` (`post_id`,`created_at`),
  KEY `idx_sparks_comment` (`comment_id`),
  KEY `idx_sparks_user` (`user_id`,`created_at`),
  KEY `idx_sparks_post_user` (`post_id`,`user_id`),
  CONSTRAINT `sparks_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `sparks_ibfk_2` FOREIGN KEY (`post_id`) REFERENCES `posts` (`post_id`) ON DELETE CASCADE,
  CONSTRAINT `sparks_ibfk_3` FOREIGN KEY (`comment_id`) REFERENCES `comments` (`comment_id`) ON DELETE CASCADE,
  CONSTRAINT `CONSTRAINT_1` CHECK (`post_id` is not null and `comment_id` is null or `post_id` is null and `comment_id` is not null)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `live_streams` (
  `stream_id` char(36) NOT NULL,
  `streamer_id` char(36) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `campus` varchar(100) NOT NULL,
  `category` varchar(50) DEFAULT NULL,
  `stream_url` varchar(500) NOT NULL,
  `thumbnail_url` varchar(500) DEFAULT NULL,
  `viewer_count` int(11) DEFAULT 0,
  `status` enum('live','ended','scheduled') DEFAULT 'live',
  `started_at` timestamp NULL DEFAULT current_timestamp(),
  `ended_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`stream_id`),
  KEY `idx_live_streams_status` (`status`,`started_at`),
  KEY `idx_live_streams_campus` (`campus`,`status`),
  KEY `idx_live_streams_streamer` (`streamer_id`,`started_at`),
  CONSTRAINT `live_streams_ibfk_1` FOREIGN KEY (`streamer_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `polls` (
  `poll_id` char(36) NOT NULL,
  `creator_id` char(36) NOT NULL,
  `question` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `campus` varchar(100) NOT NULL,
  `category` varchar(50) DEFAULT NULL,
  `is_anonymous` tinyint(1) DEFAULT 0,
  `expires_at` timestamp NULL DEFAULT NULL,
  `total_votes` int(11) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `is_expired` tinyint(1) DEFAULT 0,
  `allow_invites` tinyint(1) DEFAULT 1,
  `notification_priority` int(11) DEFAULT 0,
  `engagement_score` float DEFAULT 0,
  `share_count` int(11) DEFAULT 0,
  `comment_count` int(11) DEFAULT 0,
  `save_count` int(11) DEFAULT 0,
  `distribution_level` int(11) DEFAULT 1,
  `quality_score` float DEFAULT 1,
  PRIMARY KEY (`poll_id`),
  KEY `idx_polls_campus` (`campus`,`created_at`),
  KEY `idx_polls_creator` (`creator_id`,`created_at`),
  KEY `idx_polls_active` (`expires_at`),
  KEY `idx_polls_created_at` (`created_at`),
  KEY `idx_polls_engagement` (`engagement_score`),
  KEY `idx_polls_expiry` (`expires_at`),
  CONSTRAINT `polls_ibfk_1` FOREIGN KEY (`creator_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `poll_options` (
  `option_id` char(36) NOT NULL,
  `poll_id` char(36) NOT NULL,
  `option_text` varchar(255) NOT NULL,
  `vote_count` int(11) DEFAULT 0,
  `option_order` int(11) DEFAULT 0,
  PRIMARY KEY (`option_id`),
  KEY `idx_poll_options_poll` (`poll_id`,`option_order`),
  KEY `idx_poll_options_poll_id` (`poll_id`),
  CONSTRAINT `poll_options_ibfk_1` FOREIGN KEY (`poll_id`) REFERENCES `polls` (`poll_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `conversations` (
  `conversation_id` char(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `last_message_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`conversation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `participants` (
  `participant_id` int(11) NOT NULL AUTO_INCREMENT,
  `conversation_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `joined_at` timestamp NULL DEFAULT current_timestamp(),
  `is_active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`participant_id`),
  UNIQUE KEY `unique_participant` (`conversation_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `participants_ibfk_1` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`conversation_id`) ON DELETE CASCADE,
  CONSTRAINT `participants_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `message_requests` (
  `request_id` int(11) NOT NULL AUTO_INCREMENT,
  `sender_id` char(36) NOT NULL,
  `recipient_id` char(36) NOT NULL,
  `message_text` text NOT NULL,
  `status` enum('pending','accepted','rejected') DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`request_id`),
  KEY `sender_id` (`sender_id`),
  KEY `recipient_id` (`recipient_id`),
  CONSTRAINT `message_requests_ibfk_1` FOREIGN KEY (`sender_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `message_requests_ibfk_2` FOREIGN KEY (`recipient_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `bookmarks` (
  `bookmark_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `post_id` char(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`bookmark_id`),
  UNIQUE KEY `unique_user_post_bookmark` (`user_id`,`post_id`),
  KEY `post_id` (`post_id`),
  KEY `idx_bookmarks_user` (`user_id`,`created_at`),
  CONSTRAINT `bookmarks_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `bookmarks_ibfk_2` FOREIGN KEY (`post_id`) REFERENCES `posts` (`post_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `club_event_updates` (
  `update_id` char(36) NOT NULL,
  `event_id` char(36) NOT NULL,
  `club_id` char(36) NOT NULL,
  `admin_id` char(36) NOT NULL,
  `content` text DEFAULT NULL,
  `media_url` varchar(500) DEFAULT NULL,
  `media_type` enum('image','video','both') DEFAULT 'image',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`update_id`),
  KEY `club_id` (`club_id`),
  KEY `admin_id` (`admin_id`),
  KEY `idx_event_updates` (`event_id`,`created_at`),
  CONSTRAINT `club_event_updates_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `club_events` (`event_id`) ON DELETE CASCADE,
  CONSTRAINT `club_event_updates_ibfk_2` FOREIGN KEY (`club_id`) REFERENCES `clubs` (`club_id`) ON DELETE CASCADE,
  CONSTRAINT `club_event_updates_ibfk_3` FOREIGN KEY (`admin_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `groups` (
  `group_id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `category` varchar(100) DEFAULT 'general',
  `icon_url` text DEFAULT NULL,
  `cover_image` text DEFAULT NULL,
  `campus` varchar(255) DEFAULT NULL,
  `is_public` tinyint(1) DEFAULT 1,
  `requires_approval` tinyint(1) DEFAULT 0,
  `creator_id` char(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `allow_posts` tinyint(1) DEFAULT 1,
  `require_post_approval` tinyint(1) DEFAULT 0,
  `who_can_post` enum('anyone','admins') DEFAULT 'anyone',
  `who_can_invite` enum('anyone','admins') DEFAULT 'anyone',
  `privacy_settings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`privacy_settings`)),
  PRIMARY KEY (`group_id`),
  KEY `creator_id` (`creator_id`),
  FULLTEXT KEY `idx_groups_search` (`name`,`description`),
  CONSTRAINT `groups_ibfk_1` FOREIGN KEY (`creator_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `group_chats` (
  `chat_id` char(36) NOT NULL,
  `creator_id` char(36) NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `photo_url` varchar(500) DEFAULT NULL,
  `privacy` enum('open','locked') DEFAULT 'open',
  `is_private` tinyint(1) DEFAULT 1,
  `approval_required` tinyint(1) DEFAULT 0,
  `allow_media` tinyint(1) DEFAULT 1,
  `allow_voice_notes` tinyint(1) DEFAULT 1,
  `allow_video_calls` tinyint(1) DEFAULT 1,
  `allow_reactions` tinyint(1) DEFAULT 1,
  `allow_message_sharing` tinyint(1) DEFAULT 1,
  `last_message_at` timestamp NULL DEFAULT current_timestamp(),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `disappearing_duration` int(11) DEFAULT 0,
  `pin_locked` tinyint(1) DEFAULT 0,
  `group_pin` varchar(20) DEFAULT NULL,
  `only_admins_send` tinyint(1) DEFAULT 0,
  `edit_info` enum('admins','members') DEFAULT 'admins',
  `description` text DEFAULT NULL,
  `only_admins_edit` tinyint(1) DEFAULT 0,
  `privacy_settings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT '{"allowForward":true,"allowCopy":true,"blockScreenshots":false,"blurScreenRecording":true,"notifyScreenshotAttempts":true}' CHECK (json_valid(`privacy_settings`)),
  PRIMARY KEY (`chat_id`),
  KEY `idx_group_chats_creator` (`creator_id`),
  CONSTRAINT `group_chats_ibfk_1` FOREIGN KEY (`creator_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `services` (
  `service_id` char(36) NOT NULL,
  `provider_id` char(36) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `category` enum('tutoring','photography','tech_support','creative','transport','food','other') NOT NULL,
  `subcategory` varchar(100) DEFAULT NULL,
  `price_type` enum('fixed','hourly','negotiable','free') NOT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `price_unit` varchar(20) DEFAULT NULL,
  `campus` varchar(100) NOT NULL,
  `availability` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`availability`)),
  `rating` decimal(3,2) DEFAULT 0.00,
  `review_count` int(11) DEFAULT 0,
  `is_verified` tinyint(1) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `image_urls` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`image_urls`)),
  `contact_method` enum('message','email','phone','whatsapp') DEFAULT 'message',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`service_id`),
  KEY `idx_services_provider` (`provider_id`,`created_at` DESC),
  KEY `idx_services_category` (`category`,`campus`,`created_at` DESC),
  KEY `idx_services_rating` (`rating` DESC,`review_count` DESC),
  FULLTEXT KEY `idx_services_search` (`title`,`description`),
  CONSTRAINT `services_ibfk_1` FOREIGN KEY (`provider_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `video_calls` (
  `call_id` char(36) NOT NULL,
  `chat_id` char(36) NOT NULL,
  `started_by` char(36) NOT NULL,
  `status` enum('active','ended','missed') DEFAULT 'active',
  `started_at` timestamp NULL DEFAULT current_timestamp(),
  `ended_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`call_id`),
  KEY `chat_id` (`chat_id`),
  KEY `started_by` (`started_by`),
  CONSTRAINT `video_calls_ibfk_1` FOREIGN KEY (`chat_id`) REFERENCES `group_chats` (`chat_id`) ON DELETE CASCADE,
  CONSTRAINT `video_calls_ibfk_2` FOREIGN KEY (`started_by`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `group_chat_members` (
  `membership_id` char(36) NOT NULL,
  `chat_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `role` enum('member','admin','creator') DEFAULT 'member',
  `status` enum('active','muted','left','removed','pending') DEFAULT 'active',
  `nickname` varchar(50) DEFAULT NULL,
  `joined_at` timestamp NULL DEFAULT current_timestamp(),
  `last_seen` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`membership_id`),
  UNIQUE KEY `unique_chat_member` (`chat_id`,`user_id`),
  KEY `idx_chat_members_user` (`user_id`,`joined_at`),
  CONSTRAINT `group_chat_members_ibfk_1` FOREIGN KEY (`chat_id`) REFERENCES `group_chats` (`chat_id`) ON DELETE CASCADE,
  CONSTRAINT `group_chat_members_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `marketplace_user_blocks` (
  `block_id` char(36) NOT NULL,
  `blocker_id` char(36) NOT NULL,
  `blocked_id` char(36) NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`block_id`),
  UNIQUE KEY `unique_block` (`blocker_id`,`blocked_id`),
  KEY `idx_blocker` (`blocker_id`),
  KEY `idx_blocked` (`blocked_id`),
  CONSTRAINT `marketplace_user_blocks_ibfk_1` FOREIGN KEY (`blocker_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `marketplace_user_blocks_ibfk_2` FOREIGN KEY (`blocked_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `skill_requests` (
  `request_id` char(36) NOT NULL,
  `offer_id` char(36) NOT NULL,
  `requester_id` char(36) NOT NULL,
  `message` text NOT NULL,
  `proposed_price` decimal(10,2) DEFAULT NULL,
  `proposed_schedule` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`proposed_schedule`)),
  `status` enum('pending','accepted','declined','completed','cancelled') DEFAULT 'pending',
  `accepted_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `cancelled_at` timestamp NULL DEFAULT NULL,
  `cancellation_reason` text DEFAULT NULL,
  `rating_by_provider` int(11) DEFAULT NULL,
  `rating_by_requester` int(11) DEFAULT NULL,
  `feedback_by_provider` text DEFAULT NULL,
  `feedback_by_requester` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`request_id`),
  KEY `idx_skill_requests_offer` (`offer_id`,`status`,`created_at` DESC),
  KEY `idx_skill_requests_requester` (`requester_id`,`created_at` DESC),
  KEY `idx_skill_requests_status` (`status`,`created_at` DESC),
  CONSTRAINT `skill_requests_ibfk_1` FOREIGN KEY (`offer_id`) REFERENCES `skill_offers` (`offer_id`) ON DELETE CASCADE,
  CONSTRAINT `skill_requests_ibfk_2` FOREIGN KEY (`requester_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `schema_migrations` (
  `name` varchar(191) NOT NULL,
  `note` varchar(1000) DEFAULT NULL,
  `applied_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `group_post_likes` (
  `post_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`post_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `group_post_likes_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `group_posts` (`post_id`) ON DELETE CASCADE,
  CONSTRAINT `group_post_likes_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `moment_comment_likes` (
  `comment_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`comment_id`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `user_interests` (
  `user_id` char(36) NOT NULL,
  `interest_slug` varchar(64) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`user_id`,`interest_slug`),
  KEY `idx_interest_slug` (`interest_slug`),
  CONSTRAINT `user_interests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `event_rsvps` (
  `rsvp_id` char(36) NOT NULL,
  `event_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `event_type` enum('club_event','campus_event') NOT NULL,
  `status` enum('going','not_going','attended','pending','accepted','rejected') DEFAULT 'pending',
  `guests_count` int(11) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`rsvp_id`),
  UNIQUE KEY `unique_event_rsvp` (`event_id`,`user_id`,`event_type`),
  KEY `idx_rsvps_user` (`user_id`,`created_at`),
  KEY `idx_rsvps_event` (`event_id`,`event_type`,`status`),
  CONSTRAINT `event_rsvps_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `study_locations` (
  `location_id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `campus` varchar(100) NOT NULL,
  `building` varchar(100) DEFAULT NULL,
  `room` varchar(50) DEFAULT NULL,
  `capacity` int(11) NOT NULL,
  `current_occupancy` int(11) DEFAULT 0,
  `facilities` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`facilities`)),
  `opening_hours` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`opening_hours`)),
  `is_available` tinyint(1) DEFAULT 1,
  `noise_level` enum('silent','quiet','moderate','loud') DEFAULT 'quiet',
  `has_power_outlets` tinyint(1) DEFAULT 1,
  `has_wifi` tinyint(1) DEFAULT 1,
  `image_urls` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`image_urls`)),
  `rating` decimal(3,2) DEFAULT 0.00,
  `review_count` int(11) DEFAULT 0,
  `last_updated` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`location_id`),
  KEY `idx_study_locations_campus` (`campus`,`is_available`,`current_occupancy`),
  KEY `idx_study_locations_rating` (`rating` DESC,`review_count` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `group_posts` (
  `post_id` char(36) NOT NULL,
  `group_id` char(36) DEFAULT NULL,
  `user_id` char(36) DEFAULT NULL,
  `content` text NOT NULL,
  `image_url` text DEFAULT NULL,
  `video_url` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`post_id`),
  KEY `user_id` (`user_id`),
  KEY `idx_gp_group` (`group_id`),
  KEY `idx_gp_created` (`created_at` DESC),
  CONSTRAINT `group_posts_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `groups` (`group_id`) ON DELETE CASCADE,
  CONSTRAINT `group_posts_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `marketplace_verifications` (
  `verification_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `id_front_url` varchar(512) NOT NULL,
  `id_back_url` varchar(512) DEFAULT NULL,
  `selfie_url` varchar(512) NOT NULL,
  `match_score` decimal(4,3) DEFAULT NULL,
  `status` enum('pending','verified','rejected','manual_review') DEFAULT 'pending',
  `rejection_reason` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`verification_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `marketplace_verifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `post_media` (
  `media_id` char(36) NOT NULL,
  `post_id` char(36) NOT NULL,
  `media_url` varchar(500) NOT NULL,
  `media_type` enum('image','video') NOT NULL,
  `upload_order` int(11) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`media_id`),
  KEY `idx_post_media_post` (`post_id`,`upload_order`),
  CONSTRAINT `post_media_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `posts` (`post_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `marketplace_favorite_sellers` (
  `favorite_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `seller_id` char(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`favorite_id`),
  UNIQUE KEY `unique_user_seller` (`user_id`,`seller_id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_seller` (`seller_id`),
  CONSTRAINT `marketplace_favorite_sellers_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `marketplace_favorite_sellers_ibfk_2` FOREIGN KEY (`seller_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `order_disputes` (
  `dispute_id` char(36) NOT NULL,
  `order_id` char(36) NOT NULL,
  `raised_by` char(36) NOT NULL,
  `reason` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `status` enum('open','investigating','resolved','closed') DEFAULT 'open',
  `resolution_notes` text DEFAULT NULL,
  `resolved_by` char(36) DEFAULT NULL,
  `resolved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`dispute_id`),
  KEY `fk_od_raised_by` (`raised_by`),
  KEY `fk_od_resolved_by` (`resolved_by`),
  KEY `idx_od_order` (`order_id`),
  KEY `idx_od_status` (`status`),
  CONSTRAINT `fk_od_order` FOREIGN KEY (`order_id`) REFERENCES `marketplace_orders` (`order_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_od_raised_by` FOREIGN KEY (`raised_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_od_resolved_by` FOREIGN KEY (`resolved_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `order_audit_log` (
  `log_id` char(36) NOT NULL,
  `order_id` char(36) NOT NULL,
  `actor_id` char(36) NOT NULL,
  `action` varchar(50) NOT NULL,
  `old_status` varchar(20) DEFAULT NULL,
  `new_status` varchar(20) DEFAULT NULL,
  `changes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`changes`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`log_id`),
  KEY `idx_oal_order` (`order_id`,`created_at`),
  KEY `idx_oal_actor` (`actor_id`,`created_at`),
  CONSTRAINT `fk_oal_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_oal_order` FOREIGN KEY (`order_id`) REFERENCES `marketplace_orders` (`order_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci ROW_FORMAT=COMPRESSED;

CREATE TABLE IF NOT EXISTS `group_post_comments` (
  `comment_id` char(36) NOT NULL,
  `post_id` char(36) DEFAULT NULL,
  `user_id` char(36) DEFAULT NULL,
  `content` text NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`comment_id`),
  KEY `post_id` (`post_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `group_post_comments_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `group_posts` (`post_id`) ON DELETE CASCADE,
  CONSTRAINT `group_post_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `group_requests` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `group_id` char(36) DEFAULT NULL,
  `user_id` char(36) DEFAULT NULL,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `req_user` (`group_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `group_requests_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `groups` (`group_id`) ON DELETE CASCADE,
  CONSTRAINT `group_requests_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `onboarding_events` (
  `event_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `event_type` varchar(32) NOT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`event_id`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `onboarding_events_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `marketplace_seller_settings` (
  `user_id` char(36) NOT NULL,
  `profile_visibility` enum('public','private','verified_only') DEFAULT 'public',
  `message_permissions` enum('everyone','verified_only') DEFAULT 'everyone',
  `notifications_messages` tinyint(1) DEFAULT 1,
  `notifications_offers` tinyint(1) DEFAULT 1,
  `notifications_marketing` tinyint(1) DEFAULT 0,
  `auto_reply_enabled` tinyint(1) DEFAULT 0,
  `auto_reply_text` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`),
  CONSTRAINT `marketplace_seller_settings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `marketplace_payout_settings` (
  `payout_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `provider` enum('mpesa','bank','wallet') NOT NULL,
  `account_number` varchar(255) NOT NULL,
  `account_name` varchar(255) NOT NULL,
  `is_default` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`payout_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `marketplace_payout_settings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `support_tickets` (
  `ticket_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `category` enum('verification','payment','abuse','listing','account','other') NOT NULL,
  `subject` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `status` enum('open','in_progress','resolved','closed') DEFAULT 'open',
  `priority` enum('low','medium','high') DEFAULT 'low',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`ticket_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `support_tickets_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `support_messages` (
  `message_id` char(36) NOT NULL,
  `ticket_id` char(36) NOT NULL,
  `sender_id` char(36) NOT NULL,
  `message` text NOT NULL,
  `is_admin` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`message_id`),
  KEY `ticket_id` (`ticket_id`),
  KEY `sender_id` (`sender_id`),
  CONSTRAINT `support_messages_ibfk_1` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets` (`ticket_id`) ON DELETE CASCADE,
  CONSTRAINT `support_messages_ibfk_2` FOREIGN KEY (`sender_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `poll_comments` (
  `comment_id` char(36) NOT NULL,
  `poll_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `content` text NOT NULL,
  `parent_id` char(36) DEFAULT NULL,
  `like_count` int(11) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`comment_id`),
  KEY `poll_id` (`poll_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `poll_comments_ibfk_1` FOREIGN KEY (`poll_id`) REFERENCES `polls` (`poll_id`) ON DELETE CASCADE,
  CONSTRAINT `poll_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `sticker_templates` (
  `template_id` varchar(36) NOT NULL,
  `type` varchar(50) NOT NULL,
  `prompt` text DEFAULT NULL,
  `icon_name` varchar(100) DEFAULT NULL,
  `usage_count` int(11) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`template_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `sparkly_message_feedback` (
  `id` char(36) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `message_id` varchar(64) NOT NULL,
  `feedback_type` enum('like','dislike') NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_sparkly_fb_user_msg` (`user_id`,`message_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `chat_rooms` (
  `id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `avatarUrl` text DEFAULT NULL,
  `ownerId` varchar(36) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `chat_room_members` (
  `chatRoomId` varchar(36) NOT NULL,
  `userId` char(36) NOT NULL,
  `role` enum('OWNER','ADMIN','MEMBER') NOT NULL DEFAULT 'MEMBER',
  `joinedAt` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`chatRoomId`,`userId`),
  KEY `idx_chatRoomId` (`chatRoomId`),
  KEY `idx_userId` (`userId`),
  CONSTRAINT `chat_room_members_ibfk_1` FOREIGN KEY (`chatRoomId`) REFERENCES `chat_rooms` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `security_events` (
  `event_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `event_type` varchar(50) NOT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`details`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `session_id` varchar(255) DEFAULT NULL,
  `is_interruptive` tinyint(1) DEFAULT 0,
  `acknowledged_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`event_id`),
  KEY `idx_security_events_user` (`user_id`,`created_at`),
  KEY `idx_se_user_interruptive_ack` (`user_id`,`is_interruptive`,`acknowledged_at`,`created_at`),
  CONSTRAINT `security_events_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `media_deliveries` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `media_id` varchar(128) NOT NULL,
  `recipient_id` varchar(128) NOT NULL,
  `download_status` enum('PENDING','DOWNLOADED') DEFAULT 'PENDING',
  `downloaded_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_media_recipient` (`media_id`,`recipient_id`),
  CONSTRAINT `media_deliveries_ibfk_1` FOREIGN KEY (`media_id`) REFERENCES `media_objects` (`media_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `otp_verifications` (
  `verification_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `channel` enum('email','sms') NOT NULL,
  `destination` varchar(255) NOT NULL,
  `code_hash` varchar(255) NOT NULL,
  `attempts` tinyint(4) DEFAULT 0,
  `expires_at` timestamp NOT NULL,
  `verified_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`verification_id`),
  KEY `idx_otp_user_channel` (`user_id`,`channel`,`expires_at`),
  KEY `idx_otp_user_channel_created` (`user_id`,`channel`,`created_at`),
  CONSTRAINT `otp_verifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `chat_sequences` (
  `chat_id` varchar(128) NOT NULL,
  `last_sequence` bigint(20) NOT NULL DEFAULT 0,
  PRIMARY KEY (`chat_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `media_objects` (
  `media_id` varchar(128) NOT NULL,
  `chat_id` varchar(128) NOT NULL,
  `uploader_id` varchar(128) NOT NULL,
  `mime_type` varchar(128) NOT NULL,
  `size_bytes` bigint(20) NOT NULL,
  `sha256_hash` varchar(128) NOT NULL,
  `encryption_iv` varchar(128) NOT NULL,
  `thumbnail_blurhash` text DEFAULT NULL,
  `status` enum('UPLOADING','AVAILABLE','DELIVERED','DOWNLOADED','EXPIRED','DELETED') DEFAULT 'UPLOADING',
  `expires_at` datetime NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`media_id`),
  KEY `idx_chat_media` (`chat_id`),
  KEY `idx_media_status_expiry` (`status`,`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `security_transactions` (
  `transaction_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `purpose` enum('2fa_email_enroll','2fa_sms_enroll','2fa_email_alternate','2fa_disable','password_change','password_reset','pin_reset','recovery_regen','security_email_change') NOT NULL,
  `destination` varchar(255) DEFAULT NULL,
  `otp_hash` varchar(255) DEFAULT NULL,
  `verification_token` varchar(255) DEFAULT NULL,
  `token_expires_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NOT NULL,
  `attempt_count` tinyint(4) DEFAULT 0,
  `max_attempts` tinyint(4) DEFAULT 5,
  `status` enum('pending','verified','consumed','expired','cancelled') DEFAULT 'pending',
  `actor_session_id` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `verified_at` timestamp NULL DEFAULT NULL,
  `consumed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`transaction_id`),
  KEY `idx_sec_tx_user` (`user_id`,`purpose`,`status`),
  KEY `idx_sec_tx_token` (`verification_token`),
  CONSTRAINT `security_transactions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
