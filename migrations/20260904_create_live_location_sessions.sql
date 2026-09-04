-- Migration: Create live_location_sessions table for real-time location sharing
CREATE TABLE IF NOT EXISTS live_location_sessions (
    live_location_id VARCHAR(64) PRIMARY KEY,
    message_id VARCHAR(64) NOT NULL,
    chat_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    latitude DOUBLE NOT NULL,
    longitude DOUBLE NOT NULL,
    accuracy FLOAT DEFAULT 0,
    heading FLOAT DEFAULT 0,
    speed FLOAT DEFAULT 0,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NULL,
    duration VARCHAR(20) DEFAULT '1h',
    is_active TINYINT(1) DEFAULT 1,
    comment TEXT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_chat_active (chat_id, is_active),
    INDEX idx_user_active (user_id, is_active)
);
