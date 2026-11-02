# Sparkle API — full schema structure

Extracted directly from `INFORMATION_SCHEMA` for the live `lilbee_sparkle`
database. **Structure only — no table data.**

- Tables: 209
- Columns: 1984
- Constraints: 591 (of which foreign keys: 230)

Anything not on the common `utf8mb4_general_ci` collation is **bolded** —
those were the migration targets that broke cross-table comparisons.

| # | Table | Collation | Rows | Columns | FKs |
|---|-------|-----------|------|---------|-----|
| 1 | `account_appeal_cases` | `utf8mb4_general_ci` | 0 | 13 | 0 |
| 2 | `account_lifecycle_audit` | `utf8mb4_general_ci` | 3 | 12 | 0 |
| 3 | `account_recovery_requests` | `utf8mb4_general_ci` | 4 | 12 | 0 |
| 4 | `achievements` | `utf8mb4_general_ci` | 4 | 8 | 0 |
| 5 | `add_yours_prompts` | `utf8mb4_general_ci` | 6 | 7 | 1 |
| 6 | `add_yours_responses` | `utf8mb4_general_ci` | 0 | 6 | 3 |
| 7 | `admin_logs` | `utf8mb4_general_ci` | 353 | 10 | 1 |
| 8 | `admin_sessions` | `utf8mb4_general_ci` | 4 | 5 | 1 |
| 9 | `appeals` | `utf8mb4_general_ci` | 0 | 7 | 2 |
| 10 | `bookmarks` | `utf8mb4_general_ci` | 25 | 4 | 2 |
| 11 | `boost_reminders` | `utf8mb4_general_ci` | 0 | 4 | 0 |
| 12 | `campus_events` | `utf8mb4_general_ci` | 5 | 19 | 1 |
| 13 | `canonical_media_assets` | `utf8mb4_general_ci` | 1 | 7 | 0 |
| 14 | `capture_attempts` | `utf8mb4_general_ci` | 0 | 9 | 0 |
| 15 | `capture_audit_log` | `utf8mb4_general_ci` | 0 | 11 | 0 |
| 16 | `capture_notifications` | `utf8mb4_general_ci` | 0 | 6 | 0 |
| 17 | `channel_messages` | `utf8mb4_general_ci` | 0 | 15 | 3 |
| 18 | `channel_notification_settings` | `utf8mb4_general_ci` | 0 | 4 | 2 |
| 19 | `channel_permissions` | `utf8mb4_general_ci` | 0 | 10 | 1 |
| 20 | `channel_read_state` | `utf8mb4_general_ci` | 0 | 6 | 2 |
| 21 | `chat_nicknames` | `utf8mb4_general_ci` | 0 | 8 | 0 |
| 22 | `chat_privacy_settings` | `utf8mb4_general_ci` | 21 | 13 | 0 |
| 23 | `chat_rooms` | `utf8mb4_general_ci` | 0 | 6 | 0 |
| 24 | `chat_room_members` | `utf8mb4_general_ci` | 0 | 4 | 0 |
| 25 | `chat_sequences` | `utf8mb4_general_ci` | 64 | 2 | 0 |
| 26 | `close_friends` | `utf8mb4_general_ci` | 4 | 5 | 0 |
| 27 | `clubs` | `utf8mb4_general_ci` | 9 | 18 | 1 |
| 28 | `club_announcements` | `utf8mb4_general_ci` | 0 | 5 | 1 |
| 29 | `club_events` | `utf8mb4_general_ci` | 0 | 14 | 1 |
| 30 | `club_event_rsvps` | `utf8mb4_general_ci` | 0 | 6 | 1 |
| 31 | `club_event_updates` | `utf8mb4_general_ci` | 0 | 8 | 3 |
| 32 | `club_members` | `utf8mb4_general_ci` | 12 | 7 | 3 |
| 33 | `comments` | `utf8mb4_general_ci` | 54993 | 12 | 3 |
| 34 | `comment_likes` | `utf8mb4_general_ci` | 30 | 4 | 2 |
| 35 | `confessions` | `utf8mb4_general_ci` | 18 | 21 | 0 |
| 36 | `confession_comments` | `utf8mb4_general_ci` | 12 | 7 | 3 |
| 37 | `confession_reactions` | `utf8mb4_general_ci` | 22 | 5 | 2 |
| 38 | `confession_reports` | `utf8mb4_general_ci` | 0 | 5 | 2 |
| 39 | `conversations` | `utf8mb4_general_ci` | 0 | 3 | 0 |
| 40 | `data_export_jobs` | `utf8mb4_general_ci` | 2 | 15 | 0 |
| 41 | `delivery_queue` | `utf8mb4_general_ci` | 0 | 7 | 0 |
| 42 | `email_verifications` | `utf8mb4_general_ci` | 31 | 7 | 1 |
| 43 | `event_rsvps` | `utf8mb4_general_ci` | 10 | 8 | 1 |
| 44 | `fcm_tokens` | `utf8mb4_general_ci` | 9 | 6 | 1 |
| 45 | `follows` | `utf8mb4_general_ci` | 347 | 4 | 2 |
| 46 | `follow_requests` | `utf8mb4_general_ci` | 8 | 6 | 2 |
| 47 | `groups` | `utf8mb4_general_ci` | 19 | 16 | 1 |
| 48 | `group_channels` | `utf8mb4_general_ci` | 15 | 12 | 0 |
| 49 | `group_chats` | `utf8mb4_general_ci` | 15 | 26 | 1 |
| 50 | `group_chat_members` | `utf8mb4_general_ci` | 51 | 8 | 2 |
| 51 | `group_members` | `utf8mb4_general_ci` | 105 | 8 | 2 |
| 52 | `group_posts` | `utf8mb4_general_ci` | 9 | 7 | 2 |
| 53 | `group_post_comments` | `utf8mb4_general_ci` | 0 | 5 | 2 |
| 54 | `group_post_likes` | `utf8mb4_general_ci` | 0 | 3 | 2 |
| 55 | `group_requests` | `utf8mb4_general_ci` | 5 | 5 | 2 |
| 56 | `hashtags` | `utf8mb4_general_ci` | 0 | 4 | 0 |
| 57 | `highlights` | `utf8mb4_general_ci` | 9 | 5 | 1 |
| 58 | `highlight_stories` | `utf8mb4_general_ci` | 13 | 5 | 2 |
| 59 | `interaction_events` | `utf8mb4_general_ci` | 216 | 7 | 0 |
| 60 | `listing_media` | `utf8mb4_general_ci` | 45 | 6 | 1 |
| 61 | `listing_reports` | `utf8mb4_general_ci` | 1 | 9 | 3 |
| 62 | `listing_tags` | `utf8mb4_general_ci` | 0 | 2 | 0 |
| 63 | `live_location_sessions` | `utf8mb4_general_ci` | 4 | 15 | 0 |
| 64 | `live_streams` | `utf8mb4_general_ci` | 5 | 12 | 1 |
| 65 | `login_activity` | `utf8mb4_general_ci` | 141 | 9 | 0 |
| 66 | `login_attempts` | `utf8mb4_general_ci` | 115 | 6 | 0 |
| 67 | `lost_found_items` | `utf8mb4_general_ci` | 15 | 16 | 2 |
| 68 | `lost_found_media` | `utf8mb4_general_ci` | 13 | 6 | 1 |
| 69 | `marketplace_blocks` | `utf8mb4_general_ci` | 0 | 5 | 0 |
| 70 | `marketplace_conversations` | `utf8mb4_general_ci` | 9 | 11 | 0 |
| 71 | `marketplace_favorites` | `utf8mb4_general_ci` | 13 | 4 | 2 |
| 72 | `marketplace_favorite_sellers` | `utf8mb4_general_ci` | 1 | 4 | 2 |
| 73 | `marketplace_listings` | `utf8mb4_general_ci` | 35 | 32 | 1 |
| 74 | `marketplace_messages` | `utf8mb4_general_ci` | 18 | 9 | 0 |
| 75 | `marketplace_message_reactions` | `utf8mb4_general_ci` | 2 | 5 | 0 |
| 76 | `marketplace_message_settings` | `utf8mb4_general_ci` | 3 | 9 | 1 |
| 77 | `marketplace_message_status` | `utf8mb4_general_ci` | 18 | 3 | 0 |
| 78 | `marketplace_orders` | `utf8mb4_general_ci` | 7 | 29 | 4 |
| 79 | `marketplace_payout_settings` | `utf8mb4_general_ci` | 0 | 8 | 1 |
| 80 | `marketplace_reviews` | `utf8mb4_general_ci` | 0 | 9 | 3 |
| 81 | `marketplace_seller_alerts` | `utf8mb4_general_ci` | 2 | 6 | 2 |
| 82 | `marketplace_seller_favorites` | `utf8mb4_general_ci` | 1 | 4 | 0 |
| 83 | `marketplace_seller_settings` | `utf8mb4_general_ci` | 0 | 10 | 1 |
| 84 | `marketplace_user_blocks` | `utf8mb4_general_ci` | 1 | 5 | 2 |
| 85 | `marketplace_verifications` | `utf8mb4_general_ci` | 0 | 10 | 1 |
| 86 | `marketplace_wishlist` | `utf8mb4_general_ci` | 10 | 4 | 2 |
| 87 | `media_deliveries` | `utf8mb4_general_ci` | 0 | 5 | 1 |
| 88 | `media_health_checks` | `utf8mb4_general_ci` | 1264 | 9 | 0 |
| 89 | `media_objects` | `utf8mb4_general_ci` | 0 | 11 | 0 |
| 90 | `media_registry` | `utf8mb4_general_ci` | 97 | 17 | 0 |
| 91 | `messages` | `utf8mb4_general_ci` | 1898 | 67 | 8 |
| 92 | `message_bookmarks` | `utf8mb4_general_ci` | 0 | 4 | 0 |
| 93 | `message_deletions` | `utf8mb4_general_ci` | 1929 | 5 | 2 |
| 94 | `message_forward_deliveries` | `utf8mb4_general_ci` | 101 | 7 | 0 |
| 95 | `message_hidden` | `utf8mb4_general_ci` | 0 | 4 | 2 |
| 96 | `message_pins` | `utf8mb4_general_ci` | 15 | 5 | 0 |
| 97 | `message_reactions` | `utf8mb4_general_ci` | 103 | 6 | 2 |
| 98 | `message_read_status` | `utf8mb4_general_ci` | 896 | 5 | 2 |
| 99 | `message_requests` | `utf8mb4_general_ci` | 0 | 6 | 2 |
| 100 | `message_stars` | `utf8mb4_general_ci` | 4 | 4 | 0 |
| 101 | `moderation_scores` | `utf8mb4_general_ci` | 5 | 7 | 1 |
| 102 | `moments` | `utf8mb4_general_ci` | 224 | 40 | 1 |
| 103 | `moment_audience_lists` | `utf8mb4_general_ci` | 0 | 5 | 0 |
| 104 | `moment_comments` | `utf8mb4_general_ci` | 20 | 9 | 2 |
| 105 | `moment_comment_likes` | `utf8mb4_general_ci` | 5 | 3 | 0 |
| 106 | `moment_drafts` | `utf8mb4_general_ci` | 1 | 9 | 0 |
| 107 | `moment_hashtags` | `utf8mb4_general_ci` | 769 | 4 | 0 |
| 108 | `moment_likes` | `utf8mb4_general_ci` | 109 | 3 | 0 |
| 109 | `moment_views` | `utf8mb4_general_ci` | 28 | 3 | 0 |
| 110 | `notifications` | `utf8mb4_general_ci` | 2555 | 26 | 2 |
| 111 | `onboarding_events` | `utf8mb4_general_ci` | 66 | 5 | 1 |
| 112 | `order_audit_log` | `utf8mb4_general_ci` | 8 | 9 | 2 |
| 113 | `order_disputes` | `utf8mb4_general_ci` | 0 | 10 | 3 |
| 114 | `otp_verifications` | `utf8mb4_general_ci` | 12 | 9 | 1 |
| 115 | `participants` | `utf8mb4_general_ci` | 0 | 5 | 2 |
| 116 | `password_resets` | `utf8mb4_general_ci` | 4 | 7 | 1 |
| 117 | `password_reset_tokens` | `utf8mb4_general_ci` | 0 | 6 | 1 |
| 118 | `personal_chats` | `utf8mb4_general_ci` | 302 | 29 | 3 |
| 119 | `polls` | `utf8mb4_general_ci` | 13 | 20 | 1 |
| 120 | `poll_comments` | `utf8mb4_general_ci` | 0 | 7 | 2 |
| 121 | `poll_invites` | `utf8mb4_general_ci` | 2 | 5 | 0 |
| 122 | `poll_options` | `utf8mb4_general_ci` | 43 | 5 | 1 |
| 123 | `poll_predictions` | `utf8mb4_general_ci` | 10 | 6 | 2 |
| 124 | `poll_votes` | `utf8mb4_general_ci` | 78 | 5 | 3 |
| 125 | `posts` | `utf8mb4_general_ci` | 725 | 31 | 1 |
| 126 | `post_hashtags` | `utf8mb4_general_ci` | 4 | 2 | 1 |
| 127 | `post_media` | `utf8mb4_general_ci` | 4 | 6 | 1 |
| 128 | `post_reports` | `utf8mb4_general_ci` | 0 | 8 | 3 |
| 129 | `post_reshares` | `utf8mb4_general_ci` | 0 | 4 | 1 |
| 130 | `push_notifications` | `utf8mb4_general_ci` | 233 | 11 | 0 |
| 131 | `push_subscriptions` | `utf8mb4_general_ci` | 0 | 6 | 1 |
| 132 | `referrals` | `utf8mb4_general_ci` | 2 | 12 | 0 |
| 133 | `referral_clicks` | `utf8mb4_general_ci` | 12 | 13 | 0 |
| 134 | `referral_codes` | `utf8mb4_general_ci` | 21 | 6 | 0 |
| 135 | `referral_rewards` | `utf8mb4_general_ci` | 2 | 9 | 0 |
| 136 | `refresh_tokens` | `utf8mb4_general_ci` | 691 | 6 | 0 |
| 137 | `reports` | `utf8mb4_general_ci` | 4 | 5 | 2 |
| 138 | `reposts` | `utf8mb4_general_ci` | 3 | 5 | 2 |
| 139 | `rooms` | `utf8mb4_general_ci` | 0 | 17 | 1 |
| 140 | `room_activity_log` | `utf8mb4_general_ci` | 0 | 8 | 1 |
| 141 | `room_bans` | `utf8mb4_general_ci` | 0 | 7 | 2 |
| 142 | `room_channels` | `utf8mb4_general_ci` | 0 | 16 | 2 |
| 143 | `room_invites` | `utf8mb4_general_ci` | 0 | 9 | 2 |
| 144 | `room_members` | `utf8mb4_general_ci` | 0 | 9 | 2 |
| 145 | `room_reports` | `utf8mb4_general_ci` | 0 | 10 | 2 |
| 146 | `room_voice_sessions` | `utf8mb4_general_ci` | 0 | 7 | 1 |
| 147 | `room_warnings` | `utf8mb4_general_ci` | 0 | 7 | 3 |
| 148 | `safe_meetup_locations` | `utf8mb4_general_ci` | 6 | 12 | 0 |
| 149 | `saved_moments` | `utf8mb4_general_ci` | 14 | 3 | 0 |
| 150 | `saved_posts` | `utf8mb4_general_ci` | 6 | 4 | 2 |
| 151 | `saved_stickers` | `utf8mb4_general_ci` | 3 | 6 | 0 |
| 152 | `schema_migrations` | `utf8mb4_general_ci` | 76 | 3 | 0 |
| 153 | `screenshot_audit` | `utf8mb4_general_ci` | 0 | 6 | 0 |
| 154 | `search_history` | `utf8mb4_general_ci` | 9 | 4 | 0 |
| 155 | `security_events` | `utf8mb4_general_ci` | 48 | 10 | 1 |
| 156 | `security_transactions` | `utf8mb4_general_ci` | 26 | 15 | 1 |
| 157 | `services` | `utf8mb4_general_ci` | 0 | 19 | 1 |
| 158 | `skill_bookings` | `utf8mb4_general_ci` | 18 | 8 | 2 |
| 159 | `skill_offers` | `utf8mb4_general_ci` | 10 | 12 | 1 |
| 160 | `skill_requests` | `utf8mb4_general_ci` | 0 | 17 | 2 |
| 161 | `skill_reviews` | `utf8mb4_general_ci` | 6 | 6 | 2 |
| 162 | `sparkle_ota_versions` | `utf8mb4_general_ci` | 0 | 9 | 0 |
| 163 | `sparkly_conversations` | `utf8mb4_general_ci` | 27 | 6 | 1 |
| 164 | `sparkly_messages` | `utf8mb4_general_ci` | 95 | 7 | 2 |
| 165 | `sparkly_message_feedback` | `utf8mb4_general_ci` | 2 | 5 | 0 |
| 166 | `sparkly_user_memories` | `utf8mb4_general_ci` | 0 | 11 | 1 |
| 167 | `sparks` | `utf8mb4_general_ci` | 26532 | 7 | 3 |
| 168 | `sticker_poll_votes` | `utf8mb4_general_ci` | 0 | 5 | 2 |
| 169 | `sticker_quiz_answers` | `utf8mb4_general_ci` | 0 | 5 | 2 |
| 170 | `sticker_templates` | `utf8mb4_general_ci` | 5 | 6 | 0 |
| 171 | `stories` | `utf8mb4_general_ci` | 158 | 46 | 4 |
| 172 | `story_comments` | `utf8mb4_general_ci` | 31 | 5 | 0 |
| 173 | `story_likes` | `utf8mb4_general_ci` | 53 | 4 | 2 |
| 174 | `story_privacy_blocks` | `utf8mb4_general_ci` | 1 | 4 | 0 |
| 175 | `story_reactions` | `utf8mb4_general_ci` | 0 | 5 | 2 |
| 176 | `story_shares` | `utf8mb4_general_ci` | 2 | 4 | 2 |
| 177 | `story_stickers` | `utf8mb4_general_ci` | 14 | 9 | 1 |
| 178 | `story_views` | `utf8mb4_general_ci` | 43 | 4 | 1 |
| 179 | `stream_followers` | `utf8mb4_general_ci` | 0 | 4 | 0 |
| 180 | `stream_updates` | `utf8mb4_general_ci` | 0 | 4 | 0 |
| 181 | `study_locations` | `utf8mb4_general_ci` | 0 | 18 | 0 |
| 182 | `suggestion_dismissals` | `utf8mb4_general_ci` | 1 | 3 | 0 |
| 183 | `support_messages` | `utf8mb4_general_ci` | 0 | 6 | 2 |
| 184 | `support_requests` | `utf8mb4_general_ci` | 9 | 9 | 0 |
| 185 | `support_tickets` | `utf8mb4_general_ci` | 0 | 9 | 1 |
| 186 | `users` | `utf8mb4_general_ci` | 190 | 137 | 1 |
| 187 | `user_achievements` | `utf8mb4_general_ci` | 0 | 5 | 2 |
| 188 | `user_actions` | `utf8mb4_general_ci` | 1753 | 8 | 0 |
| 189 | `user_automation_rules` | `utf8mb4_general_ci` | 0 | 6 | 1 |
| 190 | `user_blocks` | `utf8mb4_general_ci` | 0 | 4 | 2 |
| 191 | `user_boosts` | `utf8mb4_general_ci` | 0 | 11 | 0 |
| 192 | `user_interests` | `utf8mb4_general_ci` | 36 | 3 | 1 |
| 193 | `user_legal_consents` | `utf8mb4_general_ci` | 40 | 6 | 0 |
| 194 | `user_mutes` | `utf8mb4_general_ci` | 1 | 4 | 2 |
| 195 | `user_poll_interests` | `utf8mb4_general_ci` | 5 | 4 | 0 |
| 196 | `user_reports` | `utf8mb4_general_ci` | 4 | 6 | 2 |
| 197 | `user_security_logs` | `utf8mb4_general_ci` | 0 | 6 | 1 |
| 198 | `user_sessions` | `utf8mb4_general_ci` | 2028 | 12 | 0 |
| 199 | `user_signals_bridge` | `utf8mb4_general_ci` | 34 | 5 | 0 |
| 200 | `user_trust` | `utf8mb4_general_ci` | 0 | 5 | 1 |
| 201 | `verification_requests` | `utf8mb4_general_ci` | 2 | 9 | 1 |
| 202 | `video_calls` | `utf8mb4_general_ci` | 0 | 6 | 2 |
| 203 | `wallets` | `utf8mb4_general_ci` | 190 | 10 | 1 |
| 204 | `wallet_auto_withdrawal_configs` | `utf8mb4_general_ci` | 2 | 16 | 1 |
| 205 | `wallet_deposits` | `utf8mb4_general_ci` | 59 | 11 | 1 |
| 206 | `wallet_transactions` | `utf8mb4_general_ci` | 115 | 10 | 1 |
| 207 | `wallet_webhook_events` | `utf8mb4_general_ci` | 0 | 12 | 0 |
| 208 | `wallet_webhook_log` | `utf8mb4_general_ci` | 2 | 4 | 0 |
| 209 | `wallet_withdrawals` | `utf8mb4_general_ci` | 105 | 18 | 1 |

---

## `account_appeal_cases`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `case_id` | `varchar(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `reference_number` | `varchar(32)` | NO | — | UNI | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `varchar(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `contact_email` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `reason_category` | `varchar(100)` | NO | — | — | — | `utf8mb4_general_ci` |
| 6 | `explanation` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 7 | `status` | `enum('SUBMITTED','UNDER_REVIEW','NEEDS_INFORMATION','APPROVED','REJECTED')` | NO | `'SUBMITTED'` | MUL | — | `utf8mb4_general_ci` |
| 8 | `reviewer_id` | `varchar(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 9 | `reviewer_decision` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 10 | `reviewer_notes` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 11 | `decided_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 12 | `created_at` | `timestamp` | NO | `current_timestamp()` | — | — | — |
| 13 | `updated_at` | `timestamp` | NO | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `idx_appeal_ref` (reference_number)
- `idx_appeal_status` (status)
- `idx_appeal_user` (user_id)
- `PRIMARY` (case_id)
- `reference_number` (reference_number)

**Constraints**: `PRIMARY` (PRIMARY KEY), `reference_number` (UNIQUE)

---

