-- 20260801_create_rooms_schema.sql
-- Migration to introduce Room, Channel, and related tables for Sparkle Rooms architecture

-- ------------------------------------------------------------
-- ROOMS (replaces group_chats)
-- ------------------------------------------------------------
CREATE TABLE rooms (
  room_id         CHAR(36) NOT NULL,
  creator_id      CHAR(36) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  slug            VARCHAR(255) NOT NULL UNIQUE,
  description     TEXT DEFAULT NULL,
  avatar_url      VARCHAR(500) DEFAULT NULL,
  banner_url      VARCHAR(500) DEFAULT NULL,
  campus          VARCHAR(100) DEFAULT NULL,
  category        VARCHAR(50) DEFAULT 'general',
  is_public       TINYINT(1) DEFAULT 0,
  requires_approval TINYINT(1) DEFAULT 1,
  max_members     INT DEFAULT 0,           -- 0 = unlimited
  member_count    INT DEFAULT 0,           -- denormalized counter
  online_count    INT DEFAULT 0,           -- denormalized counter
  invite_code     VARCHAR(20) DEFAULT NULL UNIQUE,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (room_id),
  FOREIGN KEY (creator_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_rooms_campus (campus),
  INDEX idx_rooms_category (category),
  INDEX idx_rooms_slug (slug),
  INDEX idx_rooms_invite (invite_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- ROOM MEMBERS
-- ------------------------------------------------------------
CREATE TABLE room_members (
  membership_id   CHAR(36) NOT NULL,
  room_id         CHAR(36) NOT NULL,
  user_id         CHAR(36) NOT NULL,
  role            ENUM('owner','admin','moderator','class_rep','lecturer','tutor','dept_admin','verified_staff','member') DEFAULT 'member',
  nickname        VARCHAR(50) DEFAULT NULL,
  status          ENUM('active','muted','left','removed','banned','pending') DEFAULT 'active',
  joined_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  invited_by      CHAR(36) DEFAULT NULL,
  last_read_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (membership_id),
  UNIQUE KEY unique_room_member (room_id, user_id),
  FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_room_members_user (user_id),
  INDEX idx_room_members_role (room_id, role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- ROOM CHANNELS
-- ------------------------------------------------------------
CREATE TABLE room_channels (
  channel_id      CHAR(36) NOT NULL,
  room_id         CHAR(36) NOT NULL,
  name            VARCHAR(100) NOT NULL,
  description     TEXT DEFAULT NULL,
  icon            VARCHAR(10) DEFAULT '💬',
  type            ENUM('TEXT','ANNOUNCEMENT','EVENTS','POLLS','MEDIA','VOICE','FORUM','AI','MARKETPLACE','ASSIGNMENTS','NOTES','LABS','DEPARTMENT','GUEST_TALKS','GRADUATION','JOBS','CUSTOM') DEFAULT 'TEXT',
  position        INT DEFAULT 0,
  is_default      TINYINT(1) DEFAULT 0,
  is_read_only    TINYINT(1) DEFAULT 0,
  is_archived     TINYINT(1) DEFAULT 0,
  is_nsfw         TINYINT(1) DEFAULT 0,
  slow_mode_secs  INT DEFAULT 0,
  created_by      CHAR(36) DEFAULT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_message_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (channel_id),
  FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_channels_room (room_id, position),
  INDEX idx_channels_type (room_id, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- CHANNEL MESSAGES
-- ------------------------------------------------------------
CREATE TABLE channel_messages (
  message_id      CHAR(36) NOT NULL,
  channel_id      CHAR(36) NOT NULL,
  sender_id       CHAR(36) NOT NULL,
  type            ENUM('text','image','video','voice_note','file','post_share','system','call','poll','event','sticker','gif') DEFAULT 'text',
  content         TEXT DEFAULT NULL,
  media_url       VARCHAR(500) DEFAULT NULL,
  media_type      VARCHAR(50) DEFAULT NULL,
  reply_to_id     CHAR(36) DEFAULT NULL,
  is_pinned       TINYINT(1) DEFAULT 0,
  is_edited       TINYINT(1) DEFAULT 0,
  edited_at       TIMESTAMP NULL DEFAULT NULL,
  is_deleted      TINYINT(1) DEFAULT 0,
  deleted_at      TIMESTAMP NULL DEFAULT NULL,
  metadata        JSON DEFAULT NULL,
  sent_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id),
  FOREIGN KEY (channel_id) REFERENCES room_channels(channel_id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (reply_to_id) REFERENCES channel_messages(message_id) ON DELETE SET NULL,
  INDEX idx_channel_messages_channel (channel_id, sent_at),
  INDEX idx_channel_messages_sender (sender_id, sent_at),
  INDEX idx_channel_messages_pinned (channel_id, is_pinned)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- CHANNEL PERMISSIONS
-- ------------------------------------------------------------
CREATE TABLE channel_permissions (
  permission_id   CHAR(36) NOT NULL,
  channel_id      CHAR(36) NOT NULL,
  role            ENUM('owner','admin','moderator','class_rep','lecturer','tutor','dept_admin','verified_staff','member') NOT NULL,
  can_send        TINYINT(1) DEFAULT 1,
  can_attach      TINYINT(1) DEFAULT 1,
  can_react       TINYINT(1) DEFAULT 1,
  can_pin         TINYINT(1) DEFAULT 0,
  can_manage      TINYINT(1) DEFAULT 0,
  can_invite      TINYINT(1) DEFAULT 0,
  can_mention_all TINYINT(1) DEFAULT 0,
  PRIMARY KEY (permission_id),
  UNIQUE KEY unique_channel_role (channel_id, role),
  FOREIGN KEY (channel_id) REFERENCES room_channels(channel_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- CHANNEL NOTIFICATION SETTINGS
-- ------------------------------------------------------------
CREATE TABLE channel_notification_settings (
  id              CHAR(36) NOT NULL,
  channel_id      CHAR(36) NOT NULL,
  user_id         CHAR(36) NOT NULL,
  level           ENUM('all','mentions','priority','muted') DEFAULT 'all',
  PRIMARY KEY (id),
  UNIQUE KEY unique_channel_user_notif (channel_id, user_id),
  FOREIGN KEY (channel_id) REFERENCES room_channels(channel_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- ROOM INVITES
-- ------------------------------------------------------------
CREATE TABLE room_invites (
  invite_id       CHAR(36) NOT NULL,
  room_id         CHAR(36) NOT NULL,
  created_by      CHAR(36) NOT NULL,
  code            VARCHAR(20) NOT NULL UNIQUE,
  max_uses        INT DEFAULT 0,
  use_count       INT DEFAULT 0,
  expires_at      TIMESTAMP NULL DEFAULT NULL,
  type            ENUM('permanent','24h','7d','one_use','unlimited','qr') DEFAULT 'permanent',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (invite_id),
  FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_invites_code (code),
  INDEX idx_invites_room (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- MODERATION TABLES
-- ------------------------------------------------------------
CREATE TABLE room_reports (
  report_id       CHAR(36) NOT NULL,
  room_id         CHAR(36) NOT NULL,
  message_id      CHAR(36) DEFAULT NULL,
  reported_by     CHAR(36) NOT NULL,
  reported_user   CHAR(36) DEFAULT NULL,
  reason          TEXT NOT NULL,
  status          ENUM('pending','reviewed','resolved','dismissed') DEFAULT 'pending',
  reviewed_by     CHAR(36) DEFAULT NULL,
  reviewed_at     TIMESTAMP NULL DEFAULT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (report_id),
  FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE,
  FOREIGN KEY (reported_by) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_reports_room (room_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE room_warnings (
  warning_id      CHAR(36) NOT NULL,
  room_id         CHAR(36) NOT NULL,
  member_id       CHAR(36) NOT NULL,
  issued_by       CHAR(36) NOT NULL,
  reason          TEXT NOT NULL,
  expires_at      TIMESTAMP NULL DEFAULT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (warning_id),
  FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (issued_by) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_warnings_member (room_id, member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE room_bans (
  ban_id          CHAR(36) NOT NULL,
  room_id         CHAR(36) NOT NULL,
  user_id         CHAR(36) NOT NULL,
  banned_by       CHAR(36) NOT NULL,
  reason          TEXT DEFAULT NULL,
  expires_at      TIMESTAMP NULL DEFAULT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ban_id),
  UNIQUE KEY unique_room_ban (room_id, user_id),
  FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_bans_room (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- ROOM ACTIVITY LOG
-- ------------------------------------------------------------
CREATE TABLE room_activity_log (
  log_id          CHAR(36) NOT NULL,
  room_id         CHAR(36) NOT NULL,
  actor_id        CHAR(36) NOT NULL,
  action          VARCHAR(50) NOT NULL,
  target_id       CHAR(36) DEFAULT NULL,
  target_type     ENUM('user','channel','message','room','invite') DEFAULT NULL,
  details         JSON DEFAULT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (log_id),
  FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE,
  INDEX idx_activity_room (room_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- VOICE SESSIONS (future proof)
-- ------------------------------------------------------------
CREATE TABLE room_voice_sessions (
  voice_session_id CHAR(36) NOT NULL,
  channel_id       CHAR(36) NOT NULL,
  name             VARCHAR(100) DEFAULT NULL,
  max_users        INT DEFAULT 25,
  is_live          TINYINT(1) DEFAULT 0,
  started_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at         TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (voice_session_id),
  FOREIGN KEY (channel_id) REFERENCES room_channels(channel_id) ON DELETE CASCADE,
  INDEX idx_voice_channel (channel_id, is_live)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- CHANNEL READ STATE (unread tracking)
-- ------------------------------------------------------------
CREATE TABLE channel_read_state (
  id              CHAR(36) NOT NULL,
  channel_id      CHAR(36) NOT NULL,
  user_id         CHAR(36) NOT NULL,
  last_read_message_id CHAR(36) DEFAULT NULL,
  last_read_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  mention_count   INT DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY unique_channel_read (channel_id, user_id),
  FOREIGN KEY (channel_id) REFERENCES room_channels(channel_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
