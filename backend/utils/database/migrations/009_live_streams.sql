-- Live streaming sessions
CREATE TABLE IF NOT EXISTS live_stream_sessions (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id    VARCHAR(36)   NOT NULL UNIQUE,
  broadcaster_id VARCHAR(36)  NOT NULL,
  title         VARCHAR(200)  NOT NULL,
  category      VARCHAR(50)   NOT NULL DEFAULT 'general',
  status        ENUM('active','ended','failed') NOT NULL DEFAULT 'active',
  viewer_count  INT UNSIGNED  NOT NULL DEFAULT 0,
  thumbnail_url VARCHAR(500)  NULL,
  started_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at      DATETIME      NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_lss_status (status),
  INDEX idx_lss_broadcaster (broadcaster_id),
  INDEX idx_lss_started (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Live stream viewers
CREATE TABLE IF NOT EXISTS live_stream_viewers (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id  VARCHAR(36)  NOT NULL,
  user_id     VARCHAR(36)  NOT NULL,
  joined_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  left_at     DATETIME     NULL,
  UNIQUE KEY uq_lsv_session_user (session_id, user_id),
  INDEX idx_lsv_session (session_id),
  INDEX idx_lsv_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