## `account_lifecycle_audit`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `varchar(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `varchar(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `action` | `varchar(50)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `previous_status` | `varchar(32)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 5 | `new_status` | `varchar(32)` | NO | — | — | — | `utf8mb4_general_ci` |
| 6 | `initiated_by` | `varchar(36)` | NO | — | — | — | `utf8mb4_general_ci` |
| 7 | `actor_role` | `varchar(32)` | YES | `'''user'''` | — | — | `utf8mb4_general_ci` |
| 8 | `reason` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 9 | `ip_address` | `varchar(45)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 10 | `user_agent` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 11 | `metadata` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 12 | `created_at` | `timestamp` | YES | `current_timestamp()` | MUL | — | — |

**Indexes**
- `idx_lifecycle_action` (action)
- `idx_lifecycle_created` (created_at)
- `idx_lifecycle_user` (user_id)
- `PRIMARY` (id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `account_recovery_requests`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `request_id` | `varchar(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `varchar(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `contact_identifier` | `varchar(255)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `contact_type` | `enum('email','phone')` | NO | `'email'` | — | — | `utf8mb4_general_ci` |
| 5 | `challenge_code` | `varchar(64)` | NO | — | — | — | `utf8mb4_general_ci` |
| 6 | `action_type` | `enum('CANCEL_DELETION','APPEAL_TERMINATION','DATA_EXPORT','STATUS_CHECK')` | NO | — | — | — | `utf8mb4_general_ci` |
| 7 | `status` | `enum('PENDING','VERIFIED','CONSUMED','EXPIRED','FAILED')` | NO | `'PENDING'` | — | — | `utf8mb4_general_ci` |
| 8 | `attempts` | `int(11)` | YES | `0` | — | — | — |
| 9 | `verified_token` | `varchar(128)` | YES | **'NULL' ← string!** | UNI | — | `utf8mb4_general_ci` |
| 10 | `expires_at` | `timestamp` | NO | — | — | — | — |
| 11 | `created_at` | `timestamp` | NO | `current_timestamp()` | — | — | — |
| 12 | `verified_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |

**Indexes**
- `idx_recovery_contact` (contact_identifier)
- `idx_recovery_token` (verified_token)
- `idx_recovery_user` (user_id, action_type)
- `PRIMARY` (request_id)
- `verified_token` (verified_token)

**Constraints**: `PRIMARY` (PRIMARY KEY), `verified_token` (UNIQUE)

---

## `achievements`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `achievement_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `name` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 3 | `description` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `icon_url` | `varchar(500)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 5 | `criteria` | `longtext` | NO | — | — | — | **`utf8mb4_bin`** |
| 6 | `category` | `varchar(50)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 7 | `points` | `int(11)` | YES | `0` | — | — | — |
| 8 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_achievements_category` (category)
- `PRIMARY` (achievement_id)

**Constraints**: `criteria` (CHECK), `PRIMARY` (PRIMARY KEY)

---

## `add_yours_prompts`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `prompt_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `creator_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `text` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `style_config` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 5 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 6 | `expires_at` | `timestamp` | YES | `(current_timestamp() + interval 24 hour)` | MUL | — | — |
| 7 | `visibility` | `enum('public','followers')` | YES | `'public'` | — | — | `utf8mb4_general_ci` |

**Indexes**
- `idx_add_yours_creator` (creator_id, created_at)
- `idx_add_yours_expires` (expires_at)
- `PRIMARY` (prompt_id)

**Foreign keys**
- `add_yours_prompts_ibfk_1`: (creator_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `style_config` (CHECK)

---

## `add_yours_responses`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `response_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `prompt_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `story_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 5 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 6 | `content` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |

**Indexes**
- `idx_response_prompt` (prompt_id, created_at)
- `idx_response_user` (user_id, created_at)
- `PRIMARY` (response_id)
- `story_id` (story_id)
- `unique_response` (prompt_id, user_id)

**Foreign keys**
- `add_yours_responses_ibfk_1`: (prompt_id) → `add_yours_prompts`.prompt_id
- `add_yours_responses_ibfk_2`: (user_id) → `users`.user_id
- `add_yours_responses_ibfk_3`: (story_id) → `stories`.story_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_response` (UNIQUE)

---

## `admin_logs`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `log_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `admin_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `action` | `varchar(100)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `target_type` | `varchar(50)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 5 | `target_id` | `varchar(100)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `details` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 7 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 8 | `level` | `enum('info','warning','danger')` | YES | `'info'` | — | — | `utf8mb4_general_ci` |
| 9 | `ip_address` | `varchar(45)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 10 | `user_agent` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |

**Indexes**
- `admin_id` (admin_id)
- `PRIMARY` (log_id)

**Foreign keys**
- `admin_logs_ibfk_1`: (admin_id) → `users`.user_id

**Constraints**: `details` (CHECK), `PRIMARY` (PRIMARY KEY)

---

## `admin_sessions`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `token_hash` | `char(64)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 4 | `expires_at` | `timestamp` | NO | — | — | — | — |
| 5 | `expires_epoch` | `bigint(20)` | YES | **'NULL' ← string!** | MUL | — | — |

**Indexes**
- `idx_admin_sessions_expiry` (expires_epoch)
- `idx_admin_sessions_user` (user_id, expires_at)
- `PRIMARY` (token_hash)

**Foreign keys**
- `admin_sessions_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `appeals`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `post_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `reason` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `status` | `enum('pending','approved','rejected')` | YES | `'pending'` | — | — | `utf8mb4_general_ci` |
| 6 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 7 | `reviewed_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |

**Indexes**
- `post_id` (post_id)
- `PRIMARY` (id)
- `user_id` (user_id)

**Foreign keys**
- `appeals_ibfk_1`: (post_id) → `posts`.post_id
- `appeals_ibfk_2`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `bookmarks`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `bookmark_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `post_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_bookmarks_user` (user_id, created_at)
- `post_id` (post_id)
- `PRIMARY` (bookmark_id)
- `unique_user_post_bookmark` (user_id, post_id)

**Foreign keys**
- `bookmarks_ibfk_1`: (user_id) → `users`.user_id
- `bookmarks_ibfk_2`: (post_id) → `posts`.post_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_user_post_bookmark` (UNIQUE)

---

## `boost_reminders`

Engine `InnoDB` · collation utf8mb4_general_ci · _Idempotency guard for boost reminders and expiration alerts_

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `varchar(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `boost_id` | `varchar(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `reminder_type` | `enum('2_day','1_day','expired')` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `sent_at` | `datetime` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_boost_reminder_boost` (boost_id)
- `PRIMARY` (id)
- `uk_boost_reminder` (boost_id, reminder_type)

**Constraints**: `PRIMARY` (PRIMARY KEY), `uk_boost_reminder` (UNIQUE)

---

## `campus_events`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `event_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `creator_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `title` | `varchar(200)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `description` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `event_type` | `varchar(50)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `location` | `varchar(200)` | NO | — | — | — | `utf8mb4_general_ci` |
| 7 | `campus` | `varchar(100)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 8 | `start_time` | `timestamp` | NO | — | MUL | — | — |
| 9 | `end_time` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 10 | `image_url` | `varchar(500)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 11 | `max_attendees` | `int(11)` | YES | **'NULL' ← string!** | — | — | — |
| 12 | `total_rsvps` | `int(11)` | YES | `0` | — | — | — |
| 13 | `is_public` | `tinyint(1)` | YES | `1` | — | — | — |
| 14 | `is_official` | `tinyint(1)` | YES | `0` | — | — | — |
| 15 | `contact_email` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 16 | `contact_phone` | `varchar(20)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 17 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 18 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |
| 19 | `requirements` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |

**Indexes**
- `idx_campus_events_campus` (campus, start_time)
- `idx_campus_events_creator` (creator_id, created_at)
- `idx_campus_events_upcoming` (start_time, is_public)
- `PRIMARY` (event_id)

**Foreign keys**
- `campus_events_ibfk_1`: (creator_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `canonical_media_assets`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `asset_id` | `varchar(128)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `provider` | `varchar(64)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `provider_media_id` | `varchar(128)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 4 | `media_url` | `varchar(1024)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 5 | `media_type` | `varchar(32)` | NO | `'''gif'''` | — | — | `utf8mb4_general_ci` |
| 6 | `metadata` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 7 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_canonical_provider` (provider, provider_media_id)
- `idx_canonical_url` (media_url)
- `PRIMARY` (asset_id)

**Constraints**: `metadata` (CHECK), `PRIMARY` (PRIMARY KEY)

---

## `capture_attempts`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `chat_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `owner_user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `actor_user_id` | `char(36)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `attempt_type` | `varchar(50)` | NO | — | — | — | `utf8mb4_general_ci` |
| 6 | `detection_method` | `varchar(50)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 7 | `device_info` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 8 | `metadata` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 9 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_capture_attempts_chat` (chat_id, created_at)
- `idx_capture_attempts_owner` (owner_user_id, created_at)
- `PRIMARY` (id)

**Constraints**: `device_info` (CHECK), `metadata` (CHECK), `PRIMARY` (PRIMARY KEY)

---

## `capture_audit_log`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `capture_attempt_id` | `char(36)` | NO | — | — | — | `utf8mb4_general_ci` |
| 3 | `actor_user_id` | `char(36)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `owner_user_id` | `char(36)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `chat_id` | `char(36)` | NO | — | — | — | `utf8mb4_general_ci` |
| 6 | `action` | `varchar(100)` | NO | — | — | — | `utf8mb4_general_ci` |
| 7 | `before_state` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 8 | `after_state` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 9 | `ip_address` | `varchar(45)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 10 | `user_agent` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 11 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (id)

**Constraints**: `after_state` (CHECK), `before_state` (CHECK), `PRIMARY` (PRIMARY KEY)

---

## `capture_notifications`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `recipient_user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `capture_attempt_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `is_read` | `tinyint(1)` | YES | `0` | — | — | — |
| 5 | `delivered_via_websocket` | `tinyint(1)` | YES | `0` | — | — | — |
| 6 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_cn_recipient` (recipient_user_id, created_at)
- `PRIMARY` (id)
- `unique_attempt_recipient` (capture_attempt_id, recipient_user_id)

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_attempt_recipient` (UNIQUE)

---

## `channel_messages`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `message_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `channel_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `sender_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `type` | `enum('text','image','video','voice_note','file','post_share','system','call','poll','event','sticker','gif')` | YES | `'text'` | — | — | `utf8mb4_general_ci` |
| 5 | `content` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `media_url` | `varchar(500)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 7 | `media_type` | `varchar(50)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 8 | `reply_to_id` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 9 | `is_pinned` | `tinyint(1)` | YES | `0` | — | — | — |
| 10 | `is_edited` | `tinyint(1)` | YES | `0` | — | — | — |
| 11 | `edited_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 12 | `is_deleted` | `tinyint(1)` | YES | `0` | — | — | — |
| 13 | `deleted_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 14 | `metadata` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 15 | `sent_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_channel_messages_channel` (channel_id, sent_at)
- `idx_channel_messages_pinned` (channel_id, is_pinned)
- `idx_channel_messages_sender` (sender_id, sent_at)
- `PRIMARY` (message_id)
- `reply_to_id` (reply_to_id)

**Foreign keys**
- `channel_messages_ibfk_1`: (channel_id) → `room_channels`.channel_id
- `channel_messages_ibfk_2`: (sender_id) → `users`.user_id
- `channel_messages_ibfk_3`: (reply_to_id) → `channel_messages`.message_id

**Constraints**: `metadata` (CHECK), `PRIMARY` (PRIMARY KEY)

---

## `channel_notification_settings`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `channel_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `level` | `enum('all','mentions','priority','muted')` | YES | `'all'` | — | — | `utf8mb4_general_ci` |

**Indexes**
- `PRIMARY` (id)
- `unique_channel_user_notif` (channel_id, user_id)
- `user_id` (user_id)

**Foreign keys**
- `channel_notification_settings_ibfk_1`: (channel_id) → `room_channels`.channel_id
- `channel_notification_settings_ibfk_2`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_channel_user_notif` (UNIQUE)

---

## `channel_permissions`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `permission_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `channel_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `role` | `enum('owner','admin','moderator','class_rep','lecturer','tutor','dept_admin','verified_staff','member')` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `can_send` | `tinyint(1)` | YES | `1` | — | — | — |
| 5 | `can_attach` | `tinyint(1)` | YES | `1` | — | — | — |
| 6 | `can_react` | `tinyint(1)` | YES | `1` | — | — | — |
| 7 | `can_pin` | `tinyint(1)` | YES | `0` | — | — | — |
| 8 | `can_manage` | `tinyint(1)` | YES | `0` | — | — | — |
| 9 | `can_invite` | `tinyint(1)` | YES | `0` | — | — | — |
| 10 | `can_mention_all` | `tinyint(1)` | YES | `0` | — | — | — |

**Indexes**
- `PRIMARY` (permission_id)
- `unique_channel_role` (channel_id, role)

**Foreign keys**
- `channel_permissions_ibfk_1`: (channel_id) → `room_channels`.channel_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_channel_role` (UNIQUE)

---

## `channel_read_state`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `channel_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `last_read_message_id` | `char(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 5 | `last_read_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 6 | `mention_count` | `int(11)` | YES | `0` | — | — | — |

**Indexes**
- `PRIMARY` (id)
- `unique_channel_read` (channel_id, user_id)
- `user_id` (user_id)

**Foreign keys**
- `channel_read_state_ibfk_1`: (channel_id) → `room_channels`.channel_id
- `channel_read_state_ibfk_2`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_channel_read` (UNIQUE)

---

## `chat_nicknames`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `varchar(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `chat_id` | `varchar(64)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `varchar(36)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `nickname` | `varchar(64)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `set_by_id` | `varchar(36)` | NO | — | — | — | `utf8mb4_general_ci` |
| 6 | `version` | `int(11)` | YES | `1` | — | — | — |
| 7 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 8 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `idx_chat_nicknames_chat` (chat_id)
- `PRIMARY` (id)
- `uq_chat_user_nick` (chat_id, user_id)

**Constraints**: `PRIMARY` (PRIMARY KEY), `uq_chat_user_nick` (UNIQUE)

---

## `chat_privacy_settings`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `varchar(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `chat_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `allow_forward` | `tinyint(1)` | YES | `1` | — | — | — |
| 5 | `allow_copy` | `tinyint(1)` | YES | `1` | — | — | — |
| 6 | `block_screenshot` | `tinyint(1)` | YES | `0` | — | — | — |
| 7 | `blur_screen_recording` | `tinyint(1)` | YES | `1` | — | — | — |
| 8 | `notify_screenshot_attempts` | `tinyint(1)` | YES | `1` | — | — | — |
| 9 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 10 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |
| 11 | `read_receipts_enabled` | `tinyint(1)` | YES | `1` | — | — | — |
| 12 | `privacy_version` | `int(11)` | YES | `1` | — | — | — |
| 13 | `typing_indicator_enabled` | `tinyint(1)` | YES | `1` | — | — | — |

**Indexes**
- `idx_chat_privacy_settings_lookup` (chat_id, user_id)
- `PRIMARY` (id)
- `unique_chat_user` (chat_id, user_id)

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_chat_user` (UNIQUE)

---

## `chat_rooms`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `varchar(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `name` | `varchar(100)` | NO | — | — | — | `utf8mb4_general_ci` |
| 3 | `avatarUrl` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 4 | `ownerId` | `varchar(36)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `createdAt` | `timestamp` | NO | `current_timestamp()` | — | — | — |
| 6 | `updatedAt` | `timestamp` | NO | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `PRIMARY` (id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `chat_room_members`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `chatRoomId` | `varchar(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `userId` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 3 | `role` | `enum('OWNER','ADMIN','MEMBER')` | NO | `'MEMBER'` | — | — | `utf8mb4_general_ci` |
| 4 | `joinedAt` | `timestamp` | NO | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_chatRoomId` (chatRoomId)
- `idx_userId` (userId)
- `PRIMARY` (chatRoomId, userId)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `chat_sequences`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `chat_id` | `varchar(128)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `last_sequence` | `bigint(20)` | NO | `0` | — | — | — |

**Indexes**
- `PRIMARY` (chat_id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `close_friends`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 2 | `friend_user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 4 | `id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 5 | `friend_id` | `char(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |

**Indexes**
- `idx_cf_friend` (friend_user_id)
- `idx_close_friends_owner` (user_id)
- `PRIMARY` (id)
- `unique_close_friend` (user_id, friend_id)

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_close_friend` (UNIQUE)

---

## `clubs`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `club_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `name` | `varchar(255)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `slug` | `varchar(255)` | NO | — | UNI | — | `utf8mb4_general_ci` |
| 4 | `description` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `category` | `varchar(100)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 6 | `campus` | `varchar(100)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 7 | `logo_url` | `varchar(500)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 8 | `banner_url` | `varchar(500)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 9 | `is_verified` | `tinyint(1)` | YES | `0` | — | — | — |
| 10 | `is_active` | `tinyint(1)` | YES | `1` | — | — | — |
| 11 | `admin_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 12 | `member_count` | `int(11)` | YES | `0` | — | — | — |
| 13 | `meeting_schedule` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 14 | `contact_email` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 15 | `social_links` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 16 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 17 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |
| 18 | `is_public` | `tinyint(1)` | YES | `1` | — | — | — |

**Indexes**
- `admin_id` (admin_id)
- `idx_clubs_campus` (campus, is_verified, created_at)
- `idx_clubs_category` (category, campus)
- `idx_clubs_search` (name, description)
- `idx_clubs_slug` (slug)
- `PRIMARY` (club_id)
- `slug` (slug)

**Foreign keys**
- `clubs_ibfk_1`: (admin_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `slug` (UNIQUE), `social_links` (CHECK)

---

## `club_announcements`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `announcement_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `club_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `content` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_ca_club` (club_id, created_at)
- `idx_ca_user` (user_id)
- `PRIMARY` (announcement_id)

**Foreign keys**
- `club_announcements_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `club_events`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `event_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `club_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `title` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `description` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `event_type` | `varchar(50)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `location` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 7 | `campus` | `varchar(100)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 8 | `start_time` | `timestamp` | NO | — | MUL | — | — |
| 9 | `end_time` | `timestamp` | NO | — | — | — | — |
| 10 | `image_url` | `varchar(500)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 11 | `max_attendees` | `int(11)` | YES | **'NULL' ← string!** | — | — | — |
| 12 | `is_public` | `tinyint(1)` | YES | `1` | — | — | — |
| 13 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 14 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `idx_club_events_campus` (campus, start_time)
- `idx_club_events_club` (club_id, start_time)
- `idx_club_events_upcoming` (start_time, is_public)
- `PRIMARY` (event_id)

**Foreign keys**
- `club_events_ibfk_1`: (club_id) → `clubs`.club_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `club_event_rsvps`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `rsvp_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `club_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `event_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 5 | `status` | `varchar(20)` | NO | `'going'` | — | — | `utf8mb4_general_ci` |
| 6 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_cer_event` (event_id)
- `idx_cer_user` (user_id)
- `PRIMARY` (rsvp_id)
- `unique_club_event_rsvp` (club_id, event_id, user_id)

**Foreign keys**
- `club_event_rsvps_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_club_event_rsvp` (UNIQUE)

---

## `club_event_updates`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `update_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `event_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `club_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `admin_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 5 | `content` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `media_url` | `varchar(500)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 7 | `media_type` | `enum('image','video','both')` | YES | `'image'` | — | — | `utf8mb4_general_ci` |
| 8 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `admin_id` (admin_id)
- `club_id` (club_id)
- `idx_event_updates` (event_id, created_at)
- `PRIMARY` (update_id)

**Foreign keys**
- `club_event_updates_ibfk_1`: (event_id) → `club_events`.event_id
- `club_event_updates_ibfk_2`: (club_id) → `clubs`.club_id
- `club_event_updates_ibfk_3`: (admin_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `club_members`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `membership_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `club_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `role` | `enum('member','moderator','admin')` | YES | `'member'` | — | — | `utf8mb4_general_ci` |
| 5 | `joined_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 6 | `invited_by` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 7 | `status` | `enum('active','pending','rejected','left')` | YES | `'active'` | — | — | `utf8mb4_general_ci` |

**Indexes**
- `idx_club_members_club` (club_id, role, joined_at)
- `idx_club_members_user` (user_id, joined_at)
- `invited_by` (invited_by)
- `PRIMARY` (membership_id)
- `unique_club_member` (club_id, user_id)

**Foreign keys**
- `club_members_ibfk_1`: (club_id) → `clubs`.club_id
- `club_members_ibfk_2`: (user_id) → `users`.user_id
- `club_members_ibfk_3`: (invited_by) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_club_member` (UNIQUE)

---

## `comments`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `comment_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `post_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `parent_comment_id` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 5 | `content` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 6 | `spark_count` | `int(11)` | YES | `0` | — | — | — |
| 7 | `is_edited` | `tinyint(1)` | YES | `0` | — | — | — |
| 8 | `edited_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 9 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 10 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |
| 11 | `like_count` | `int(11)` | YES | `0` | — | — | — |
| 12 | `is_seed` | `tinyint(1)` | YES | `0` | — | — | — |

**Indexes**
- `idx_comments_parent` (parent_comment_id)
- `idx_comments_post` (post_id, created_at)
- `idx_comments_user` (user_id, created_at)
- `PRIMARY` (comment_id)

**Foreign keys**
- `comments_ibfk_1`: (post_id) → `posts`.post_id
- `comments_ibfk_2`: (user_id) → `users`.user_id
- `comments_ibfk_3`: (parent_comment_id) → `comments`.comment_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `comment_likes`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `like_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `comment_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (like_id)
- `unique_comment_like` (comment_id, user_id)
- `user_id` (user_id)

**Foreign keys**
- `comment_likes_ibfk_1`: (comment_id) → `comments`.comment_id
- `comment_likes_ibfk_2`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_comment_like` (UNIQUE)

---

## `confessions`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `confession_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 3 | `content` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `campus` | `varchar(100)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 5 | `category` | `varchar(50)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `rating_count` | `int(11)` | YES | `0` | MUL | — | — |
| 7 | `comment_count` | `int(11)` | YES | `0` | — | — | — |
| 8 | `is_approved` | `tinyint(1)` | YES | `1` | — | — | — |
| 9 | `is_best_of_day` | `tinyint(1)` | YES | `0` | MUL | — | — |
| 10 | `is_best_of_week` | `tinyint(1)` | YES | `0` | — | — | — |
| 11 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 12 | `approved_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 13 | `heart_count` | `int(11)` | YES | `0` | — | — | — |
| 14 | `fire_count` | `int(11)` | YES | `0` | — | — | — |
| 15 | `smile_count` | `int(11)` | YES | `0` | — | — | — |
| 16 | `downvote_count` | `int(11)` | YES | `0` | — | — | — |
| 17 | `author_alias` | `varchar(50)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 18 | `image_url` | `varchar(500)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 19 | `discovery_score` | `float` | YES | `0` | — | — | — |
| 20 | `relate_count` | `int(11)` | YES | `0` | — | — | — |
| 21 | `support_count` | `int(11)` | YES | `0` | — | — | — |

**Indexes**
- `idx_confessions_best` (is_best_of_day, created_at)
- `idx_confessions_campus` (campus, created_at)
- `idx_confessions_popular` (rating_count, created_at)
- `PRIMARY` (confession_id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `confession_comments`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `comment_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `confession_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `parent_id` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 5 | `content` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 6 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 7 | `author_alias` | `varchar(50)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |

**Indexes**
- `confession_id` (confession_id)
- `parent_id` (parent_id)
- `PRIMARY` (comment_id)
- `user_id` (user_id)

**Foreign keys**
- `confession_comments_ibfk_1`: (confession_id) → `confessions`.confession_id
- `confession_comments_ibfk_2`: (user_id) → `users`.user_id
- `confession_comments_ibfk_3`: (parent_id) → `confession_comments`.comment_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `confession_reactions`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `reaction_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `confession_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `reaction_type` | `enum('upvote','downvote','heart','fire','smile','laugh','funny','relate','support')` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_confession_reactions_confession` (confession_id, created_at)
- `PRIMARY` (reaction_id)
- `unique_user_confession_reaction` (user_id, confession_id)

**Foreign keys**
- `confession_reactions_ibfk_1`: (confession_id) → `confessions`.confession_id
- `confession_reactions_ibfk_2`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_user_confession_reaction` (UNIQUE)

---

## `confession_reports`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `report_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `confession_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `reporter_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `reason` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `confession_id` (confession_id)
- `PRIMARY` (report_id)
- `unique_user_confession_report` (reporter_id, confession_id)

**Foreign keys**
- `confession_reports_ibfk_1`: (confession_id) → `confessions`.confession_id
- `confession_reports_ibfk_2`: (reporter_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_user_confession_report` (UNIQUE)

---

## `conversations`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `conversation_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 3 | `last_message_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `PRIMARY` (conversation_id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `data_export_jobs`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `job_id` | `varchar(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `varchar(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `categories` | `longtext` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `format` | `enum('pdf','xlsx','csv','json')` | NO | `'pdf'` | — | — | `utf8mb4_general_ci` |
| 5 | `delivery_email` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 6 | `is_alternate_email` | `tinyint(1)` | YES | `0` | — | — | — |
| 7 | `status` | `enum('REQUESTED','QUEUED','PROCESSING','READY','FAILED','EXPIRED','CANCELLED')` | NO | `'REQUESTED'` | MUL | — | `utf8mb4_general_ci` |
| 8 | `file_path` | `varchar(500)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 9 | `file_size_bytes` | `bigint(20)` | YES | **'NULL' ← string!** | — | — | — |
| 10 | `download_token` | `varchar(128)` | YES | **'NULL' ← string!** | UNI | — | `utf8mb4_general_ci` |
| 11 | `token_expires_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 12 | `failure_reason` | `varchar(500)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 13 | `download_count` | `int(11)` | YES | `0` | — | — | — |
| 14 | `created_at` | `timestamp` | NO | `current_timestamp()` | — | — | — |
| 15 | `completed_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |

**Indexes**
- `download_token` (download_token)
- `idx_export_status` (status, created_at)
- `idx_export_token` (download_token)
- `idx_export_user` (user_id, status)
- `PRIMARY` (job_id)

**Constraints**: `categories` (CHECK), `download_token` (UNIQUE), `PRIMARY` (PRIMARY KEY)

---

## `delivery_queue`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `queue_id` | `varchar(128)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `message_id` | `varchar(128)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `recipient_id` | `varchar(128)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `session_id` | `varchar(128)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `attempts` | `int(11)` | YES | `0` | MUL | — | — |
| 6 | `next_retry_at` | `datetime` | NO | `current_timestamp()` | MUL | — | — |
| 7 | `created_at` | `datetime` | NO | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_delivery_message` (message_id)
- `idx_delivery_recipient` (recipient_id, session_id)
- `idx_delivery_retry` (next_retry_at, attempts)
- `idx_dq_attempts_retry` (attempts, next_retry_at)
- `idx_dq_message_id` (message_id)
- `PRIMARY` (queue_id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `email_verifications`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `verification_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `email` | `varchar(255)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `code` | `varchar(10)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `expires_at` | `timestamp` | NO | — | — | — | — |
| 6 | `verified_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 7 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_ev_email_code` (email, code)
- `PRIMARY` (verification_id)
- `unique_user_email` (user_id, email)

**Foreign keys**
- `email_verifications_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_user_email` (UNIQUE)

---

## `event_rsvps`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `rsvp_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `event_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `event_type` | `enum('club_event','campus_event')` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `status` | `enum('going','not_going','attended','pending','accepted','rejected')` | YES | `'pending'` | — | — | `utf8mb4_general_ci` |
| 6 | `guests_count` | `int(11)` | YES | `0` | — | — | — |
| 7 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 8 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `idx_rsvps_event` (event_id, event_type, status)
- `idx_rsvps_user` (user_id, created_at)
- `PRIMARY` (rsvp_id)
- `unique_event_rsvp` (event_id, user_id, event_type)

**Foreign keys**
- `event_rsvps_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_event_rsvp` (UNIQUE)

---

## `fcm_tokens`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `token_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `token` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `device_type` | `enum('android','ios','web')` | YES | `'android'` | — | — | `utf8mb4_general_ci` |
| 5 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 6 | `last_used_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `idx_user_tokens` (user_id)
- `PRIMARY` (token_id)
- `unique_user_token` (user_id, token)

**Foreign keys**
- `fcm_tokens_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_user_token` (UNIQUE)

---

## `follows`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `follower_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `following_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 3 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 4 | `muted` | `tinyint(1)` | YES | `0` | — | — | — |

**Indexes**
- `idx_follows_follower` (follower_id, created_at)
- `idx_follows_following` (following_id, created_at)
- `PRIMARY` (follower_id, following_id)

**Foreign keys**
- `follows_ibfk_1`: (follower_id) → `users`.user_id
- `follows_ibfk_2`: (following_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `follow_requests`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `requester_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `target_user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `status` | `enum('pending','accepted','rejected','cancelled')` | YES | `'pending'` | — | — | `utf8mb4_general_ci` |
| 5 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 6 | `updated_at` | `timestamp` | YES | **'NULL' ← string!** | — | on update current_timestamp() | — |

**Indexes**
- `PRIMARY` (id)
- `target_user_id` (target_user_id)
- `unique_request` (requester_id, target_user_id)

**Foreign keys**
- `follow_requests_ibfk_1`: (requester_id) → `users`.user_id
- `follow_requests_ibfk_2`: (target_user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_request` (UNIQUE)

---

## `groups`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `group_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `name` | `varchar(255)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `description` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 4 | `category` | `varchar(100)` | YES | `'general'` | — | — | `utf8mb4_general_ci` |
| 5 | `icon_url` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `cover_image` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 7 | `campus` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 8 | `is_public` | `tinyint(1)` | YES | `1` | — | — | — |
| 9 | `requires_approval` | `tinyint(1)` | YES | `0` | — | — | — |
| 10 | `creator_id` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 11 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 12 | `allow_posts` | `tinyint(1)` | YES | `1` | — | — | — |
| 13 | `require_post_approval` | `tinyint(1)` | YES | `0` | — | — | — |
| 14 | `who_can_post` | `enum('anyone','admins')` | YES | `'anyone'` | — | — | `utf8mb4_general_ci` |
| 15 | `who_can_invite` | `enum('anyone','admins')` | YES | `'anyone'` | — | — | `utf8mb4_general_ci` |
| 16 | `privacy_settings` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |

**Indexes**
- `creator_id` (creator_id)
- `idx_groups_search` (name, description)
- `PRIMARY` (group_id)

**Foreign keys**
- `groups_ibfk_1`: (creator_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `privacy_settings` (CHECK)

---

## `group_channels`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `channel_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `chat_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `name` | `varchar(80)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `type` | `enum('TEXT','VOICE','ANNOUNCEMENT','MEDIA','POLL')` | NO | `'TEXT'` | — | — | `utf8mb4_general_ci` |
| 5 | `icon` | `varchar(32)` | NO | `'?'` | — | — | `utf8mb4_general_ci` |
| 6 | `position` | `int(11)` | NO | `0` | — | — | — |
| 7 | `created_by` | `char(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 8 | `is_default` | `tinyint(1)` | NO | `0` | — | — | — |
| 9 | `is_read_only` | `tinyint(1)` | NO | `0` | — | — | — |
| 10 | `is_archived` | `tinyint(1)` | NO | `0` | — | — | — |
| 11 | `created_at` | `datetime` | NO | `current_timestamp()` | — | — | — |
| 12 | `updated_at` | `datetime` | NO | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `idx_gc_archived` (chat_id, is_archived)
- `idx_gc_chat_id` (chat_id)
- `idx_gc_position` (chat_id, position)
- `PRIMARY` (channel_id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `group_chats`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `chat_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `creator_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `name` | `varchar(100)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 4 | `photo_url` | `varchar(500)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 5 | `privacy` | `enum('open','locked')` | YES | `'open'` | — | — | `utf8mb4_general_ci` |
| 6 | `is_private` | `tinyint(1)` | YES | `1` | — | — | — |
| 7 | `approval_required` | `tinyint(1)` | YES | `0` | — | — | — |
| 8 | `allow_media` | `tinyint(1)` | YES | `1` | — | — | — |
| 9 | `allow_voice_notes` | `tinyint(1)` | YES | `1` | — | — | — |
| 10 | `allow_video_calls` | `tinyint(1)` | YES | `1` | — | — | — |
| 11 | `allow_reactions` | `tinyint(1)` | YES | `1` | — | — | — |
| 12 | `allow_message_sharing` | `tinyint(1)` | YES | `1` | — | — | — |
| 13 | `last_message_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 14 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 15 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |
| 16 | `disappearing_duration` | `int(11)` | YES | `0` | — | — | — |
| 17 | `pin_locked` | `tinyint(1)` | YES | `0` | — | — | — |
| 18 | `group_pin` | `varchar(20)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 19 | `only_admins_send` | `tinyint(1)` | YES | `0` | — | — | — |
| 20 | `edit_info` | `enum('admins','members')` | YES | `'admins'` | — | — | `utf8mb4_general_ci` |
| 21 | `description` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 22 | `only_admins_edit` | `tinyint(1)` | YES | `0` | — | — | — |
| 23 | `privacy_settings` | `longtext` | NO | `'{"allowForward":true,"allowCopy":true,"blockScreenshots":false,"blurScreenRecording":true,"notifyScreenshotAttempts":true}'` | — | — | **`utf8mb4_bin`** |
| 24 | `disappearing_version` | `int(11)` | YES | `1` | — | — | — |
| 25 | `disappearing_updated_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 26 | `disappearing_updated_by` | `varchar(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |

**Indexes**
- `idx_group_chats_creator` (creator_id)
- `PRIMARY` (chat_id)

**Foreign keys**
- `group_chats_ibfk_1`: (creator_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `privacy_settings` (CHECK)

---

## `group_chat_members`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `membership_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `chat_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `role` | `enum('member','admin','creator')` | YES | `'member'` | — | — | `utf8mb4_general_ci` |
| 5 | `status` | `enum('active','muted','left','removed','pending')` | YES | `'active'` | — | — | `utf8mb4_general_ci` |
| 6 | `nickname` | `varchar(50)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 7 | `joined_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 8 | `last_seen` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_chat_members_user` (user_id, joined_at)
- `PRIMARY` (membership_id)
- `unique_chat_member` (chat_id, user_id)

**Foreign keys**
- `group_chat_members_ibfk_1`: (chat_id) → `group_chats`.chat_id
- `group_chat_members_ibfk_2`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_chat_member` (UNIQUE)

---

## `group_members`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `int(11)` | NO | — | PRI | auto_increment | — |
| 2 | `group_id` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 4 | `role` | `enum('admin','moderator','member')` | YES | `'member'` | — | — | `utf8mb4_general_ci` |
| 5 | `status` | `enum('active','pending','banned')` | YES | `'active'` | — | — | `utf8mb4_general_ci` |
| 6 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 7 | `muted` | `tinyint(1)` | YES | `0` | — | — | — |
| 8 | `banned` | `tinyint(1)` | YES | `0` | — | — | — |

**Indexes**
- `group_user` (group_id, user_id)
- `PRIMARY` (id)
- `user_id` (user_id)

**Foreign keys**
- `group_members_ibfk_1`: (group_id) → `groups`.group_id
- `group_members_ibfk_2`: (user_id) → `users`.user_id

**Constraints**: `group_user` (UNIQUE), `PRIMARY` (PRIMARY KEY)

---

## `group_posts`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `post_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `group_id` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 4 | `content` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `image_url` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `video_url` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 7 | `created_at` | `timestamp` | YES | `current_timestamp()` | MUL | — | — |

**Indexes**
- `idx_gp_created` (created_at)
- `idx_gp_group` (group_id)
- `PRIMARY` (post_id)
- `user_id` (user_id)

**Foreign keys**
- `group_posts_ibfk_1`: (group_id) → `groups`.group_id
- `group_posts_ibfk_2`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `group_post_comments`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `comment_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `post_id` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 4 | `content` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `post_id` (post_id)
- `PRIMARY` (comment_id)
- `user_id` (user_id)

**Foreign keys**
- `group_post_comments_ibfk_1`: (post_id) → `group_posts`.post_id
- `group_post_comments_ibfk_2`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `group_post_likes`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `post_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 3 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (post_id, user_id)
- `user_id` (user_id)

**Foreign keys**
- `group_post_likes_ibfk_1`: (post_id) → `group_posts`.post_id
- `group_post_likes_ibfk_2`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `group_requests`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `int(11)` | NO | — | PRI | auto_increment | — |
| 2 | `group_id` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 4 | `status` | `enum('pending','approved','rejected')` | YES | `'pending'` | — | — | `utf8mb4_general_ci` |
| 5 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (id)
- `req_user` (group_id, user_id)
- `user_id` (user_id)

**Foreign keys**
- `group_requests_ibfk_1`: (group_id) → `groups`.group_id
- `group_requests_ibfk_2`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `req_user` (UNIQUE)

---

## `hashtags`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `tag_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `name` | `varchar(100)` | NO | — | UNI | — | `utf8mb4_general_ci` |
| 3 | `post_count` | `int(11)` | YES | `0` | — | — | — |
| 4 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `name` (name)
- `PRIMARY` (tag_id)

**Constraints**: `name` (UNIQUE), `PRIMARY` (PRIMARY KEY)

---

## `highlights`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `highlight_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `title` | `varchar(100)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `cover_url` | `varchar(500)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 5 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_highlights_user` (user_id, created_at)
- `PRIMARY` (highlight_id)

**Foreign keys**
- `highlights_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `highlight_stories`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `highlight_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `story_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `position` | `int(11)` | YES | `0` | — | — | — |
| 5 | `added_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_highlight_stories` (highlight_id, position)
- `PRIMARY` (id)
- `story_id` (story_id)
- `unique_highlight_story` (highlight_id, story_id)

**Foreign keys**
- `highlight_stories_ibfk_1`: (highlight_id) → `highlights`.highlight_id
- `highlight_stories_ibfk_2`: (story_id) → `stories`.story_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_highlight_story` (UNIQUE)

---

## `interaction_events`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `event_id` | `varchar(128)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `chat_id` | `varchar(128)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `message_id` | `varchar(128)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `event_type` | `varchar(64)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `payload` | `longtext` | NO | — | — | — | **`utf8mb4_bin`** |
| 6 | `sequence_no` | `bigint(20)` | NO | — | — | — | — |
| 7 | `created_at` | `datetime` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_chat_seq` (chat_id, sequence_no)
- `PRIMARY` (event_id)

**Constraints**: `payload` (CHECK), `PRIMARY` (PRIMARY KEY)

---

## `listing_media`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `media_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `listing_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `media_url` | `varchar(500)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `media_type` | `enum('image','video')` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `upload_order` | `int(11)` | YES | `0` | — | — | — |
| 6 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `listing_id` (listing_id)
- `PRIMARY` (media_id)

**Foreign keys**
- `listing_media_ibfk_1`: (listing_id) → `marketplace_listings`.listing_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `listing_reports`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `report_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `listing_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `reporter_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `reason` | `enum('spam','inappropriate','scam','misleading','duplicate','other')` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `details` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `status` | `enum('pending','reviewed','resolved','dismissed')` | YES | `'pending'` | MUL | — | `utf8mb4_general_ci` |
| 7 | `reviewed_by` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 8 | `reviewed_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 9 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_listing` (listing_id)
- `idx_reporter` (reporter_id)
- `idx_status` (status, created_at)
- `PRIMARY` (report_id)
- `reviewed_by` (reviewed_by)

**Foreign keys**
- `listing_reports_ibfk_1`: (listing_id) → `marketplace_listings`.listing_id
- `listing_reports_ibfk_2`: (reporter_id) → `users`.user_id
- `listing_reports_ibfk_3`: (reviewed_by) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `listing_tags`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `listing_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `tag_name` | `varchar(50)` | NO | — | PRI | — | `utf8mb4_general_ci` |

**Indexes**
- `PRIMARY` (listing_id, tag_name)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `live_location_sessions`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `live_location_id` | `varchar(64)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `message_id` | `varchar(64)` | NO | — | — | — | `utf8mb4_general_ci` |
| 3 | `chat_id` | `varchar(64)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `user_id` | `varchar(64)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 5 | `latitude` | `double` | NO | — | — | — | — |
| 6 | `longitude` | `double` | NO | — | — | — | — |
| 7 | `accuracy` | `float` | YES | `0` | — | — | — |
| 8 | `heading` | `float` | YES | `0` | — | — | — |
| 9 | `speed` | `float` | YES | `0` | — | — | — |
| 10 | `started_at` | `datetime` | YES | `current_timestamp()` | — | — | — |
| 11 | `expires_at` | `datetime` | YES | **'NULL' ← string!** | — | — | — |
| 12 | `duration` | `varchar(20)` | YES | `'''1h'''` | — | — | `utf8mb4_general_ci` |
| 13 | `is_active` | `tinyint(1)` | YES | `1` | — | — | — |
| 14 | `comment` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 15 | `updated_at` | `datetime` | YES | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `idx_chat_active` (chat_id, is_active)
- `idx_user_active` (user_id, is_active)
- `PRIMARY` (live_location_id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `live_streams`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `stream_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `streamer_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `title` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `description` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 5 | `campus` | `varchar(100)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 6 | `category` | `varchar(50)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 7 | `stream_url` | `varchar(500)` | NO | — | — | — | `utf8mb4_general_ci` |
| 8 | `thumbnail_url` | `varchar(500)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 9 | `viewer_count` | `int(11)` | YES | `0` | — | — | — |
| 10 | `status` | `enum('live','ended','scheduled')` | YES | `'live'` | MUL | — | `utf8mb4_general_ci` |
| 11 | `started_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 12 | `ended_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |

**Indexes**
- `idx_live_streams_campus` (campus, status)
- `idx_live_streams_status` (status, started_at)
- `idx_live_streams_streamer` (streamer_id, started_at)
- `PRIMARY` (stream_id)

**Foreign keys**
- `live_streams_ibfk_1`: (streamer_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `login_activity`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `activity_id` | `varchar(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `varchar(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `device_id` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `ip_address` | `varchar(45)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 5 | `user_agent` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `is_verified` | `tinyint(1)` | YES | `0` | — | — | — |
| 7 | `last_active` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |
| 8 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 9 | `location` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |

**Indexes**
- `PRIMARY` (activity_id)
- `unique_user_device` (user_id, device_id)
- `user_id` (user_id)

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_user_device` (UNIQUE)

---

## `login_attempts`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `attempt_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 3 | `login_id` | `varchar(255)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `ip_address` | `varchar(45)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 5 | `attempt_time` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 6 | `is_successful` | `tinyint(1)` | YES | `0` | — | — | — |

**Indexes**
- `idx_login_attempts_id_time` (login_id, attempt_time)
- `idx_login_attempts_ip_time` (ip_address, attempt_time)
- `PRIMARY` (attempt_id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `lost_found_items`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `item_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `reporter_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `type` | `enum('lost','found')` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `title` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `description` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 6 | `category` | `varchar(50)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 7 | `campus` | `varchar(100)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 8 | `location` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 9 | `date_lost_found` | `date` | YES | **'NULL' ← string!** | — | — | — |
| 10 | `image_url` | `varchar(500)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 11 | `status` | `enum('open','claimed','closed')` | YES | `'open'` | — | — | `utf8mb4_general_ci` |
| 12 | `claimed_by` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 13 | `claimed_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 14 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 15 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |
| 16 | `contact_info` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |

**Indexes**
- `claimed_by` (claimed_by)
- `idx_lost_found_campus` (campus, status, created_at)
- `idx_lost_found_reporter` (reporter_id, created_at)
- `idx_lost_found_type` (type, status, created_at)
- `PRIMARY` (item_id)

**Foreign keys**
- `lost_found_items_ibfk_1`: (reporter_id) → `users`.user_id
- `lost_found_items_ibfk_2`: (claimed_by) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `lost_found_media`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `media_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `item_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `media_url` | `varchar(500)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `media_type` | `enum('image','video')` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `upload_order` | `int(11)` | YES | `0` | — | — | — |
| 6 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `item_id` (item_id)
- `PRIMARY` (media_id)

**Foreign keys**
- `lost_found_media_ibfk_1`: (item_id) → `lost_found_items`.item_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `marketplace_blocks`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `block_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `blocker_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `blocked_id` | `char(36)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `reason` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 5 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (block_id)
- `unique_block` (blocker_id, blocked_id)

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_block` (UNIQUE)

---

## `marketplace_conversations`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `varchar(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `buyer_id` | `varchar(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 3 | `seller_id` | `varchar(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 4 | `listing_id` | `varchar(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 5 | `last_message` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `last_activity_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 7 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 8 | `reminder_sent` | `tinyint(1)` | YES | `0` | — | — | — |
| 9 | `is_muted` | `tinyint(1)` | YES | `0` | — | — | — |
| 10 | `is_archived` | `tinyint(1)` | YES | `0` | — | — | — |
| 11 | `is_pinned` | `tinyint(1)` | YES | `0` | — | — | — |

**Indexes**
- `PRIMARY` (id)
- `unique_conversation` (buyer_id, seller_id, listing_id)

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_conversation` (UNIQUE)

---

## `marketplace_favorites`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `favorite_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `listing_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `listing_id` (listing_id)
- `PRIMARY` (favorite_id)
- `user_id` (user_id)

**Foreign keys**
- `marketplace_favorites_ibfk_1`: (user_id) → `users`.user_id
- `marketplace_favorites_ibfk_2`: (listing_id) → `marketplace_listings`.listing_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `marketplace_favorite_sellers`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `favorite_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `seller_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_seller` (seller_id)
- `idx_user` (user_id)
- `PRIMARY` (favorite_id)
- `unique_user_seller` (user_id, seller_id)

**Foreign keys**
- `marketplace_favorite_sellers_ibfk_1`: (user_id) → `users`.user_id
- `marketplace_favorite_sellers_ibfk_2`: (seller_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_user_seller` (UNIQUE)

---

## `marketplace_listings`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `listing_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `seller_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `title` | `varchar(255)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `description` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `price` | `decimal(10,2)` | NO | — | — | — | — |
| 6 | `category` | `varchar(50)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 7 | `condition` | `enum('new','like_new','good','fair','poor')` | YES | `'good'` | — | — | `utf8mb4_general_ci` |
| 8 | `campus` | `varchar(100)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 9 | `location` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 10 | `image_url` | `varchar(500)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 11 | `is_sold` | `tinyint(1)` | YES | `0` | — | — | — |
| 12 | `is_featured` | `tinyint(1)` | YES | `0` | — | — | — |
| 13 | `sold_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 14 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 15 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |
| 16 | `is_negotiable` | `tinyint(1)` | YES | `0` | — | — | — |
| 17 | `meet_up_location` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 18 | `expires_at` | `timestamp` | YES | `(current_timestamp() + interval 30 day)` | — | — | — |
| 19 | `boost_count` | `int(11)` | YES | `0` | — | — | — |
| 20 | `last_boosted_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 21 | `is_promoted` | `tinyint(1)` | YES | `0` | — | — | — |
| 22 | `promotion_expires_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 23 | `priority_score` | `int(11)` | YES | `0` | — | — | — |
| 24 | `average_rating` | `decimal(3,2)` | YES | `0.00` | — | — | — |
| 25 | `status` | `enum('active','sold','pending','deleted')` | YES | `'active'` | MUL | — | `utf8mb4_general_ci` |
| 26 | `view_count` | `int(11)` | YES | `0` | — | — | — |
| 27 | `likes_count` | `int(11)` | YES | `0` | — | — | — |
| 28 | `shares_count` | `int(11)` | YES | `0` | — | — | — |
| 29 | `tags` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 30 | `latitude` | `decimal(10,8)` | YES | `-1.29210000` | — | — | — |
| 31 | `longitude` | `decimal(11,8)` | YES | `36.82190000` | — | — | — |
| 32 | `share_count` | `int(11)` | NO | `0` | — | — | — |

**Indexes**
- `idx_listings_search` (title, description)
- `idx_marketplace_campus` (campus, is_sold, created_at)
- `idx_marketplace_category` (category, is_sold)
- `idx_marketplace_seller` (seller_id, created_at)
- `idx_marketplace_status_sold` (status, is_sold, created_at)
- `PRIMARY` (listing_id)

**Foreign keys**
- `marketplace_listings_ibfk_1`: (seller_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `tags` (CHECK)

---

## `marketplace_messages`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `varchar(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `conversation_id` | `varchar(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `sender_id` | `varchar(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 4 | `message_text` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 5 | `message_type` | `enum('text','image','video','offer','system')` | YES | `'text'` | — | — | `utf8mb4_general_ci` |
| 6 | `media_url` | `varchar(500)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 7 | `reply_to_id` | `varchar(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 8 | `is_edited` | `tinyint(1)` | YES | `0` | — | — | — |
| 9 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `conversation_id` (conversation_id)
- `PRIMARY` (id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `marketplace_message_reactions`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `reaction_id` | `varchar(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `message_id` | `varchar(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `varchar(36)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `emoji` | `varchar(64)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 5 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (reaction_id)
- `unique_reaction` (message_id, user_id)

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_reaction` (UNIQUE)

---

## `marketplace_message_settings`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `user_id` | `varchar(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `who_can_message_me` | `enum('everyone','vouched_only','none')` | YES | `'everyone'` | — | — | `utf8mb4_general_ci` |
| 3 | `message_filter` | `tinyint(1)` | YES | `1` | — | — | — |
| 4 | `read_receipts` | `tinyint(1)` | YES | `1` | — | — | — |
| 5 | `typing_indicators` | `tinyint(1)` | YES | `1` | — | — | — |
| 6 | `show_online_status` | `tinyint(1)` | YES | `1` | — | — | — |
| 7 | `auto_reply_enabled` | `tinyint(1)` | YES | `0` | — | — | — |
| 8 | `auto_reply_text` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 9 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `PRIMARY` (user_id)

**Foreign keys**
- `marketplace_message_settings_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `marketplace_message_status`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `message_id` | `varchar(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `delivered_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 3 | `read_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |

**Indexes**
- `PRIMARY` (message_id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `marketplace_orders`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `order_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `buyer_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `seller_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `listing_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 5 | `status` | `enum('pending','accepted','completed','cancelled')` | YES | `'pending'` | — | — | `utf8mb4_general_ci` |
| 6 | `price` | `decimal(10,2)` | YES | **'NULL' ← string!** | — | — | — |
| 7 | `order_details` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 8 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 9 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |
| 10 | `currency` | `varchar(10)` | YES | `'KES'` | — | — | `utf8mb4_general_ci` |
| 11 | `item_condition` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 12 | `agreed_price` | `decimal(12,2)` | YES | **'NULL' ← string!** | — | — | — |
| 13 | `campus` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 14 | `location_description` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 15 | `scheduled_time` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 16 | `accepted_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 17 | `rejected_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 18 | `cancelled_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 19 | `completed_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 20 | `disputed_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 21 | `last_action_by` | `char(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 22 | `last_action_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 23 | `listing_title` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 24 | `listing_description` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 25 | `price_at_time` | `decimal(10,2)` | YES | **'NULL' ← string!** | — | — | — |
| 26 | `cancelled_by` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 27 | `cancellation_reason` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 28 | `meetup_confirmed_by_buyer` | `tinyint(1)` | YES | `0` | — | — | — |
| 29 | `meetup_confirmed_by_seller` | `tinyint(1)` | YES | `0` | — | — | — |

**Indexes**
- `fk_mo_cancelled_by` (cancelled_by)
- `idx_buyer` (buyer_id)
- `idx_listing` (listing_id)
- `idx_seller` (seller_id)
- `PRIMARY` (order_id)

**Foreign keys**
- `fk_mo_cancelled_by`: (cancelled_by) → `users`.user_id
- `marketplace_orders_ibfk_1`: (buyer_id) → `users`.user_id
- `marketplace_orders_ibfk_2`: (seller_id) → `users`.user_id
- `marketplace_orders_ibfk_3`: (listing_id) → `marketplace_listings`.listing_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `marketplace_payout_settings`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `payout_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `provider` | `enum('mpesa','bank','wallet')` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `account_number` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `account_name` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 6 | `is_default` | `tinyint(1)` | YES | `0` | — | — | — |
| 7 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 8 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `PRIMARY` (payout_id)
- `user_id` (user_id)

**Foreign keys**
- `marketplace_payout_settings_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `marketplace_reviews`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `review_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `listing_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `reviewer_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `reviewee_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 5 | `rating` | `tinyint(4)` | NO | — | MUL | — | — |
| 6 | `comment` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 7 | `transaction_type` | `enum('buyer','seller')` | NO | — | — | — | `utf8mb4_general_ci` |
| 8 | `is_anonymous` | `tinyint(1)` | YES | `0` | — | — | — |
| 9 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_rating` (rating)
- `idx_reviewee` (reviewee_id, created_at)
- `PRIMARY` (review_id)
- `reviewer_id` (reviewer_id)
- `unique_review` (listing_id, reviewer_id)

**Foreign keys**
- `marketplace_reviews_ibfk_1`: (listing_id) → `marketplace_listings`.listing_id
- `marketplace_reviews_ibfk_2`: (reviewer_id) → `users`.user_id
- `marketplace_reviews_ibfk_3`: (reviewee_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_review` (UNIQUE)

---

## `marketplace_seller_alerts`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `alert_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `seller_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `is_active` | `tinyint(1)` | YES | `1` | — | — | — |
| 5 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 6 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `PRIMARY` (alert_id)
- `seller_id` (seller_id)
- `unique_user_seller_alert` (user_id, seller_id)

**Foreign keys**
- `marketplace_seller_alerts_ibfk_1`: (user_id) → `users`.user_id
- `marketplace_seller_alerts_ibfk_2`: (seller_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_user_seller_alert` (UNIQUE)

---

## `marketplace_seller_favorites`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `seller_id` | `char(36)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (id)
- `unique_seller_fav` (user_id, seller_id)

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_seller_fav` (UNIQUE)

---

## `marketplace_seller_settings`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `user_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `profile_visibility` | `enum('public','private','verified_only')` | YES | `'public'` | — | — | `utf8mb4_general_ci` |
| 3 | `message_permissions` | `enum('everyone','verified_only')` | YES | `'everyone'` | — | — | `utf8mb4_general_ci` |
| 4 | `notifications_messages` | `tinyint(1)` | YES | `1` | — | — | — |
| 5 | `notifications_offers` | `tinyint(1)` | YES | `1` | — | — | — |
| 6 | `notifications_marketing` | `tinyint(1)` | YES | `0` | — | — | — |
| 7 | `auto_reply_enabled` | `tinyint(1)` | YES | `0` | — | — | — |
| 8 | `auto_reply_text` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 9 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 10 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `PRIMARY` (user_id)

**Foreign keys**
- `marketplace_seller_settings_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `marketplace_user_blocks`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `block_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `blocker_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `blocked_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `reason` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 5 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_blocked` (blocked_id)
- `idx_blocker` (blocker_id)
- `PRIMARY` (block_id)
- `unique_block` (blocker_id, blocked_id)

**Foreign keys**
- `marketplace_user_blocks_ibfk_1`: (blocker_id) → `users`.user_id
- `marketplace_user_blocks_ibfk_2`: (blocked_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_block` (UNIQUE)

---

## `marketplace_verifications`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `verification_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `id_front_url` | `varchar(512)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `id_back_url` | `varchar(512)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 5 | `selfie_url` | `varchar(512)` | NO | — | — | — | `utf8mb4_general_ci` |
| 6 | `match_score` | `decimal(4,3)` | YES | **'NULL' ← string!** | — | — | — |
| 7 | `status` | `enum('pending','verified','rejected','manual_review')` | YES | `'pending'` | — | — | `utf8mb4_general_ci` |
| 8 | `rejection_reason` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 9 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 10 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `PRIMARY` (verification_id)
- `user_id` (user_id)

**Foreign keys**
- `marketplace_verifications_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `marketplace_wishlist`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `wishlist_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `listing_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `listing_id` (listing_id)
- `PRIMARY` (wishlist_id)
- `unique_wishlist` (user_id, listing_id)

**Foreign keys**
- `marketplace_wishlist_ibfk_1`: (user_id) → `users`.user_id
- `marketplace_wishlist_ibfk_2`: (listing_id) → `marketplace_listings`.listing_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_wishlist` (UNIQUE)

---

## `media_deliveries`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `int(11)` | NO | — | PRI | auto_increment | — |
| 2 | `media_id` | `varchar(128)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `recipient_id` | `varchar(128)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `download_status` | `enum('PENDING','DOWNLOADED')` | YES | `'PENDING'` | — | — | `utf8mb4_general_ci` |
| 5 | `downloaded_at` | `datetime` | YES | **'NULL' ← string!** | — | — | — |

**Indexes**
- `PRIMARY` (id)
- `uk_media_recipient` (media_id, recipient_id)

**Foreign keys**
- `media_deliveries_ibfk_1`: (media_id) → `media_objects`.media_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `uk_media_recipient` (UNIQUE)

---

## `media_health_checks`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `url_hash` | `char(64)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `table_name` | `varchar(64)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `column_name` | `varchar(64)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `row_id` | `varchar(64)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `url` | `varchar(1000)` | NO | — | — | — | `utf8mb4_general_ci` |
| 6 | `fail_count` | `int(11)` | NO | `0` | — | — | — |
| 7 | `last_status` | `int(11)` | YES | **'NULL' ← string!** | — | — | — |
| 8 | `status` | `varchar(16)` | NO | `'ok'` | MUL | — | `utf8mb4_general_ci` |
| 9 | `last_checked_at` | `timestamp` | NO | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `idx_status` (status)
- `idx_table` (table_name)
- `PRIMARY` (url_hash)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `media_objects`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `media_id` | `varchar(128)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `chat_id` | `varchar(128)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `uploader_id` | `varchar(128)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `mime_type` | `varchar(128)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `size_bytes` | `bigint(20)` | NO | — | — | — | — |
| 6 | `sha256_hash` | `varchar(128)` | NO | — | — | — | `utf8mb4_general_ci` |
| 7 | `encryption_iv` | `varchar(128)` | NO | — | — | — | `utf8mb4_general_ci` |
| 8 | `thumbnail_blurhash` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 9 | `status` | `enum('UPLOADING','AVAILABLE','DELIVERED','DOWNLOADED','EXPIRED','DELETED')` | YES | `'UPLOADING'` | MUL | — | `utf8mb4_general_ci` |
| 10 | `expires_at` | `datetime` | NO | — | — | — | — |
| 11 | `created_at` | `datetime` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_chat_media` (chat_id)
- `idx_media_status_expiry` (status, expires_at)
- `PRIMARY` (media_id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `media_registry`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `media_id` | `varchar(64)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `owner_id` | `varchar(64)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `category` | `enum('story','post','reel','confession','profile','message','temporary','system')` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `cloudinary_public_id` | `varchar(255)` | NO | — | UNI | — | `utf8mb4_general_ci` |
| 5 | `secure_url` | `varchar(512)` | NO | — | — | — | `utf8mb4_general_ci` |
| 6 | `thumbnail_url` | `varchar(512)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 7 | `lifecycle_state` | `enum('active','expiring_soon','expired','archived','protected','reusable','pending_cleanup')` | YES | `'active'` | MUL | — | `utf8mb4_general_ci` |
| 8 | `expires_at` | `datetime` | YES | **'NULL' ← string!** | — | — | — |
| 9 | `is_reusable` | `tinyint(1)` | YES | `0` | — | — | — |
| 10 | `referenced_by_features` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 11 | `local_template_path` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 12 | `cleanup_priority` | `enum('SAFE_TO_DELETE','IN_USE','PROTECTED','ARCHIVED_ONLY','TEMP_ONLY')` | YES | `'IN_USE'` | — | — | `utf8mb4_general_ci` |
| 13 | `hash_checksum` | `varchar(128)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 14 | `file_size_bytes` | `int(11)` | NO | `0` | — | — | — |
| 15 | `last_accessed_at` | `datetime` | YES | **'NULL' ← string!** | — | — | — |
| 16 | `created_at` | `datetime` | YES | `current_timestamp()` | — | — | — |
| 17 | `updated_at` | `datetime` | YES | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `cloudinary_public_id` (cloudinary_public_id)
- `idx_category` (category)
- `idx_lifecycle` (lifecycle_state)
- `idx_owner` (owner_id)
- `PRIMARY` (media_id)

**Constraints**: `cloudinary_public_id` (UNIQUE), `PRIMARY` (PRIMARY KEY), `referenced_by_features` (CHECK)

---

## `messages`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `message_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `chat_id` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 3 | `personal_chat_id` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 4 | `conversation_id` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 5 | `chat_session_id` | `varchar(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `sender_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 7 | `club_id` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 8 | `recipient_id` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 9 | `type` | `enum('text','image','video','voice_note','audio','document','location','contact','attachment','post_share','system','call','marketplace_listing','story_reply')` | YES | `'text'` | — | — | `utf8mb4_general_ci` |
| 10 | `context` | `enum('chat','marketplace')` | YES | `'chat'` | — | — | `utf8mb4_general_ci` |
| 11 | `message_category` | `enum('announcement','feature','security','welcome','tips','promotion','maintenance','warning')` | YES | `'announcement'` | — | — | `utf8mb4_general_ci` |
| 12 | `content` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 13 | `media_url` | `varchar(500)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 14 | `is_anonymous` | `tinyint(1)` | YES | `0` | — | — | — |
| 15 | `sent_at` | `timestamp` | YES | `current_timestamp()` | MUL | — | — |
| 16 | `publish_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 17 | `expires_at` | `timestamp` | YES | **'NULL' ← string!** | MUL | — | — |
| 18 | `payload` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 19 | `read_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 20 | `status` | `enum('sent','delivered','read')` | YES | `'sent'` | MUL | — | `utf8mb4_general_ci` |
| 21 | `reply_to_message_id` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 22 | `edited_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 23 | `is_deleted_for_everyone` | `tinyint(1)` | YES | `0` | — | — | — |
| 24 | `marketplace_listing_id` | `char(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 25 | `view_policy` | `enum('once','twice','unlimited')` | YES | `'unlimited'` | — | — | `utf8mb4_general_ci` |
| 26 | `views_used` | `int(11)` | YES | `0` | — | — | — |
| 27 | `views_allowed` | `int(11)` | YES | `1` | — | — | — |
| 28 | `delivered` | `tinyint(1)` | YES | `0` | — | — | — |
| 29 | `delivered_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 30 | `is_read` | `tinyint(1)` | YES | `0` | — | — | — |
| 31 | `story_id` | `char(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 32 | `pinned` | `tinyint(1)` | YES | `0` | — | — | — |
| 33 | `pinned_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 34 | `pinned_by` | `char(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 35 | `edited` | `tinyint(1)` | YES | `0` | — | — | — |
| 36 | `deleted_for` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 37 | `forwarded` | `tinyint(1)` | YES | `0` | — | — | — |
| 38 | `forwarded_from` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 39 | `allow_forward` | `tinyint(1)` | YES | `1` | — | — | — |
| 40 | `allow_copy` | `tinyint(1)` | YES | `1` | — | — | — |
| 41 | `block_screenshot` | `tinyint(1)` | YES | `0` | — | — | — |
| 42 | `blur_screen_recording` | `tinyint(1)` | YES | `1` | — | — | — |
| 43 | `notify_screenshot_attempts` | `tinyint(1)` | YES | `1` | — | — | — |
| 44 | `deleted_for_everyone` | `tinyint(1)` | NO | `0` | MUL | — | — |
| 45 | `deleted_at` | `datetime` | YES | **'NULL' ← string!** | — | — | — |
| 46 | `deleted_by` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 47 | `snapshot_allow_forward` | `tinyint(1)` | YES | `1` | — | — | — |
| 48 | `snapshot_allow_copy` | `tinyint(1)` | YES | `1` | — | — | — |
| 49 | `snapshot_read_receipts` | `tinyint(1)` | YES | `1` | — | — | — |
| 50 | `snapshot_block_screenshot` | `tinyint(1)` | YES | `0` | — | — | — |
| 51 | `expiry_at` | `datetime` | YES | **'NULL' ← string!** | MUL | — | — |
| 52 | `metadata` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 53 | `server_sequence` | `bigint(20)` | YES | `0` | — | — | — |
| 54 | `version` | `int(11)` | YES | `1` | — | — | — |
| 55 | `failed_at` | `datetime` | YES | **'NULL' ← string!** | — | — | — |
| 56 | `payload_hash` | `varchar(128)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 57 | `is_edited` | `tinyint(1)` | YES | `0` | — | — | — |
| 58 | `is_hidden` | `tinyint(1)` | YES | `0` | — | — | — |
| 59 | `hidden_reason` | `varchar(64)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 60 | `message_type` | `varchar(32)` | YES | `'standard'` | — | — | `utf8mb4_general_ci` |
| 61 | `archive_after_completion` | `tinyint(1)` | YES | `0` | — | — | — |
| 62 | `delete_operation_id` | `varchar(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 63 | `client_message_id` | `varchar(100)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 64 | `forward_count` | `int(11)` | NO | `0` | — | — | — |
| 65 | `source_message_id` | `varchar(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 66 | `forward_lineage_id` | `varchar(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 67 | `idempotency_key` | `varchar(128)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |

**Indexes**
- `fk_message_deleted_by` (deleted_by)
- `idx_messages_chat_pinned` (chat_id, pinned)
- `idx_messages_chat_sent` (chat_id, sent_at)
- `idx_messages_chat_type` (chat_id, type)
- `idx_messages_club` (club_id, sent_at)
- `idx_messages_deleted` (deleted_for_everyone)
- `idx_messages_expires_at` (expires_at)
- `idx_messages_expiry` (expiry_at)
- `idx_messages_forward_lineage` (forward_lineage_id)
- `idx_messages_idempotency` (idempotency_key)
- `idx_messages_recipient` (recipient_id, sent_at)
- `idx_messages_reply_to` (reply_to_message_id)
- `idx_messages_sender` (sender_id, sent_at)
- `idx_messages_sent_at` (sent_at)
- `idx_msg_conversation` (conversation_id, sent_at)
- `idx_msg_conv_unread` (conversation_id, is_read, status, sender_id)
- `idx_msg_pc_unread` (personal_chat_id, is_read, status, sender_id)
- `idx_msg_recipient_seq` (recipient_id, server_sequence)
- `idx_msg_sender_seq` (sender_id, server_sequence)
- `idx_msg_status` (status)
- `idx_server_seq` (chat_id, server_sequence)
- `PRIMARY` (message_id)

**Foreign keys**
- `fk_messages_chat`: (chat_id) → `group_chats`.chat_id
- `fk_messages_club`: (club_id) → `clubs`.club_id
- `fk_messages_conversation`: (conversation_id) → `personal_chats`.chat_id
- `fk_messages_reply`: (reply_to_message_id) → `messages`.message_id
- `fk_message_deleted_by`: (deleted_by) → `users`.user_id
- `fk_personal_chat`: (personal_chat_id) → `personal_chats`.chat_id
- `messages_ibfk_1`: (sender_id) → `users`.user_id
- `messages_ibfk_2`: (recipient_id) → `users`.user_id

**Constraints**: `payload` (CHECK), `PRIMARY` (PRIMARY KEY)

---

## `message_bookmarks`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `bookmark_id` | `varchar(128)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `message_id` | `varchar(128)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `varchar(128)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `created_at` | `datetime` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_user_bookmarks` (user_id)
- `PRIMARY` (bookmark_id)
- `unique_user_bookmark` (message_id, user_id)

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_user_bookmark` (UNIQUE)

---

## `message_deletions`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `deletion_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `message_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `deleted_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 5 | `operation_id` | `varchar(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |

**Indexes**
- `PRIMARY` (deletion_id)
- `unique_deletion` (message_id, user_id)
- `user_id` (user_id)

**Foreign keys**
- `message_deletions_ibfk_1`: (message_id) → `messages`.message_id
- `message_deletions_ibfk_2`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_deletion` (UNIQUE)

---

## `message_forward_deliveries`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `delivery_id` | `varchar(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `source_message_id` | `varchar(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `forwarded_message_id` | `varchar(36)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `destination_chat_id` | `varchar(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 5 | `forwarded_by_user_id` | `varchar(36)` | NO | — | — | — | `utf8mb4_general_ci` |
| 6 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 7 | `idempotency_key` | `varchar(128)` | YES | **'NULL' ← string!** | UNI | — | `utf8mb4_general_ci` |

**Indexes**
- `idempotency_key` (idempotency_key)
- `idx_fwd_dest` (destination_chat_id)
- `idx_fwd_source` (source_message_id)
- `PRIMARY` (delivery_id)

**Constraints**: `idempotency_key` (UNIQUE), `PRIMARY` (PRIMARY KEY)

---

## `message_hidden`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `bigint(20) unsigned` | NO | — | PRI | auto_increment | — |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `message_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `hidden_at` | `datetime` | NO | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_hidden_message` (message_id)
- `idx_hidden_user` (user_id)
- `PRIMARY` (id)
- `uq_hidden` (user_id, message_id)

**Foreign keys**
- `fk_hidden_message`: (message_id) → `messages`.message_id
- `fk_hidden_user`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `uq_hidden` (UNIQUE)

---

## `message_pins`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `pin_id` | `varchar(128)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `chat_id` | `varchar(128)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `message_id` | `varchar(128)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `pinned_by` | `varchar(128)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `pinned_at` | `datetime` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_chat_pins` (chat_id)
- `PRIMARY` (pin_id)
- `unique_chat_pin` (chat_id, message_id)

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_chat_pin` (UNIQUE)

---

## `message_reactions`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `reaction_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `message_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `emoji` | `varchar(50)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 6 | `updated_at` | `datetime` | YES | **'NULL' ← string!** | — | on update current_timestamp() | — |

**Indexes**
- `idx_msg_reactions` (message_id)
- `PRIMARY` (reaction_id)
- `unique_reaction` (message_id, user_id)
- `user_id` (user_id)

**Foreign keys**
- `message_reactions_ibfk_1`: (message_id) → `messages`.message_id
- `message_reactions_ibfk_2`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_reaction` (UNIQUE)

---

## `message_read_status`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `message_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `delivered_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 5 | `read_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |

**Indexes**
- `fk_user` (user_id)
- `PRIMARY` (id)
- `uq_msg_user` (message_id, user_id)

**Foreign keys**
- `fk_message`: (message_id) → `messages`.message_id
- `fk_user`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `uq_msg_user` (UNIQUE)

---

## `message_requests`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `request_id` | `int(11)` | NO | — | PRI | auto_increment | — |
| 2 | `sender_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `recipient_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `message_text` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `status` | `enum('pending','accepted','rejected')` | YES | `'pending'` | — | — | `utf8mb4_general_ci` |
| 6 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (request_id)
- `recipient_id` (recipient_id)
- `sender_id` (sender_id)

**Foreign keys**
- `message_requests_ibfk_1`: (sender_id) → `users`.user_id
- `message_requests_ibfk_2`: (recipient_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `message_stars`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `star_id` | `varchar(128)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `message_id` | `varchar(128)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `varchar(128)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `created_at` | `datetime` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_user_stars` (user_id)
- `PRIMARY` (star_id)
- `unique_user_star` (message_id, user_id)

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_user_star` (UNIQUE)

---

## `moderation_scores`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `post_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `toxicity_score` | `float` | YES | `0` | — | — | — |
| 3 | `nsfw_score` | `float` | YES | `0` | — | — | — |
| 4 | `violence_score` | `float` | YES | `0` | — | — | — |
| 5 | `spam_score` | `float` | YES | `0` | — | — | — |
| 6 | `confidence` | `float` | YES | `0` | — | — | — |
| 7 | `last_scored_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `PRIMARY` (post_id)

**Foreign keys**
- `moderation_scores_ibfk_1`: (post_id) → `posts`.post_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `moments`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `moment_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `media_url` | `varchar(500)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `media_type` | `enum('image','video')` | YES | `'image'` | — | — | `utf8mb4_general_ci` |
| 5 | `caption` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `view_count` | `int(11)` | YES | `0` | — | — | — |
| 7 | `like_count` | `int(11)` | YES | `0` | MUL | — | — |
| 8 | `comment_count` | `int(11)` | YES | `0` | — | — | — |
| 9 | `created_at` | `timestamp` | YES | `current_timestamp()` | MUL | — | — |
| 10 | `shares` | `int(11)` | YES | `0` | — | — | — |
| 11 | `views` | `int(11)` | YES | `0` | — | — | — |
| 12 | `thumbnail_url` | `varchar(500)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 13 | `duration` | `int(11)` | YES | `0` | — | — | — |
| 14 | `video_url` | `varchar(500)` | NO | `''` | — | — | `utf8mb4_general_ci` |
| 15 | `category` | `varchar(50)` | YES | `'general'` | — | — | `utf8mb4_general_ci` |
| 16 | `share_count` | `int(11)` | YES | `0` | — | — | — |
| 17 | `is_live` | `tinyint(1)` | YES | `0` | — | — | — |
| 18 | `completion_rate` | `decimal(5,4)` | YES | `1.0000` | — | — | — |
| 19 | `quality_score` | `decimal(5,4)` | YES | `1.0000` | — | — | — |
| 20 | `thread_streak` | `int(11)` | YES | `0` | — | — | — |
| 21 | `last_thread_activity` | `date` | YES | **'NULL' ← string!** | — | — | — |
| 22 | `streaming_url` | `varchar(500)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 23 | `resolution` | `varchar(50)` | YES | `'1080p'` | — | — | `utf8mb4_general_ci` |
| 24 | `bitrate` | `int(11)` | YES | `0` | — | — | — |
| 25 | `deleted_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 26 | `title` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 27 | `description` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 28 | `audience` | `varchar(20)` | YES | `'public'` | — | — | `utf8mb4_general_ci` |
| 29 | `comments_enabled` | `tinyint(1)` | YES | `1` | — | — | — |
| 30 | `overlays` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 31 | `clips_info` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 32 | `music_info` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 33 | `captions_info` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 34 | `duration_seconds` | `float` | YES | **'NULL' ← string!** | — | — | — |
| 35 | `watermark` | `tinyint(1)` | YES | `0` | — | — | — |
| 36 | `shared_to_story` | `tinyint(1)` | YES | `0` | — | — | — |
| 37 | `idempotency_key` | `varchar(64)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 38 | `hide_from_user_ids` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 39 | `show_only_user_ids` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 40 | `is_pinned` | `tinyint(1)` | YES | `0` | — | — | — |

**Indexes**
- `idx_moments_created_at` (created_at)
- `idx_moments_popular` (like_count, created_at)
- `idx_moments_user` (user_id, created_at)
- `PRIMARY` (moment_id)
- `uq_moment_idem` (user_id, idempotency_key)

**Foreign keys**
- `moments_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `captions_info` (CHECK), `clips_info` (CHECK), `hide_from_user_ids` (CHECK), `music_info` (CHECK), `overlays` (CHECK), `PRIMARY` (PRIMARY KEY), `show_only_user_ids` (CHECK), `uq_moment_idem` (UNIQUE)

---

## `moment_audience_lists`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `int(11)` | NO | — | PRI | auto_increment | — |
| 2 | `owner_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `mode` | `enum('hide_from','show_only')` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `target_user_id` | `char(36)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_audience_owner` (owner_id, mode)
- `PRIMARY` (id)
- `uq_audience_entry` (owner_id, mode, target_user_id)

**Constraints**: `PRIMARY` (PRIMARY KEY), `uq_audience_entry` (UNIQUE)

---

## `moment_comments`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `comment_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `moment_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `content` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 6 | `parent_comment_id` | `char(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 7 | `like_count` | `int(11)` | YES | `0` | — | — | — |
| 8 | `score` | `float` | YES | `0` | — | — | — |
| 9 | `streak_type` | `varchar(20)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |

**Indexes**
- `moment_id` (moment_id)
- `PRIMARY` (comment_id)
- `user_id` (user_id)

**Foreign keys**
- `moment_comments_ibfk_1`: (moment_id) → `moments`.moment_id
- `moment_comments_ibfk_2`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `moment_comment_likes`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `comment_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 3 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (comment_id, user_id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `moment_drafts`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `draft_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `title` | `varchar(255)` | YES | `''''''` | — | — | `utf8mb4_general_ci` |
| 4 | `thumbnail_url` | `varchar(500)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 5 | `media_refs` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 6 | `metadata` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 7 | `storage_bytes` | `bigint(20)` | YES | `0` | — | — | — |
| 8 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 9 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `idx_draft_user` (user_id, updated_at)
- `PRIMARY` (draft_id)

**Constraints**: `media_refs` (CHECK), `metadata` (CHECK), `PRIMARY` (PRIMARY KEY)

---

## `moment_hashtags`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `int(11)` | NO | — | PRI | auto_increment | — |
| 2 | `moment_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `hashtag` | `varchar(100)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_mh_hashtag` (hashtag)
- `idx_mh_moment` (moment_id)
- `PRIMARY` (id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `moment_likes`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `moment_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 3 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_ml_moment` (moment_id)
- `idx_ml_user` (user_id)
- `PRIMARY` (moment_id, user_id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `moment_views`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `moment_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `viewer_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 3 | `viewed_at` | `timestamp` | YES | `current_timestamp()` | MUL | — | — |

**Indexes**
- `idx_mv_viewed` (viewed_at)
- `idx_mv_viewer` (viewer_id)
- `PRIMARY` (moment_id, viewer_id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `notifications`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `notification_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `type` | `enum('spark','comment','follow','message','group_invite','achievement','mention','share','marketplace_contact','story_like','story_share','event_update','club_update','poll_invite','story_reply')` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `title` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `content` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 6 | `related_id` | `varchar(50)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 7 | `related_type` | `varchar(50)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 8 | `is_read` | `tinyint(1)` | YES | `0` | — | — | — |
| 9 | `is_actionable` | `tinyint(1)` | YES | `1` | — | — | — |
| 10 | `action_url` | `varchar(500)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 11 | `created_at` | `timestamp` | YES | `current_timestamp()` | MUL | — | — |
| 12 | `read_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 13 | `actor_id` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 14 | `aggregation_count` | `int(11)` | YES | `1` | — | — | — |
| 15 | `message` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 16 | `related_user_id` | `char(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 17 | `sender_id` | `varchar(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 18 | `icon` | `varchar(100)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 19 | `entities` | `longtext` | NO | `json_array()` | — | — | **`utf8mb4_bin`** |
| 20 | `actions` | `longtext` | NO | `json_array()` | — | — | **`utf8mb4_bin`** |
| 21 | `priority` | `enum('critical','high','normal','low')` | NO | `'normal'` | — | — | `utf8mb4_general_ci` |
| 22 | `category` | `enum('security','social','system','announcement','onboarding','commerce','community')` | NO | `'social'` | — | — | `utf8mb4_general_ci` |
| 23 | `is_official` | `tinyint(1)` | NO | `0` | — | — | — |
| 24 | `related_post_id` | `char(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 25 | `id` | `char(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 26 | `target_id` | `char(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |

**Indexes**
- `fk_notif_actor` (actor_id)
- `idx_notifications_created` (created_at)
- `idx_notifications_user` (user_id, is_read, created_at)
- `idx_notif_user_created` (user_id, created_at)
- `idx_notif_user_read` (user_id, is_read)
- `idx_user_category` (user_id, category)
- `PRIMARY` (notification_id)

**Foreign keys**
- `fk_notif_actor`: (actor_id) → `users`.user_id
- `notifications_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `actions` (CHECK), `entities` (CHECK), `PRIMARY` (PRIMARY KEY)

---

## `onboarding_events`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `event_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `event_type` | `varchar(32)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `metadata` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 5 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_user_id` (user_id)
- `PRIMARY` (event_id)

**Foreign keys**
- `onboarding_events_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `metadata` (CHECK), `PRIMARY` (PRIMARY KEY)

---

## `order_audit_log`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `log_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `order_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `actor_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `action` | `varchar(50)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `old_status` | `varchar(20)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `new_status` | `varchar(20)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 7 | `changes` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 8 | `ip_address` | `varchar(45)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 9 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_oal_actor` (actor_id, created_at)
- `idx_oal_order` (order_id, created_at)
- `PRIMARY` (log_id)

**Foreign keys**
- `fk_oal_actor`: (actor_id) → `users`.user_id
- `fk_oal_order`: (order_id) → `marketplace_orders`.order_id

**Constraints**: `changes` (CHECK), `PRIMARY` (PRIMARY KEY)

---

## `order_disputes`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `dispute_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `order_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `raised_by` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `reason` | `varchar(100)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `description` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `status` | `enum('open','investigating','resolved','closed')` | YES | `'open'` | MUL | — | `utf8mb4_general_ci` |
| 7 | `resolution_notes` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 8 | `resolved_by` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 9 | `resolved_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 10 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `fk_od_raised_by` (raised_by)
- `fk_od_resolved_by` (resolved_by)
- `idx_od_order` (order_id)
- `idx_od_status` (status)
- `PRIMARY` (dispute_id)

**Foreign keys**
- `fk_od_order`: (order_id) → `marketplace_orders`.order_id
- `fk_od_raised_by`: (raised_by) → `users`.user_id
- `fk_od_resolved_by`: (resolved_by) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `otp_verifications`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `verification_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `channel` | `enum('email','sms')` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `destination` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `code_hash` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 6 | `attempts` | `tinyint(4)` | YES | `0` | — | — | — |
| 7 | `expires_at` | `timestamp` | NO | — | — | — | — |
| 8 | `verified_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 9 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_otp_user_channel` (user_id, channel, expires_at)
- `idx_otp_user_channel_created` (user_id, channel, created_at)
- `PRIMARY` (verification_id)

**Foreign keys**
- `otp_verifications_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `participants`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `participant_id` | `int(11)` | NO | — | PRI | auto_increment | — |
| 2 | `conversation_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `joined_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 5 | `is_active` | `tinyint(1)` | YES | `1` | — | — | — |

**Indexes**
- `PRIMARY` (participant_id)
- `unique_participant` (conversation_id, user_id)
- `user_id` (user_id)

**Foreign keys**
- `participants_ibfk_1`: (conversation_id) → `conversations`.conversation_id
- `participants_ibfk_2`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_participant` (UNIQUE)

---

## `password_resets`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `reset_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `email` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `token` | `varchar(255)` | NO | — | UNI | — | `utf8mb4_general_ci` |
| 5 | `expires_at` | `timestamp` | NO | — | — | — | — |
| 6 | `used_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 7 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_pr_token` (token)
- `PRIMARY` (reset_id)
- `token` (token)
- `unique_user_reset` (user_id, email)

**Foreign keys**
- `password_resets_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `token` (UNIQUE), `unique_user_reset` (UNIQUE)

---

## `password_reset_tokens`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `token_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `token` | `varchar(255)` | NO | — | UNI | — | `utf8mb4_general_ci` |
| 4 | `expires_at` | `timestamp` | NO | — | MUL | — | — |
| 5 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 6 | `used_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |

**Indexes**
- `idx_token_expiry` (expires_at)
- `idx_token_user` (user_id, used_at)
- `PRIMARY` (token_id)
- `token` (token)

**Foreign keys**
- `password_reset_tokens_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `token` (UNIQUE)

---

## `personal_chats`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `chat_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `participant1_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `participant2_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `last_message_time` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 5 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 6 | `marketplace_listing_id` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 7 | `is_archived_p1` | `tinyint(1)` | YES | `0` | — | — | — |
| 8 | `is_archived_p2` | `tinyint(1)` | YES | `0` | — | — | — |
| 9 | `is_muted_p1` | `tinyint(1)` | YES | `0` | — | — | — |
| 10 | `is_muted_p2` | `tinyint(1)` | YES | `0` | — | — | — |
| 11 | `is_pinned_p1` | `tinyint(1)` | YES | `0` | — | — | — |
| 12 | `is_pinned_p2` | `tinyint(1)` | YES | `0` | — | — | — |
| 13 | `p1_locked` | `tinyint(1)` | YES | `0` | — | — | — |
| 14 | `p2_locked` | `tinyint(1)` | YES | `0` | — | — | — |
| 15 | `p1_pin` | `varchar(20)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 16 | `p2_pin` | `varchar(20)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 17 | `disappearing_duration` | `int(11)` | YES | `0` | — | — | — |
| 18 | `is_deleted_p1` | `tinyint(1)` | YES | `0` | — | — | — |
| 19 | `is_deleted_p2` | `tinyint(1)` | YES | `0` | — | — | — |
| 20 | `privacy_settings` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 21 | `conversation_type` | `enum('dm','group','system','marketplace','support','ai')` | NO | `'dm'` | — | — | `utf8mb4_general_ci` |
| 22 | `is_favorite_p1` | `tinyint(1)` | YES | `0` | — | — | — |
| 23 | `is_favorite_p2` | `tinyint(1)` | YES | `0` | — | — | — |
| 24 | `is_priority_p1` | `tinyint(1)` | YES | `0` | — | — | — |
| 25 | `is_priority_p2` | `tinyint(1)` | YES | `0` | — | — | — |
| 26 | `last_message` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 27 | `disappearing_version` | `int(11)` | YES | `1` | — | — | — |
| 28 | `disappearing_updated_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 29 | `disappearing_updated_by` | `varchar(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |

**Indexes**
- `fk_chats_listing` (marketplace_listing_id)
- `idx_pc_user1` (participant1_id)
- `idx_pc_user2` (participant2_id)
- `idx_personal_chats_participant1` (participant1_id, last_message_time)
- `idx_personal_chats_participant2` (participant2_id, last_message_time)
- `PRIMARY` (chat_id)
- `unique_participants` (participant1_id, participant2_id)

**Foreign keys**
- `fk_chats_listing`: (marketplace_listing_id) → `marketplace_listings`.listing_id
- `personal_chats_ibfk_1`: (participant1_id) → `users`.user_id
- `personal_chats_ibfk_2`: (participant2_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `privacy_settings` (CHECK), `unique_participants` (UNIQUE)

---

## `polls`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `poll_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `creator_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `question` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `description` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 5 | `campus` | `varchar(100)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 6 | `category` | `varchar(50)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 7 | `is_anonymous` | `tinyint(1)` | YES | `0` | — | — | — |
| 8 | `expires_at` | `timestamp` | YES | **'NULL' ← string!** | MUL | — | — |
| 9 | `total_votes` | `int(11)` | YES | `0` | — | — | — |
| 10 | `created_at` | `timestamp` | YES | `current_timestamp()` | MUL | — | — |
| 11 | `is_expired` | `tinyint(1)` | YES | `0` | — | — | — |
| 12 | `allow_invites` | `tinyint(1)` | YES | `1` | — | — | — |
| 13 | `notification_priority` | `int(11)` | YES | `0` | — | — | — |
| 14 | `engagement_score` | `float` | YES | `0` | MUL | — | — |
| 15 | `share_count` | `int(11)` | YES | `0` | — | — | — |
| 16 | `comment_count` | `int(11)` | YES | `0` | — | — | — |
| 17 | `save_count` | `int(11)` | YES | `0` | — | — | — |
| 18 | `distribution_level` | `int(11)` | YES | `1` | — | — | — |
| 19 | `quality_score` | `float` | YES | `1` | — | — | — |
| 20 | `deleted_at` | `timestamp` | YES | **'NULL' ← string!** | MUL | — | — |

**Indexes**
- `idx_polls_active` (expires_at)
- `idx_polls_campus` (campus, created_at)
- `idx_polls_created_at` (created_at)
- `idx_polls_creator` (creator_id, created_at)
- `idx_polls_deleted_at` (deleted_at)
- `idx_polls_engagement` (engagement_score)
- `idx_polls_expiry` (expires_at)
- `PRIMARY` (poll_id)

**Foreign keys**
- `polls_ibfk_1`: (creator_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `poll_comments`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `comment_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `poll_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `content` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `parent_id` | `char(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `like_count` | `int(11)` | YES | `0` | — | — | — |
| 7 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `poll_id` (poll_id)
- `PRIMARY` (comment_id)
- `user_id` (user_id)

**Foreign keys**
- `poll_comments_ibfk_1`: (poll_id) → `polls`.poll_id
- `poll_comments_ibfk_2`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `poll_invites`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `invite_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `poll_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `inviter_id` | `char(36)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `invitee_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 5 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `invitee_id` (invitee_id)
- `poll_id` (poll_id)
- `PRIMARY` (invite_id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `poll_options`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `option_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `poll_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `option_text` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `vote_count` | `int(11)` | YES | `0` | — | — | — |
| 5 | `option_order` | `int(11)` | YES | `0` | — | — | — |

**Indexes**
- `idx_poll_options_poll` (poll_id, option_order)
- `idx_poll_options_poll_id` (poll_id)
- `PRIMARY` (option_id)

**Foreign keys**
- `poll_options_ibfk_1`: (poll_id) → `polls`.poll_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `poll_predictions`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `prediction_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `poll_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `option_id` | `char(36)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `is_correct` | `tinyint(1)` | YES | **'NULL' ← string!** | — | — | — |
| 6 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (prediction_id)
- `unique_prediction` (poll_id, user_id)
- `user_id` (user_id)

**Foreign keys**
- `poll_predictions_ibfk_1`: (poll_id) → `polls`.poll_id
- `poll_predictions_ibfk_2`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_prediction` (UNIQUE)

---

## `poll_votes`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `vote_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `poll_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `option_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 5 | `voted_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_poll_votes_poll` (poll_id, voted_at)
- `idx_poll_votes_poll_id` (poll_id)
- `idx_poll_votes_user` (user_id, voted_at)
- `option_id` (option_id)
- `PRIMARY` (vote_id)
- `unique_poll_vote` (poll_id, user_id)

**Foreign keys**
- `poll_votes_ibfk_1`: (poll_id) → `polls`.poll_id
- `poll_votes_ibfk_2`: (option_id) → `poll_options`.option_id
- `poll_votes_ibfk_3`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_poll_vote` (UNIQUE)

---

## `posts`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `post_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `content` | `text` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `media_url` | `varchar(500)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 5 | `media_type` | `enum('image','video','audio','file')` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `post_type` | `enum('public','campus_only','anonymous','private')` | YES | `'public'` | — | — | `utf8mb4_general_ci` |
| 7 | `campus` | `varchar(100)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 8 | `group_id` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 9 | `location` | `varchar(255)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 10 | `spark_count` | `int(11)` | YES | `0` | MUL | — | — |
| 11 | `comment_count` | `int(11)` | YES | `0` | — | — | — |
| 12 | `share_count` | `int(11)` | YES | `0` | — | — | — |
| 13 | `view_count` | `int(11)` | YES | `0` | — | — | — |
| 14 | `is_edited` | `tinyint(1)` | YES | `0` | — | — | — |
| 15 | `edited_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 16 | `created_at` | `timestamp` | YES | `current_timestamp()` | MUL | — | — |
| 17 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |
| 18 | `club_id` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 19 | `original_post_id` | `char(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 20 | `language` | `varchar(10)` | YES | `'en'` | — | — | `utf8mb4_general_ci` |
| 21 | `reshare_count` | `int(11)` | YES | `0` | — | — | — |
| 22 | `scheduled_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 23 | `comments_enabled` | `tinyint(1)` | YES | `1` | — | — | — |
| 24 | `status` | `enum('active','limited','removed')` | YES | `'active'` | — | — | `utf8mb4_general_ci` |
| 25 | `visibility_score` | `float` | YES | `1` | — | — | — |
| 26 | `is_seed` | `tinyint(1)` | YES | `0` | — | — | — |
| 27 | `category` | `varchar(50)` | YES | `'General'` | — | — | `utf8mb4_general_ci` |
| 28 | `feeling` | `varchar(50)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 29 | `activity` | `varchar(100)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 30 | `tagged_users` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 31 | `approval_status` | `enum('pending','approved','rejected')` | YES | `'approved'` | — | — | `utf8mb4_general_ci` |

**Indexes**
- `idx_posts_campus` (campus)
- `idx_posts_campus_type` (campus, post_type, created_at)
- `idx_posts_club` (club_id)
- `idx_posts_created_at` (created_at)
- `idx_posts_group_created` (group_id, created_at)
- `idx_posts_location` (location)
- `idx_posts_popularity` (spark_count, created_at)
- `idx_posts_search` (content)
- `idx_posts_user` (user_id, created_at)
- `idx_posts_user_id` (user_id)
- `PRIMARY` (post_id)

**Foreign keys**
- `posts_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `tagged_users` (CHECK)

---

## `post_hashtags`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `post_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `tag` | `varchar(100)` | NO | — | PRI | — | `utf8mb4_general_ci` |

**Indexes**
- `idx_hashtags_tag` (tag)
- `PRIMARY` (post_id, tag)

**Foreign keys**
- `post_hashtags_ibfk_1`: (post_id) → `posts`.post_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `post_media`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `media_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `post_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `media_url` | `varchar(500)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `media_type` | `enum('image','video')` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `upload_order` | `int(11)` | YES | `0` | — | — | — |
| 6 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_post_media_post` (post_id, upload_order)
- `PRIMARY` (media_id)

**Foreign keys**
- `post_media_ibfk_1`: (post_id) → `posts`.post_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `post_reports`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `report_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `post_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `reporter_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `reason` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `status` | `enum('pending','resolved','dismissed')` | YES | `'pending'` | — | — | `utf8mb4_general_ci` |
| 6 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 7 | `resolved_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 8 | `resolved_by` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |

**Indexes**
- `post_id` (post_id)
- `PRIMARY` (report_id)
- `reporter_id` (reporter_id)
- `resolved_by` (resolved_by)

**Foreign keys**
- `post_reports_ibfk_1`: (post_id) → `posts`.post_id
- `post_reports_ibfk_2`: (reporter_id) → `users`.user_id
- `post_reports_ibfk_3`: (resolved_by) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `post_reshares`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `int(11)` | NO | — | PRI | auto_increment | — |
| 2 | `post_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_pr_post` (post_id)
- `idx_pr_user` (user_id)
- `PRIMARY` (id)
- `unique_reshare` (post_id, user_id)

**Foreign keys**
- `post_reshares_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_reshare` (UNIQUE)

---

## `push_notifications`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `char(36)` | NO | `'uuid()'` | PRI | — | `utf8mb4_general_ci` |
| 2 | `notification_id` | `char(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `varchar(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `title` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `body` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 6 | `data` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 7 | `created_at` | `timestamp` | NO | `current_timestamp()` | — | — | — |
| 8 | `type` | `varchar(50)` | YES | `'''general'''` | — | — | `utf8mb4_general_ci` |
| 9 | `sent_at` | `timestamp` | YES | `current_timestamp()` | MUL | — | — |
| 10 | `is_read` | `tinyint(1)` | YES | `0` | MUL | — | — |
| 11 | `read_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |

**Indexes**
- `idx_is_read` (is_read)
- `idx_sent_at` (sent_at)
- `idx_user_id` (user_id)
- `PRIMARY` (id)

**Constraints**: `data` (CHECK), `PRIMARY` (PRIMARY KEY)

---

## `push_subscriptions`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `int(11)` | NO | — | PRI | auto_increment | — |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `endpoint` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `p256dh` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `auth` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 6 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (id)
- `user_id` (user_id)

**Foreign keys**
- `push_subscriptions_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `referrals`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `varchar(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `referrer_user_id` | `varchar(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `referred_user_id` | `varchar(36)` | NO | — | UNI | — | `utf8mb4_general_ci` |
| 4 | `referral_code_id` | `varchar(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 5 | `click_id` | `varchar(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `status` | `enum('pending','clicked','installed','signup_started','joined','qualified','rewarded','rejected','expired')` | YES | `'joined'` | — | — | `utf8mb4_general_ci` |
| 7 | `attribution_method` | `varchar(32)` | YES | `'invite_link'` | — | — | `utf8mb4_general_ci` |
| 8 | `attributed_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 9 | `qualified_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 10 | `rewarded_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 11 | `created_at` | `timestamp` | YES | `current_timestamp()` | MUL | — | — |
| 12 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `idx_created_at` (created_at)
- `idx_referrer_status` (referrer_user_id, status)
- `PRIMARY` (id)
- `uk_referred_user` (referred_user_id)

**Constraints**: `PRIMARY` (PRIMARY KEY), `uk_referred_user` (UNIQUE)

---

## `referral_clicks`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `varchar(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `referral_code_id` | `varchar(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 3 | `referrer_user_id` | `varchar(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `code` | `varchar(32)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 5 | `anonymous_session_id` | `varchar(64)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `handoff_token_hash` | `varchar(64)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 7 | `platform` | `varchar(32)` | YES | `'web'` | — | — | `utf8mb4_general_ci` |
| 8 | `source` | `varchar(64)` | YES | `'invite_link'` | — | — | `utf8mb4_general_ci` |
| 9 | `user_agent` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 10 | `ip_hash` | `varchar(64)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 11 | `status` | `varchar(32)` | YES | `'clicked'` | — | — | `utf8mb4_general_ci` |
| 12 | `created_at` | `timestamp` | YES | `current_timestamp()` | MUL | — | — |
| 13 | `expires_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |

**Indexes**
- `idx_code` (code)
- `idx_created` (created_at)
- `idx_handoff_token` (handoff_token_hash)
- `idx_referrer` (referrer_user_id)
- `PRIMARY` (id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `referral_codes`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `varchar(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `varchar(36)` | NO | — | UNI | — | `utf8mb4_general_ci` |
| 3 | `code` | `varchar(32)` | NO | — | UNI | — | `utf8mb4_general_ci` |
| 4 | `active` | `tinyint(1)` | YES | `1` | — | — | — |
| 5 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 6 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `idx_user_active` (user_id, active)
- `PRIMARY` (id)
- `uk_referral_code` (code)
- `uk_referral_user` (user_id)

**Constraints**: `PRIMARY` (PRIMARY KEY), `uk_referral_code` (UNIQUE), `uk_referral_user` (UNIQUE)

---

## `referral_rewards`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `varchar(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `referral_id` | `varchar(36)` | NO | — | UNI | — | `utf8mb4_general_ci` |
| 3 | `referrer_user_id` | `varchar(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `reward_type` | `varchar(32)` | YES | `'wallet_credit'` | — | — | `utf8mb4_general_ci` |
| 5 | `reward_amount` | `decimal(10,2)` | NO | `60.00` | — | — | — |
| 6 | `currency` | `varchar(10)` | YES | `'KES'` | — | — | `utf8mb4_general_ci` |
| 7 | `status` | `varchar(32)` | YES | `'credited'` | — | — | `utf8mb4_general_ci` |
| 8 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 9 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `idx_referrer_reward` (referrer_user_id, status)
- `PRIMARY` (id)
- `uk_reward_referral` (referral_id)

**Constraints**: `PRIMARY` (PRIMARY KEY), `uk_reward_referral` (UNIQUE)

---

## `refresh_tokens`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `token_id` | `varchar(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `varchar(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `token` | `varchar(255)` | NO | — | UNI | — | `utf8mb4_general_ci` |
| 4 | `device_id` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 5 | `expires_at` | `datetime` | NO | — | — | — | — |
| 6 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_rt_token` (token)
- `idx_rt_user_id` (user_id)
- `PRIMARY` (token_id)
- `token` (token)
- `token_2` (token)
- `user_id` (user_id)

**Constraints**: `PRIMARY` (PRIMARY KEY), `token` (UNIQUE)

---

## `reports`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `post_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `reporter_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `reason` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (id)
- `reporter_id` (reporter_id)
- `unique_report` (post_id, reporter_id)

**Foreign keys**
- `reports_ibfk_1`: (post_id) → `posts`.post_id
- `reports_ibfk_2`: (reporter_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_report` (UNIQUE)

---

## `reposts`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `repost_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `post_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `comment` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 5 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `post_id` (post_id)
- `PRIMARY` (repost_id)
- `unique_repost` (user_id, post_id)

**Foreign keys**
- `reposts_ibfk_1`: (user_id) → `users`.user_id
- `reposts_ibfk_2`: (post_id) → `posts`.post_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_repost` (UNIQUE)

---

## `rooms`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `room_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `creator_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `name` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `slug` | `varchar(255)` | NO | — | UNI | — | `utf8mb4_general_ci` |
| 5 | `description` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `avatar_url` | `varchar(500)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 7 | `banner_url` | `varchar(500)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 8 | `campus` | `varchar(100)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 9 | `category` | `varchar(50)` | YES | `'general'` | MUL | — | `utf8mb4_general_ci` |
| 10 | `is_public` | `tinyint(1)` | YES | `0` | — | — | — |
| 11 | `requires_approval` | `tinyint(1)` | YES | `1` | — | — | — |
| 12 | `max_members` | `int(11)` | YES | `0` | — | — | — |
| 13 | `member_count` | `int(11)` | YES | `0` | — | — | — |
| 14 | `online_count` | `int(11)` | YES | `0` | — | — | — |
| 15 | `invite_code` | `varchar(20)` | YES | **'NULL' ← string!** | UNI | — | `utf8mb4_general_ci` |
| 16 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 17 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `creator_id` (creator_id)
- `idx_rooms_campus` (campus)
- `idx_rooms_category` (category)
- `idx_rooms_invite` (invite_code)
- `idx_rooms_slug` (slug)
- `invite_code` (invite_code)
- `PRIMARY` (room_id)
- `slug` (slug)

**Foreign keys**
- `rooms_ibfk_1`: (creator_id) → `users`.user_id

**Constraints**: `invite_code` (UNIQUE), `PRIMARY` (PRIMARY KEY), `slug` (UNIQUE)

---

## `room_activity_log`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `log_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `room_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `actor_id` | `char(36)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `action` | `varchar(50)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `target_id` | `char(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `target_type` | `enum('user','channel','message','room','invite')` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 7 | `details` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 8 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_activity_room` (room_id, created_at)
- `PRIMARY` (log_id)

**Foreign keys**
- `room_activity_log_ibfk_1`: (room_id) → `rooms`.room_id

**Constraints**: `details` (CHECK), `PRIMARY` (PRIMARY KEY)

---

## `room_bans`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `ban_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `room_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `banned_by` | `char(36)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `reason` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `expires_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 7 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_bans_room` (room_id)
- `PRIMARY` (ban_id)
- `unique_room_ban` (room_id, user_id)
- `user_id` (user_id)

**Foreign keys**
- `room_bans_ibfk_1`: (room_id) → `rooms`.room_id
- `room_bans_ibfk_2`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_room_ban` (UNIQUE)

---

## `room_channels`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `channel_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `room_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `name` | `varchar(100)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `description` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 5 | `icon` | `varchar(10)` | YES | `'?'` | — | — | `utf8mb4_general_ci` |
| 6 | `type` | `enum('TEXT','ANNOUNCEMENT','EVENTS','POLLS','MEDIA','VOICE','FORUM','AI','MARKETPLACE','ASSIGNMENTS','NOTES','LABS','DEPARTMENT','GUEST_TALKS','GRADUATION','JOBS','CUSTOM')` | YES | `'TEXT'` | — | — | `utf8mb4_general_ci` |
| 7 | `position` | `int(11)` | YES | `0` | — | — | — |
| 8 | `is_default` | `tinyint(1)` | YES | `0` | — | — | — |
| 9 | `is_read_only` | `tinyint(1)` | YES | `0` | — | — | — |
| 10 | `is_archived` | `tinyint(1)` | YES | `0` | — | — | — |
| 11 | `is_nsfw` | `tinyint(1)` | YES | `0` | — | — | — |
| 12 | `slow_mode_secs` | `int(11)` | YES | `0` | — | — | — |
| 13 | `created_by` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 14 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 15 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |
| 16 | `last_message_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |

**Indexes**
- `created_by` (created_by)
- `idx_channels_room` (room_id, position)
- `idx_channels_type` (room_id, type)
- `PRIMARY` (channel_id)

**Foreign keys**
- `room_channels_ibfk_1`: (room_id) → `rooms`.room_id
- `room_channels_ibfk_2`: (created_by) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `room_invites`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `invite_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `room_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `created_by` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `code` | `varchar(20)` | NO | — | UNI | — | `utf8mb4_general_ci` |
| 5 | `max_uses` | `int(11)` | YES | `0` | — | — | — |
| 6 | `use_count` | `int(11)` | YES | `0` | — | — | — |
| 7 | `expires_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 8 | `type` | `enum('permanent','24h','7d','one_use','unlimited','qr')` | YES | `'permanent'` | — | — | `utf8mb4_general_ci` |
| 9 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `code` (code)
- `created_by` (created_by)
- `idx_invites_code` (code)
- `idx_invites_room` (room_id)
- `PRIMARY` (invite_id)

**Foreign keys**
- `room_invites_ibfk_1`: (room_id) → `rooms`.room_id
- `room_invites_ibfk_2`: (created_by) → `users`.user_id

**Constraints**: `code` (UNIQUE), `PRIMARY` (PRIMARY KEY)

---

## `room_members`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `membership_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `room_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `role` | `enum('owner','admin','moderator','class_rep','lecturer','tutor','dept_admin','verified_staff','member')` | YES | `'member'` | — | — | `utf8mb4_general_ci` |
| 5 | `nickname` | `varchar(50)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `status` | `enum('active','muted','left','removed','banned','pending')` | YES | `'active'` | — | — | `utf8mb4_general_ci` |
| 7 | `joined_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 8 | `invited_by` | `char(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 9 | `last_read_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_room_members_role` (room_id, role)
- `idx_room_members_user` (user_id)
- `PRIMARY` (membership_id)
- `unique_room_member` (room_id, user_id)

**Foreign keys**
- `room_members_ibfk_1`: (room_id) → `rooms`.room_id
- `room_members_ibfk_2`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_room_member` (UNIQUE)

---

## `room_reports`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `report_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `room_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `message_id` | `char(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 4 | `reported_by` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 5 | `reported_user` | `char(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `reason` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 7 | `status` | `enum('pending','reviewed','resolved','dismissed')` | YES | `'pending'` | — | — | `utf8mb4_general_ci` |
| 8 | `reviewed_by` | `char(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 9 | `reviewed_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 10 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_reports_room` (room_id, status)
- `PRIMARY` (report_id)
- `reported_by` (reported_by)

**Foreign keys**
- `room_reports_ibfk_1`: (room_id) → `rooms`.room_id
- `room_reports_ibfk_2`: (reported_by) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `room_voice_sessions`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `voice_session_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `channel_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `name` | `varchar(100)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 4 | `max_users` | `int(11)` | YES | `25` | — | — | — |
| 5 | `is_live` | `tinyint(1)` | YES | `0` | — | — | — |
| 6 | `started_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 7 | `ended_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |

**Indexes**
- `idx_voice_channel` (channel_id, is_live)
- `PRIMARY` (voice_session_id)

**Foreign keys**
- `room_voice_sessions_ibfk_1`: (channel_id) → `room_channels`.channel_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `room_warnings`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `warning_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `room_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `member_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `issued_by` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 5 | `reason` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 6 | `expires_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 7 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_warnings_member` (room_id, member_id)
- `issued_by` (issued_by)
- `member_id` (member_id)
- `PRIMARY` (warning_id)

**Foreign keys**
- `room_warnings_ibfk_1`: (room_id) → `rooms`.room_id
- `room_warnings_ibfk_2`: (member_id) → `users`.user_id
- `room_warnings_ibfk_3`: (issued_by) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `safe_meetup_locations`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `location_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `campus` | `varchar(100)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `name` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `building` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 5 | `description` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `latitude` | `decimal(10,8)` | YES | **'NULL' ← string!** | — | — | — |
| 7 | `longitude` | `decimal(11,8)` | YES | **'NULL' ← string!** | — | — | — |
| 8 | `is_verified` | `tinyint(1)` | YES | `1` | MUL | — | — |
| 9 | `is_24_7` | `tinyint(1)` | YES | `0` | — | — | — |
| 10 | `has_security` | `tinyint(1)` | YES | `0` | — | — | — |
| 11 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 12 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `idx_campus` (campus)
- `idx_verified` (is_verified, campus)
- `PRIMARY` (location_id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `saved_moments`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `moment_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 3 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_sm_user` (user_id)
- `PRIMARY` (moment_id, user_id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `saved_posts`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `save_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `post_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `saved_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `post_id` (post_id)
- `PRIMARY` (save_id)
- `unique_save` (user_id, post_id)

**Foreign keys**
- `saved_posts_ibfk_1`: (user_id) → `users`.user_id
- `saved_posts_ibfk_2`: (post_id) → `posts`.post_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_save` (UNIQUE)

---

## `saved_stickers`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `sticker_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `moment_id` | `char(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 4 | `image_data` | `mediumtext` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `caption` | `varchar(140)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_ss_user` (user_id, created_at)
- `PRIMARY` (sticker_id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `schema_migrations`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `name` | `varchar(191)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `note` | `varchar(1000)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 3 | `applied_at` | `timestamp` | NO | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (name)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `screenshot_audit`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `bigint(20)` | NO | — | PRI | auto_increment | — |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `chat_id` | `char(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 4 | `method` | `varchar(30)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 5 | `ip_address` | `varchar(45)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `attempted_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_sa_user` (user_id, attempted_at)
- `PRIMARY` (id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `search_history`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `query` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `searched_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_sh_user` (user_id)
- `PRIMARY` (id)
- `unique_user_query` (user_id, query)

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_user_query` (UNIQUE)

---

## `security_events`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `event_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `event_type` | `varchar(50)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `details` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 5 | `ip_address` | `varchar(45)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `user_agent` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 7 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 8 | `session_id` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 9 | `is_interruptive` | `tinyint(1)` | YES | `0` | — | — | — |
| 10 | `acknowledged_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |

**Indexes**
- `idx_security_events_user` (user_id, created_at)
- `idx_se_user_interruptive_ack` (user_id, is_interruptive, acknowledged_at, created_at)
- `PRIMARY` (event_id)

**Foreign keys**
- `security_events_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `details` (CHECK), `PRIMARY` (PRIMARY KEY)

---

## `security_transactions`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `transaction_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `purpose` | `enum('2fa_email_enroll','2fa_sms_enroll','2fa_email_alternate','2fa_disable','password_change','password_reset','pin_reset','recovery_regen','security_email_change','admin_step_up')` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `destination` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 5 | `otp_hash` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `verification_token` | `varchar(255)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 7 | `token_expires_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 8 | `expires_at` | `timestamp` | NO | — | — | — | — |
| 9 | `attempt_count` | `tinyint(4)` | YES | `0` | — | — | — |
| 10 | `max_attempts` | `tinyint(4)` | YES | `5` | — | — | — |
| 11 | `status` | `enum('pending','verified','consumed','expired','cancelled')` | YES | `'pending'` | — | — | `utf8mb4_general_ci` |
| 12 | `actor_session_id` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 13 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 14 | `verified_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 15 | `consumed_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |

**Indexes**
- `idx_sec_tx_token` (verification_token)
- `idx_sec_tx_user` (user_id, purpose, status)
- `PRIMARY` (transaction_id)

**Foreign keys**
- `security_transactions_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `services`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `service_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `provider_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `title` | `varchar(255)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `description` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `category` | `enum('tutoring','photography','tech_support','creative','transport','food','other')` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 6 | `subcategory` | `varchar(100)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 7 | `price_type` | `enum('fixed','hourly','negotiable','free')` | NO | — | — | — | `utf8mb4_general_ci` |
| 8 | `price` | `decimal(10,2)` | YES | **'NULL' ← string!** | — | — | — |
| 9 | `price_unit` | `varchar(20)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 10 | `campus` | `varchar(100)` | NO | — | — | — | `utf8mb4_general_ci` |
| 11 | `availability` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 12 | `rating` | `decimal(3,2)` | YES | `0.00` | MUL | — | — |
| 13 | `review_count` | `int(11)` | YES | `0` | — | — | — |
| 14 | `is_verified` | `tinyint(1)` | YES | `0` | — | — | — |
| 15 | `is_active` | `tinyint(1)` | YES | `1` | — | — | — |
| 16 | `image_urls` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 17 | `contact_method` | `enum('message','email','phone','whatsapp')` | YES | `'message'` | — | — | `utf8mb4_general_ci` |
| 18 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 19 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `idx_services_category` (category, campus, created_at)
- `idx_services_provider` (provider_id, created_at)
- `idx_services_rating` (rating, review_count)
- `idx_services_search` (title, description)
- `PRIMARY` (service_id)

**Foreign keys**
- `services_ibfk_1`: (provider_id) → `users`.user_id

**Constraints**: `availability` (CHECK), `image_urls` (CHECK), `PRIMARY` (PRIMARY KEY)

---

## `skill_bookings`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `booking_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `offer_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `booker_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `status` | `enum('pending','accepted','completed','cancelled')` | YES | `'pending'` | — | — | `utf8mb4_general_ci` |
| 5 | `booking_date` | `datetime` | NO | — | — | — | — |
| 6 | `duration_minutes` | `int(11)` | YES | `60` | — | — | — |
| 7 | `notes` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 8 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_bookings_booker` (booker_id, status)
- `idx_bookings_offer` (offer_id, status)
- `PRIMARY` (booking_id)

**Foreign keys**
- `skill_bookings_ibfk_1`: (offer_id) → `skill_offers`.offer_id
- `skill_bookings_ibfk_2`: (booker_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `skill_offers`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `offer_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `title` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `description` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `category` | `varchar(50)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 6 | `skill_type` | `varchar(100)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 7 | `price` | `decimal(10,2)` | YES | **'NULL' ← string!** | — | — | — |
| 8 | `is_free` | `tinyint(1)` | YES | `0` | — | — | — |
| 9 | `campus` | `varchar(100)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 10 | `is_active` | `tinyint(1)` | YES | `1` | — | — | — |
| 11 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 12 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `idx_skill_offers_campus` (campus, is_active, created_at)
- `idx_skill_offers_category` (category, is_active)
- `idx_skill_offers_user` (user_id, created_at)
- `PRIMARY` (offer_id)

**Foreign keys**
- `skill_offers_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `skill_requests`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `request_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `offer_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `requester_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `message` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `proposed_price` | `decimal(10,2)` | YES | **'NULL' ← string!** | — | — | — |
| 6 | `proposed_schedule` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 7 | `status` | `enum('pending','accepted','declined','completed','cancelled')` | YES | `'pending'` | MUL | — | `utf8mb4_general_ci` |
| 8 | `accepted_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 9 | `completed_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 10 | `cancelled_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 11 | `cancellation_reason` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 12 | `rating_by_provider` | `int(11)` | YES | **'NULL' ← string!** | — | — | — |
| 13 | `rating_by_requester` | `int(11)` | YES | **'NULL' ← string!** | — | — | — |
| 14 | `feedback_by_provider` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 15 | `feedback_by_requester` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 16 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 17 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `idx_skill_requests_offer` (offer_id, status, created_at)
- `idx_skill_requests_requester` (requester_id, created_at)
- `idx_skill_requests_status` (status, created_at)
- `PRIMARY` (request_id)

**Foreign keys**
- `skill_requests_ibfk_1`: (offer_id) → `skill_offers`.offer_id
- `skill_requests_ibfk_2`: (requester_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `proposed_schedule` (CHECK)

---

## `skill_reviews`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `review_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `offer_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `reviewer_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `rating` | `int(11)` | NO | — | — | — | — |
| 5 | `comment` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (review_id)
- `reviewer_id` (reviewer_id)
- `unique_review` (offer_id, reviewer_id)

**Foreign keys**
- `skill_reviews_ibfk_1`: (offer_id) → `skill_offers`.offer_id
- `skill_reviews_ibfk_2`: (reviewer_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `rating` (CHECK), `unique_review` (UNIQUE)

---

## `sparkle_ota_versions`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `int(11)` | NO | — | PRI | auto_increment | — |
| 2 | `version` | `varchar(20)` | NO | — | UNI | — | `utf8mb4_general_ci` |
| 3 | `min_apk_version` | `varchar(20)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `bundle_url` | `varchar(500)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `bundle_hash` | `varchar(64)` | NO | — | — | — | `utf8mb4_general_ci` |
| 6 | `signature` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 7 | `is_mandatory` | `tinyint(1)` | YES | `0` | — | — | — |
| 8 | `changelog` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 9 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (id)
- `version` (version)

**Constraints**: `PRIMARY` (PRIMARY KEY), `version` (UNIQUE)

---

## `sparkly_conversations`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `title` | `varchar(255)` | YES | `'New Chat'` | — | — | `utf8mb4_general_ci` |
| 4 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 5 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |
| 6 | `chat_id` | `varchar(64)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |

**Indexes**
- `idx_user_id` (user_id)
- `PRIMARY` (id)

**Foreign keys**
- `sparkly_conversations_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `sparkly_messages`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `conversation_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `role` | `enum('user','assistant','system')` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `content` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 6 | `structured_data` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 7 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_conv_id` (conversation_id)
- `idx_user_id` (user_id)
- `PRIMARY` (id)

**Foreign keys**
- `sparkly_messages_ibfk_1`: (conversation_id) → `sparkly_conversations`.id
- `sparkly_messages_ibfk_2`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `structured_data` (CHECK)

---

## `sparkly_message_feedback`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `varchar(64)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `message_id` | `varchar(64)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `feedback_type` | `enum('like','dislike')` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_sparkly_fb_user_msg` (user_id, message_id)
- `PRIMARY` (id)

**Constraints**: `idx_sparkly_fb_user_msg` (UNIQUE), `PRIMARY` (PRIMARY KEY)

---

## `sparkly_user_memories`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `memory_type` | `varchar(50)` | NO | `'preference'` | — | — | `utf8mb4_general_ci` |
| 4 | `memory_key` | `varchar(100)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `memory_value` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 6 | `confidence` | `float` | YES | `1` | — | — | — |
| 7 | `source` | `varchar(100)` | YES | `'chat'` | — | — | `utf8mb4_general_ci` |
| 8 | `is_active` | `tinyint(1)` | YES | `1` | — | — | — |
| 9 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 10 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |
| 11 | `last_used_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (id)
- `unique_user_key` (user_id, memory_key)

**Foreign keys**
- `sparkly_user_memories_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_user_key` (UNIQUE)

---

## `sparks`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `spark_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `post_id` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 4 | `comment_id` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 5 | `reaction_type` | `enum('like','fire','heart','laugh','sad','wow')` | YES | `'like'` | — | — | `utf8mb4_general_ci` |
| 6 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 7 | `is_seed` | `tinyint(1)` | YES | `0` | — | — | — |

**Indexes**
- `idx_sparks_comment` (comment_id)
- `idx_sparks_post` (post_id, created_at)
- `idx_sparks_post_user` (post_id, user_id)
- `idx_sparks_user` (user_id, created_at)
- `PRIMARY` (spark_id)
- `unique_user_comment_spark` (user_id, comment_id)
- `unique_user_post_spark` (user_id, post_id)

**Foreign keys**
- `sparks_ibfk_1`: (user_id) → `users`.user_id
- `sparks_ibfk_2`: (post_id) → `posts`.post_id
- `sparks_ibfk_3`: (comment_id) → `comments`.comment_id

**Constraints**: `CONSTRAINT_1` (CHECK), `PRIMARY` (PRIMARY KEY), `unique_user_comment_spark` (UNIQUE), `unique_user_post_spark` (UNIQUE)

---

## `sticker_poll_votes`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `vote_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `sticker_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `option_index` | `tinyint(4)` | NO | — | — | — | — |
| 5 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (vote_id)
- `unique_sticker_poll_vote` (sticker_id, user_id)
- `user_id` (user_id)

**Foreign keys**
- `sticker_poll_votes_ibfk_1`: (sticker_id) → `story_stickers`.sticker_id
- `sticker_poll_votes_ibfk_2`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_sticker_poll_vote` (UNIQUE)

---

## `sticker_quiz_answers`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `answer_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `sticker_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `option_index` | `tinyint(4)` | NO | — | — | — | — |
| 5 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (answer_id)
- `unique_sticker_quiz_answer` (sticker_id, user_id)
- `user_id` (user_id)

**Foreign keys**
- `sticker_quiz_answers_ibfk_1`: (sticker_id) → `story_stickers`.sticker_id
- `sticker_quiz_answers_ibfk_2`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_sticker_quiz_answer` (UNIQUE)

---

## `sticker_templates`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `template_id` | `varchar(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `type` | `varchar(50)` | NO | — | — | — | `utf8mb4_general_ci` |
| 3 | `prompt` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 4 | `icon_name` | `varchar(100)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 5 | `usage_count` | `int(11)` | YES | `0` | — | — | — |
| 6 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (template_id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `stories`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `story_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `club_id` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 4 | `media_url` | `varchar(500)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `media_type` | `enum('image','video','text')` | YES | `'image'` | — | — | `utf8mb4_general_ci` |
| 6 | `caption` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 7 | `like_count` | `int(11)` | YES | `0` | — | — | — |
| 8 | `share_count` | `int(11)` | YES | `0` | — | — | — |
| 9 | `view_count` | `int(11)` | YES | `0` | — | — | — |
| 10 | `publishes_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 11 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 12 | `expires_at` | `timestamp` | YES | `(current_timestamp() + interval 24 hour)` | MUL | — | — |
| 13 | `is_archived` | `tinyint(1)` | YES | `0` | — | — | — |
| 14 | `add_yours_prompt_id` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 15 | `background` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 16 | `audio_url` | `varchar(500)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 17 | `audio_source` | `enum('local','online')` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 18 | `audio_start` | `float` | YES | `0` | — | — | — |
| 19 | `audio_duration` | `float` | YES | `15` | — | — | — |
| 20 | `parent_story_id` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 21 | `stickers` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 22 | `music_info` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 23 | `background_color` | `varchar(20)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 24 | `type` | `enum('media','text','collage')` | YES | `'media'` | — | — | `utf8mb4_general_ci` |
| 25 | `collage_data` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 26 | `comments_enabled` | `tinyint(1)` | YES | `1` | — | — | — |
| 27 | `reply_privacy` | `enum('everyone','followers','off')` | YES | `'everyone'` | — | — | `utf8mb4_general_ci` |
| 28 | `comment_privacy` | `enum('everyone','followers','off')` | YES | `'everyone'` | — | — | `utf8mb4_general_ci` |
| 29 | `allow_sharing` | `tinyint(1)` | YES | `1` | — | — | — |
| 30 | `allow_message_sharing` | `tinyint(1)` | YES | `1` | — | — | — |
| 31 | `auto_share_fb` | `tinyint(1)` | YES | `0` | — | — | — |
| 32 | `auto_share_wa` | `tinyint(1)` | YES | `0` | — | — | — |
| 33 | `save_to_gallery` | `tinyint(1)` | YES | `0` | — | — | — |
| 34 | `save_to_archive` | `tinyint(1)` | YES | `1` | — | — | — |
| 35 | `thumbnail_url` | `varchar(500)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 36 | `width` | `int(11)` | YES | **'NULL' ← string!** | — | — | — |
| 37 | `height` | `int(11)` | YES | **'NULL' ← string!** | — | — | — |
| 38 | `duration` | `double` | YES | **'NULL' ← string!** | — | — | — |
| 39 | `file_size` | `int(11)` | YES | **'NULL' ← string!** | — | — | — |
| 40 | `processing_status` | `varchar(50)` | YES | `'PUBLISHED'` | — | — | `utf8mb4_general_ci` |
| 41 | `story_layers` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 42 | `story_duration` | `int(11)` | YES | `10` | — | — | — |
| 43 | `story_version` | `int(11)` | YES | `1` | — | — | — |
| 44 | `story_theme` | `varchar(100)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 45 | `story_effects` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 46 | `audience` | `varchar(32)` | YES | `'public'` | — | — | `utf8mb4_general_ci` |

**Indexes**
- `fk_story_add_yours` (add_yours_prompt_id)
- `fk_story_parent` (parent_story_id)
- `idx_stories_active` (expires_at, created_at)
- `idx_stories_club` (club_id, created_at)
- `idx_stories_user` (user_id, created_at)
- `PRIMARY` (story_id)

**Foreign keys**
- `fk_stories_club`: (club_id) → `clubs`.club_id
- `fk_story_add_yours`: (add_yours_prompt_id) → `add_yours_prompts`.prompt_id
- `fk_story_parent`: (parent_story_id) → `stories`.story_id
- `stories_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `collage_data` (CHECK), `music_info` (CHECK), `PRIMARY` (PRIMARY KEY), `stickers` (CHECK), `story_effects` (CHECK), `story_layers` (CHECK)

---

## `story_comments`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `comment_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `story_id` | `char(36)` | NO | — | — | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `text` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (comment_id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `story_likes`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `like_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `story_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (like_id)
- `unique_like` (story_id, user_id)
- `user_id` (user_id)

**Foreign keys**
- `story_likes_ibfk_1`: (story_id) → `stories`.story_id
- `story_likes_ibfk_2`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_like` (UNIQUE)

---

## `story_privacy_blocks`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `block_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `blocked_user_id` | `char(36)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (block_id)
- `unique_block` (user_id, blocked_user_id)

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_block` (UNIQUE)

---

## `story_reactions`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `reaction_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `story_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `emoji` | `varchar(10)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (reaction_id)
- `story_id` (story_id)
- `user_id` (user_id)

**Foreign keys**
- `story_reactions_ibfk_1`: (story_id) → `stories`.story_id
- `story_reactions_ibfk_2`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `story_shares`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `share_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `story_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (share_id)
- `story_id` (story_id)
- `user_id` (user_id)

**Foreign keys**
- `story_shares_ibfk_1`: (story_id) → `stories`.story_id
- `story_shares_ibfk_2`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `story_stickers`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `sticker_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `story_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `type` | `enum('add_yours','avatar_loop','poll','quiz','reaction','slider')` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `config` | `longtext` | NO | — | — | — | **`utf8mb4_bin`** |
| 5 | `position_x` | `float` | YES | `50` | — | — | — |
| 6 | `position_y` | `float` | YES | `50` | — | — | — |
| 7 | `scale` | `float` | YES | `1` | — | — | — |
| 8 | `rotation` | `float` | YES | `0` | — | — | — |
| 9 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (sticker_id)
- `story_id` (story_id)

**Foreign keys**
- `story_stickers_ibfk_1`: (story_id) → `stories`.story_id

**Constraints**: `config` (CHECK), `PRIMARY` (PRIMARY KEY)

---

## `story_views`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `view_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `story_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (view_id)
- `unique_view` (story_id, user_id)

**Foreign keys**
- `story_views_ibfk_1`: (story_id) → `stories`.story_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_view` (UNIQUE)

---

## `stream_followers`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `follow_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `stream_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `followed_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_stream_followers_user` (user_id)
- `PRIMARY` (follow_id)
- `unique_stream_follow` (stream_id, user_id)

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_stream_follow` (UNIQUE)

---

## `stream_updates`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `update_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `stream_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `content` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_stream_updates_stream` (stream_id, created_at)
- `PRIMARY` (update_id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `study_locations`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `location_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `name` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 3 | `description` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 4 | `campus` | `varchar(100)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 5 | `building` | `varchar(100)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `room` | `varchar(50)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 7 | `capacity` | `int(11)` | NO | — | — | — | — |
| 8 | `current_occupancy` | `int(11)` | YES | `0` | — | — | — |
| 9 | `facilities` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 10 | `opening_hours` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 11 | `is_available` | `tinyint(1)` | YES | `1` | — | — | — |
| 12 | `noise_level` | `enum('silent','quiet','moderate','loud')` | YES | `'quiet'` | — | — | `utf8mb4_general_ci` |
| 13 | `has_power_outlets` | `tinyint(1)` | YES | `1` | — | — | — |
| 14 | `has_wifi` | `tinyint(1)` | YES | `1` | — | — | — |
| 15 | `image_urls` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 16 | `rating` | `decimal(3,2)` | YES | `0.00` | MUL | — | — |
| 17 | `review_count` | `int(11)` | YES | `0` | — | — | — |
| 18 | `last_updated` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `idx_study_locations_campus` (campus, is_available, current_occupancy)
- `idx_study_locations_rating` (rating, review_count)
- `PRIMARY` (location_id)

**Constraints**: `facilities` (CHECK), `image_urls` (CHECK), `opening_hours` (CHECK), `PRIMARY` (PRIMARY KEY)

---

## `suggestion_dismissals`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `user_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `target_user_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 3 | `created_at` | `timestamp` | NO | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_dismissed_user` (target_user_id)
- `PRIMARY` (user_id, target_user_id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `support_messages`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `message_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `ticket_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `sender_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `message` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `is_admin` | `tinyint(1)` | YES | `0` | — | — | — |
| 6 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (message_id)
- `sender_id` (sender_id)
- `ticket_id` (ticket_id)

**Foreign keys**
- `support_messages_ibfk_1`: (ticket_id) → `support_tickets`.ticket_id
- `support_messages_ibfk_2`: (sender_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `support_requests`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `int(11)` | NO | — | PRI | auto_increment | — |
| 2 | `ticket_id` | `varchar(32)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 4 | `name` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 5 | `email` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `type` | `varchar(100)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 7 | `message` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 8 | `status` | `varchar(20)` | NO | `'open'` | — | — | `utf8mb4_general_ci` |
| 9 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_sr_user` (user_id, created_at)
- `PRIMARY` (id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `support_tickets`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `ticket_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `category` | `enum('verification','payment','abuse','listing','account','other')` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `subject` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `description` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 6 | `status` | `enum('open','in_progress','resolved','closed')` | YES | `'open'` | — | — | `utf8mb4_general_ci` |
| 7 | `priority` | `enum('low','medium','high')` | YES | `'low'` | — | — | `utf8mb4_general_ci` |
| 8 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 9 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `PRIMARY` (ticket_id)
- `user_id` (user_id)

**Foreign keys**
- `support_tickets_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `users`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `user_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `name` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 3 | `username` | `varchar(100)` | NO | — | UNI | — | `utf8mb4_general_ci` |
| 4 | `username_normalized` | `varchar(100)` | YES | **'NULL' ← string!** | UNI | STORED GENERATED | `utf8mb4_general_ci` |
| 5 | `email` | `varchar(255)` | NO | — | UNI | — | `utf8mb4_general_ci` |
| 6 | `password_hash` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 7 | `avatar_url` | `varchar(500)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 8 | `campus` | `varchar(100)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 9 | `major` | `varchar(100)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 10 | `year_of_study` | `varchar(50)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 11 | `bio` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 12 | `joined_at` | `timestamp` | YES | `current_timestamp()` | MUL | — | — |
| 13 | `last_seen_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |
| 14 | `is_online` | `tinyint(1)` | YES | `0` | — | — | — |
| 15 | `anonymous_enabled` | `tinyint(1)` | YES | `0` | — | — | — |
| 16 | `dark_mode_enabled` | `tinyint(1)` | YES | `0` | — | — | — |
| 17 | `account_status` | `varchar(32)` | NO | `'active'` | MUL | — | `utf8mb4_general_ci` |
| 18 | `account_type` | `enum('user','system','business','creator','bot','organization')` | NO | `'user'` | — | — | `utf8mb4_general_ci` |
| 19 | `email_notifications` | `tinyint(1)` | YES | `1` | — | — | — |
| 20 | `push_notifications` | `tinyint(1)` | YES | `1` | — | — | — |
| 21 | `profile_visibility` | `enum('public','campus','private')` | YES | `'public'` | — | — | `utf8mb4_general_ci` |
| 22 | `email_verified` | `tinyint(1)` | YES | `0` | — | — | — |
| 23 | `phone_verified` | `tinyint(1)` | YES | `0` | — | — | — |
| 24 | `phone_number` | `varchar(20)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 25 | `is_private` | `tinyint(1)` | YES | `0` | — | — | — |
| 26 | `role` | `enum('member','moderator','admin')` | YES | `'member'` | — | — | `utf8mb4_general_ci` |
| 27 | `user_type` | `enum('student','alumni','teacher','faculty')` | YES | `'student'` | — | — | `utf8mb4_general_ci` |
| 28 | `student_id` | `varchar(50)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 29 | `is_verified` | `tinyint(1)` | YES | `0` | — | — | — |
| 30 | `headline` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 31 | `website` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 32 | `relationship_status` | `varchar(100)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 33 | `partner_id` | `char(36)` | YES | **'NULL' ← string!** | MUL | — | `utf8mb4_general_ci` |
| 34 | `relationship_since` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 35 | `linkedin_url` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 36 | `github_url` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 37 | `instagram_url` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 38 | `twitter_url` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 39 | `birthday` | `date` | YES | **'NULL' ← string!** | — | — | — |
| 40 | `show_contact_info` | `tinyint(1)` | YES | `0` | — | — | — |
| 41 | `show_birthday` | `tinyint(1)` | YES | `1` | — | — | — |
| 42 | `theme` | `enum('light','dark','system')` | YES | `'system'` | — | — | `utf8mb4_general_ci` |
| 43 | `font_size` | `enum('small','medium','large')` | YES | `'medium'` | — | — | `utf8mb4_general_ci` |
| 44 | `language` | `varchar(10)` | YES | `'en'` | — | — | `utf8mb4_general_ci` |
| 45 | `chat_theme` | `varchar(50)` | YES | `'classic_doodle'` | — | — | `utf8mb4_general_ci` |
| 46 | `two_factor_enabled` | `tinyint(1)` | YES | `0` | — | — | — |
| 47 | `two_factor_pin` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 48 | `last_seen_visibility` | `varchar(20)` | YES | `'Everyone'` | — | — | `utf8mb4_general_ci` |
| 49 | `activity_status_enabled` | `tinyint(1)` | YES | `1` | — | — | — |
| 50 | `anonymous_mode_enabled` | `tinyint(1)` | YES | `0` | — | — | — |
| 51 | `message_privacy` | `varchar(20)` | YES | `'Everyone'` | — | — | `utf8mb4_general_ci` |
| 52 | `push_notifications_enabled` | `tinyint(1)` | YES | `1` | — | — | — |
| 53 | `email_notifications_enabled` | `tinyint(1)` | YES | `1` | — | — | — |
| 54 | `notifications_likes` | `tinyint(1)` | YES | `1` | — | — | — |
| 55 | `notifications_comments` | `tinyint(1)` | YES | `1` | — | — | — |
| 56 | `notifications_follows` | `tinyint(1)` | YES | `1` | — | — | — |
| 57 | `notifications_messages` | `tinyint(1)` | YES | `1` | — | — | — |
| 58 | `dnd_enabled` | `tinyint(1)` | YES | `0` | — | — | — |
| 59 | `dnd_start_time` | `time` | YES | `'22:00:00'` | — | — | — |
| 60 | `dnd_end_time` | `time` | YES | `'07:00:00'` | — | — | — |
| 61 | `token_version` | `int(11)` | YES | `0` | — | — | — |
| 62 | `security_token` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 63 | `dm_permission` | `varchar(20)` | YES | `'everyone'` | — | — | `utf8mb4_general_ci` |
| 64 | `last_seen` | `varchar(20)` | YES | `'everyone'` | — | — | `utf8mb4_general_ci` |
| 65 | `font_scale` | `varchar(20)` | YES | `'standard'` | — | — | `utf8mb4_general_ci` |
| 66 | `user_role` | `enum('user','admin')` | YES | `'user'` | — | — | `utf8mb4_general_ci` |
| 67 | `profile_views` | `int(11)` | YES | `0` | — | — | — |
| 68 | `deleted_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 69 | `deletion_marked_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 70 | `two_factor_secret` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 71 | `two_factor_backup_codes` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 72 | `note` | `varchar(60)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 73 | `is_seed` | `tinyint(1)` | YES | `0` | — | — | — |
| 74 | `comment_streak` | `int(11)` | YES | `0` | — | — | — |
| 75 | `last_comment_date` | `date` | YES | **'NULL' ← string!** | — | — | — |
| 76 | `creator_reputation` | `float` | YES | `1` | — | — | — |
| 77 | `poll_vote_streak` | `int(11)` | YES | `0` | — | — | — |
| 78 | `onboarding_step` | `int(11)` | NO | `0` | MUL | — | — |
| 79 | `is_system_account` | `tinyint(1)` | YES | `0` | — | — | — |
| 80 | `display_name` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 81 | `official_onboarding_status` | `enum('NOT_STARTED','VIEWED','COMPLETED')` | YES | `'NOT_STARTED'` | — | — | `utf8mb4_general_ci` |
| 82 | `official_onboarding_completed_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 83 | `sensitive_content_level` | `enum('standard','strict')` | YES | `'standard'` | — | — | `utf8mb4_general_ci` |
| 84 | `ai_content_opt_out` | `tinyint(1)` | YES | `0` | — | — | — |
| 85 | `recommendation_personalization` | `tinyint(1)` | YES | `1` | — | — | — |
| 86 | `search_indexing_enabled` | `tinyint(1)` | YES | `1` | — | — | — |
| 87 | `profile_discoverability` | `enum('everyone','friends','private')` | YES | `'everyone'` | — | — | `utf8mb4_general_ci` |
| 88 | `reduced_motion` | `tinyint(1)` | YES | `0` | — | — | — |
| 89 | `auto_download_media` | `varchar(20)` | YES | `'wifi'` | — | — | `utf8mb4_general_ci` |
| 90 | `link_previews_enabled` | `tinyint(1)` | YES | `1` | — | — | — |
| 91 | `haptic_intensity` | `varchar(20)` | YES | `'medium'` | — | — | `utf8mb4_general_ci` |
| 92 | `media_quality` | `varchar(20)` | YES | `'standard'` | — | — | `utf8mb4_general_ci` |
| 93 | `name_updated_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 94 | `username_updated_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 95 | `default_read_receipts` | `tinyint(1)` | YES | `1` | — | — | — |
| 96 | `default_typing_indicator` | `tinyint(1)` | YES | `1` | — | — | — |
| 97 | `default_allow_media_download` | `tinyint(1)` | YES | `1` | — | — | — |
| 98 | `default_allow_copy_text` | `tinyint(1)` | YES | `1` | — | — | — |
| 99 | `default_allow_reactions` | `tinyint(1)` | YES | `1` | — | — | — |
| 100 | `default_allow_forwarding` | `tinyint(1)` | YES | `1` | — | — | — |
| 101 | `default_screenshot_notification` | `tinyint(1)` | YES | `1` | — | — | — |
| 102 | `default_disappearing_mode` | `varchar(50)` | YES | `'off'` | — | — | `utf8mb4_general_ci` |
| 103 | `blur_screen_recording` | `tinyint(1)` | YES | `1` | — | — | — |
| 104 | `last_seen_privacy` | `varchar(50)` | YES | `'everyone'` | — | — | `utf8mb4_general_ci` |
| 105 | `chat_pin` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 106 | `email_2fa_enabled` | `tinyint(1)` | YES | `0` | — | — | — |
| 107 | `sms_2fa_enabled` | `tinyint(1)` | YES | `0` | — | — | — |
| 108 | `email_2fa_verified_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 109 | `sms_2fa_verified_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 110 | `security_recovery_email` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 111 | `password_changed_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 112 | `is_hidden` | `tinyint(1)` | NO | `0` | — | — | — |
| 113 | `suspended_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 114 | `suspension_reason` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 115 | `suspended_by` | `varchar(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 116 | `suspension_expires_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 117 | `terminated_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 118 | `termination_reason` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 119 | `terminated_by` | `varchar(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 120 | `deletion_requested_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 121 | `deletion_scheduled_at` | `timestamp` | YES | **'NULL' ← string!** | MUL | — | — |
| 122 | `deletion_completed_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 123 | `deletion_reason` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 124 | `high_contrast` | `tinyint(1)` | YES | `0` | — | — | — |
| 125 | `video_autoplay` | `varchar(20)` | YES | `'wifi'` | — | — | `utf8mb4_general_ci` |
| 126 | `auto_suppress_notifications` | `tinyint(1)` | YES | `0` | — | — | — |
| 127 | `priority_mention_bypass` | `tinyint(1)` | YES | `1` | — | — | — |
| 128 | `data_saving_mode` | `tinyint(1)` | YES | `0` | — | — | — |
| 129 | `request_filtering` | `varchar(20)` | YES | `'standard'` | — | — | `utf8mb4_general_ci` |
| 130 | `cellular_low_data` | `tinyint(1)` | YES | `1` | — | — | — |
| 131 | `background_sync_throttling` | `tinyint(1)` | YES | `0` | — | — | — |
| 132 | `link_safety_sandbox` | `tinyint(1)` | YES | `1` | — | — | — |
| 133 | `unverified_dm_filter` | `tinyint(1)` | YES | `0` | — | — | — |
| 134 | `admin_password_hash` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 135 | `notifications_story_likes` | `tinyint(1)` | NO | `1` | — | — | — |
| 136 | `notifications_story_shares` | `tinyint(1)` | NO | `1` | — | — | — |
| 137 | `notifications_story_replies` | `tinyint(1)` | NO | `1` | — | — | — |

**Indexes**
- `email` (email)
- `fk_partner` (partner_id)
- `idx_onboarding_step` (onboarding_step)
- `idx_users_account_status` (account_status)
- `idx_users_campus` (campus)
- `idx_users_deletion_scheduled` (deletion_scheduled_at)
- `idx_users_email` (email)
- `idx_users_joined` (joined_at)
- `idx_users_search` (username, name, bio)
- `idx_users_username_normalized` (username_normalized)
- `PRIMARY` (user_id)
- `uq_users_username_normalized` (username_normalized)
- `username` (username)

**Foreign keys**
- `fk_partner`: (partner_id) → `users`.user_id

**Constraints**: `email` (UNIQUE), `PRIMARY` (PRIMARY KEY), `two_factor_backup_codes` (CHECK), `uq_users_username_normalized` (UNIQUE), `username` (UNIQUE)

---

## `user_achievements`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `user_achievement_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `achievement_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `unlocked_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 5 | `notified_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |

**Indexes**
- `achievement_id` (achievement_id)
- `idx_user_achievements_user` (user_id, unlocked_at)
- `PRIMARY` (user_achievement_id)
- `unique_user_achievement` (user_id, achievement_id)

**Foreign keys**
- `user_achievements_ibfk_1`: (user_id) → `users`.user_id
- `user_achievements_ibfk_2`: (achievement_id) → `achievements`.achievement_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_user_achievement` (UNIQUE)

---

## `user_actions`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `action_id` | `varchar(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `varchar(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `post_id` | `varchar(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `creator_id` | `varchar(36)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `action_type` | `varchar(50)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 6 | `action_value` | `float` | YES | `0` | — | — | — |
| 7 | `weight` | `float` | YES | `1` | — | — | — |
| 8 | `created_at` | `timestamp` | YES | `current_timestamp()` | MUL | — | — |

**Indexes**
- `action_type` (action_type)
- `idx_user_actions_created` (created_at)
- `idx_user_actions_user_created` (user_id, created_at)
- `post_id` (post_id)
- `PRIMARY` (action_id)
- `unique_user_action` (user_id, post_id, action_type)
- `user_id` (user_id)

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_user_action` (UNIQUE)

---

## `user_automation_rules`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `rule_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `trigger_name` | `varchar(64)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `action_name` | `varchar(64)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `is_enabled` | `tinyint(1)` | YES | `1` | — | — | — |
| 6 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (rule_id)
- `user_id` (user_id)

**Foreign keys**
- `user_automation_rules_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `user_blocks`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `block_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `blocker_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `blocked_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `blocked_id` (blocked_id)
- `PRIMARY` (block_id)
- `unique_block` (blocker_id, blocked_id)

**Foreign keys**
- `user_blocks_ibfk_1`: (blocker_id) → `users`.user_id
- `user_blocks_ibfk_2`: (blocked_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_block` (UNIQUE)

---

## `user_boosts`

Engine `InnoDB` · collation utf8mb4_general_ci · _Persistent account-linked boost records_

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `boost_id` | `varchar(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `varchar(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `budget_kes` | `decimal(12,2)` | NO | — | — | — | — |
| 4 | `duration_days` | `int(11)` | NO | — | — | — | — |
| 5 | `boost_strength` | `decimal(5,2)` | NO | — | — | — | — |
| 6 | `start_time` | `datetime` | NO | — | — | — | — |
| 7 | `end_time` | `datetime` | NO | — | — | — | — |
| 8 | `status` | `enum('active','expired','cancelled')` | YES | `'active'` | MUL | — | `utf8mb4_general_ci` |
| 9 | `payment_id` | `varchar(64)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 10 | `created_at` | `datetime` | YES | `current_timestamp()` | — | — | — |
| 11 | `updated_at` | `datetime` | YES | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `idx_user_boosts_status_end` (status, end_time)
- `idx_user_boosts_user` (user_id)
- `PRIMARY` (boost_id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `user_interests`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `user_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `interest_slug` | `varchar(64)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 3 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_interest_slug` (interest_slug)
- `PRIMARY` (user_id, interest_slug)

**Foreign keys**
- `user_interests_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `user_legal_consents`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `varchar(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `varchar(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `document_id` | `varchar(50)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `version` | `varchar(20)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `accepted_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 6 | `ip_address` | `varchar(45)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |

**Indexes**
- `idx_user_doc` (user_id, document_id)
- `PRIMARY` (id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `user_mutes`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `mute_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `muter_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `muted_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `muted_id` (muted_id)
- `PRIMARY` (mute_id)
- `unique_mute` (muter_id, muted_id)

**Foreign keys**
- `user_mutes_ibfk_1`: (muter_id) → `users`.user_id
- `user_mutes_ibfk_2`: (muted_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_mute` (UNIQUE)

---

## `user_poll_interests`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `user_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `category` | `varchar(50)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 3 | `interaction_count` | `int(11)` | YES | `1` | — | — | — |
| 4 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `PRIMARY` (user_id, category)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `user_reports`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `report_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `reporter_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `reported_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `reason` | `text` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `status` | `enum('pending','reviewed','resolved')` | YES | `'pending'` | — | — | `utf8mb4_general_ci` |
| 6 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (report_id)
- `reported_id` (reported_id)
- `reporter_id` (reporter_id)

**Foreign keys**
- `user_reports_ibfk_1`: (reporter_id) → `users`.user_id
- `user_reports_ibfk_2`: (reported_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `user_security_logs`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `log_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `event_type` | `varchar(64)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `ip_address` | `varchar(45)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 5 | `user_agent` | `varchar(512)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 6 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |

**Indexes**
- `PRIMARY` (log_id)
- `user_id` (user_id)

**Foreign keys**
- `user_security_logs_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `user_sessions`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `session_id` | `varchar(255)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `varchar(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `device_name` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 4 | `ip_address` | `varchar(45)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 5 | `last_active` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |
| 6 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 7 | `socket_id` | `varchar(128)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 8 | `platform` | `varchar(64)` | YES | `'web'` | — | — | `utf8mb4_general_ci` |
| 9 | `push_token` | `varchar(512)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 10 | `last_active_at` | `datetime` | NO | `current_timestamp()` | — | on update current_timestamp() | — |
| 11 | `is_online` | `tinyint(1)` | YES | `1` | — | — | — |
| 12 | `device_id` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |

**Indexes**
- `idx_sessions_user` (user_id)
- `PRIMARY` (session_id)

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `user_signals_bridge`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `int(11)` | NO | — | PRI | auto_increment | — |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `category` | `varchar(50)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `signal_strength` | `float` | YES | `0` | — | — | — |
| 5 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `idx_usb_user` (user_id)
- `PRIMARY` (id)
- `unique_user_category` (user_id, category)

**Constraints**: `PRIMARY` (PRIMARY KEY), `unique_user_category` (UNIQUE)

---

## `user_trust`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `user_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `trust_score` | `float` | YES | `1` | — | — | — |
| 3 | `false_report_count` | `int(11)` | YES | `0` | — | — | — |
| 4 | `created_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 5 | `updated_at` | `timestamp` | YES | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `PRIMARY` (user_id)

**Foreign keys**
- `user_trust_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `verification_requests`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `request_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `type` | `enum('email','sms','password_reset')` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `requested_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 5 | `status` | `enum('pending','approved','rejected','expired')` | YES | `'pending'` | — | — | `utf8mb4_general_ci` |
| 6 | `id_document_url` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 7 | `reviewed_by` | `char(36)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 8 | `review_notes` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 9 | `reviewed_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |

**Indexes**
- `idx_verif_requests_user_time` (user_id, type, requested_at)
- `PRIMARY` (request_id)

**Foreign keys**
- `verification_requests_ibfk_1`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `video_calls`

Engine `InnoDB` · collation utf8mb4_general_ci

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `call_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `chat_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `started_by` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 4 | `status` | `enum('active','ended','missed')` | YES | `'active'` | — | — | `utf8mb4_general_ci` |
| 5 | `started_at` | `timestamp` | YES | `current_timestamp()` | — | — | — |
| 6 | `ended_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |

**Indexes**
- `chat_id` (chat_id)
- `PRIMARY` (call_id)
- `started_by` (started_by)

**Foreign keys**
- `video_calls_ibfk_1`: (chat_id) → `group_chats`.chat_id
- `video_calls_ibfk_2`: (started_by) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY)

---

## `wallets`

Engine `InnoDB` · collation utf8mb4_general_ci · _One wallet per user — all amounts in integer cents_

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `wallet_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `user_id` | `char(36)` | NO | — | UNI | — | `utf8mb4_general_ci` |
| 3 | `currency` | `varchar(3)` | NO | `'KES'` | — | — | `utf8mb4_general_ci` |
| 4 | `available_balance` | `bigint(20)` | NO | `0` | — | — | — |
| 5 | `pending_balance` | `bigint(20)` | NO | `0` | — | — | — |
| 6 | `lifetime_deposits` | `bigint(20)` | NO | `0` | — | — | — |
| 7 | `lifetime_withdrawals` | `bigint(20)` | NO | `0` | — | — | — |
| 8 | `lifetime_earnings` | `bigint(20)` | NO | `0` | — | — | — |
| 9 | `created_at` | `timestamp` | NO | `current_timestamp()` | — | — | — |
| 10 | `updated_at` | `timestamp` | NO | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `idx_wallets_user_id` (user_id)
- `PRIMARY` (wallet_id)
- `user_id` (user_id)

**Foreign keys**
- `fk_wallet_user`: (user_id) → `users`.user_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `user_id` (UNIQUE)

---

## `wallet_auto_withdrawal_configs`

Engine `InnoDB` · collation utf8mb4_general_ci · _Automated withdrawal configuration per creator wallet_

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `config_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `wallet_id` | `char(36)` | NO | — | UNI | — | `utf8mb4_general_ci` |
| 3 | `user_id` | `char(36)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `is_enabled` | `tinyint(1)` | NO | `0` | MUL | — | — |
| 5 | `mode` | `enum('scheduled','threshold','hybrid')` | NO | `'threshold'` | — | — | `utf8mb4_general_ci` |
| 6 | `threshold_cents` | `bigint(20)` | NO | `500000` | — | — | — |
| 7 | `schedule_frequency` | `enum('daily','weekly','monthly')` | NO | `'weekly'` | — | — | `utf8mb4_general_ci` |
| 8 | `method` | `enum('mpesa','bank')` | NO | `'mpesa'` | — | — | `utf8mb4_general_ci` |
| 9 | `account_name` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 10 | `account_number` | `varchar(50)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 11 | `bank_code` | `varchar(20)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 12 | `phone` | `varchar(20)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 13 | `last_executed_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 14 | `next_scheduled_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 15 | `created_at` | `timestamp` | NO | `current_timestamp()` | — | — | — |
| 16 | `updated_at` | `timestamp` | NO | `current_timestamp()` | — | on update current_timestamp() | — |

**Indexes**
- `idx_auto_withdrawal_enabled` (is_enabled)
- `idx_auto_withdrawal_wallet` (wallet_id)
- `PRIMARY` (config_id)
- `wallet_id` (wallet_id)

**Foreign keys**
- `fk_auto_withdrawal_wallet`: (wallet_id) → `wallets`.wallet_id

**Constraints**: `PRIMARY` (PRIMARY KEY), `wallet_id` (UNIQUE)

---

## `wallet_deposits`

Engine `InnoDB` · collation utf8mb4_general_ci · _Paystack transaction state per deposit attempt_

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `deposit_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `wallet_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `paystack_ref` | `varchar(255)` | NO | — | UNI | — | `utf8mb4_general_ci` |
| 4 | `amount_cents` | `bigint(20)` | NO | — | — | — | — |
| 5 | `currency` | `varchar(3)` | NO | `'KES'` | — | — | `utf8mb4_general_ci` |
| 6 | `method` | `enum('mpesa','card','bank','ussd')` | NO | `'card'` | — | — | `utf8mb4_general_ci` |
| 7 | `phone` | `varchar(20)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 8 | `status` | `enum('Pending','Completed','Failed')` | NO | `'Pending'` | MUL | — | `utf8mb4_general_ci` |
| 9 | `initiated_at` | `timestamp` | NO | `current_timestamp()` | — | — | — |
| 10 | `completed_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 11 | `metadata` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |

**Indexes**
- `idx_deposit_ref` (paystack_ref)
- `idx_deposit_status` (status)
- `idx_deposit_wallet` (wallet_id)
- `PRIMARY` (deposit_id)

**Foreign keys**
- `fk_deposit_wallet`: (wallet_id) → `wallets`.wallet_id

**Constraints**: `idx_deposit_ref` (UNIQUE), `metadata` (CHECK), `PRIMARY` (PRIMARY KEY)

---

## `wallet_transactions`

Engine `InnoDB` · collation utf8mb4_general_ci · _Immutable ledger — never UPDATE or DELETE rows here_

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `transaction_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `wallet_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `reference` | `varchar(255)` | NO | — | UNI | — | `utf8mb4_general_ci` |
| 4 | `type` | `enum('Deposit','Withdrawal','Revenue','Purchase','Refund','Subscription','Tip','BoostPurchase','BoostSpend','AdRevenue','CreatorPayment','Transfer')` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 5 | `status` | `enum('Pending','Completed','Failed','Refunded')` | NO | `'Pending'` | MUL | — | `utf8mb4_general_ci` |
| 6 | `amount` | `bigint(20)` | NO | — | — | — | — |
| 7 | `currency` | `varchar(3)` | NO | `'KES'` | — | — | `utf8mb4_general_ci` |
| 8 | `payment_provider` | `varchar(32)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 9 | `metadata` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 10 | `created_at` | `timestamp` | NO | `current_timestamp()` | MUL | — | — |

**Indexes**
- `idx_txn_created` (created_at)
- `idx_txn_reference` (reference)
- `idx_txn_status` (status)
- `idx_txn_type` (type)
- `idx_txn_wallet_id` (wallet_id)
- `PRIMARY` (transaction_id)

**Foreign keys**
- `fk_txn_wallet`: (wallet_id) → `wallets`.wallet_id

**Constraints**: `idx_txn_reference` (UNIQUE), `metadata` (CHECK), `PRIMARY` (PRIMARY KEY)

---

## `wallet_webhook_events`

Engine `InnoDB` · collation utf8mb4_general_ci · _Durable queue for provider webhooks; completed only after ledger commit_

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `event_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `provider` | `varchar(30)` | NO | `'paystack'` | MUL | — | `utf8mb4_general_ci` |
| 3 | `event_type` | `varchar(100)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `paystack_ref` | `varchar(255)` | NO | — | — | — | `utf8mb4_general_ci` |
| 5 | `payload` | `longtext` | NO | — | — | — | **`utf8mb4_bin`** |
| 6 | `status` | `enum('Pending','Processing','Processed','Failed')` | NO | `'Pending'` | MUL | — | `utf8mb4_general_ci` |
| 7 | `attempts` | `int(11)` | NO | `0` | — | — | — |
| 8 | `last_error` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 9 | `received_at` | `timestamp` | NO | `current_timestamp()` | — | — | — |
| 10 | `updated_at` | `timestamp` | NO | `current_timestamp()` | — | on update current_timestamp() | — |
| 11 | `next_retry_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 12 | `processed_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |

**Indexes**
- `idx_whe_ref_event` (provider, paystack_ref, event_type)
- `idx_whe_status_retry` (status, next_retry_at)
- `PRIMARY` (event_id)

**Constraints**: `idx_whe_ref_event` (UNIQUE), `payload` (CHECK), `PRIMARY` (PRIMARY KEY)

---

## `wallet_webhook_log`

Engine `InnoDB` · collation utf8mb4_general_ci · _Ensures each Paystack event is processed exactly once_

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `id` | `bigint(20)` | NO | — | PRI | auto_increment | — |
| 2 | `paystack_ref` | `varchar(255)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `event_type` | `varchar(100)` | NO | — | — | — | `utf8mb4_general_ci` |
| 4 | `processed_at` | `timestamp` | NO | `current_timestamp()` | — | — | — |

**Indexes**
- `idx_webhook_ref_event` (paystack_ref, event_type)
- `PRIMARY` (id)

**Constraints**: `idx_webhook_ref_event` (UNIQUE), `PRIMARY` (PRIMARY KEY)

---

## `wallet_withdrawals`

Engine `InnoDB` · collation utf8mb4_general_ci · _Payout requests — deduct from pending_balance until processed_

| # | Column | Type | Null | Default | Key | Extra | Collation |
|---|--------|------|------|---------|-----|-------|-----------|
| 1 | `withdrawal_id` | `char(36)` | NO | — | PRI | — | `utf8mb4_general_ci` |
| 2 | `wallet_id` | `char(36)` | NO | — | MUL | — | `utf8mb4_general_ci` |
| 3 | `amount_cents` | `bigint(20)` | NO | — | — | — | — |
| 4 | `currency` | `varchar(3)` | NO | `'KES'` | — | — | `utf8mb4_general_ci` |
| 5 | `method` | `enum('bank','mpesa')` | NO | `'bank'` | — | — | `utf8mb4_general_ci` |
| 6 | `status` | `enum('Pending','Processing','Completed','Failed','Cancelled')` | NO | `'Pending'` | MUL | — | `utf8mb4_general_ci` |
| 7 | `paystack_recipient` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 8 | `paystack_transfer` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 9 | `account_name` | `varchar(255)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 10 | `account_number` | `varchar(50)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 11 | `bank_code` | `varchar(20)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 12 | `phone` | `varchar(20)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 13 | `requested_at` | `timestamp` | NO | `current_timestamp()` | — | — | — |
| 14 | `processed_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 15 | `metadata` | `longtext` | YES | **'NULL' ← string!** | — | — | **`utf8mb4_bin`** |
| 16 | `internal_reference` | `varchar(100)` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |
| 17 | `last_attempt_at` | `timestamp` | YES | **'NULL' ← string!** | — | — | — |
| 18 | `failure_reason` | `text` | YES | **'NULL' ← string!** | — | — | `utf8mb4_general_ci` |

**Indexes**
- `idx_withdrawal_status` (status)
- `idx_withdrawal_wallet` (wallet_id)
- `PRIMARY` (withdrawal_id)

**Foreign keys**
- `fk_withdrawal_wallet`: (wallet_id) → `wallets`.wallet_id

**Constraints**: `metadata` (CHECK), `PRIMARY` (PRIMARY KEY)

---
