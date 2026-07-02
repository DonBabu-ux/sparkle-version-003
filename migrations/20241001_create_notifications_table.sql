-- MySQL - Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    notification_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    actor_id VARCHAR(36) NULL,
    related_id VARCHAR(255) NULL,
    action_url VARCHAR(255) NULL,
    aggregation_count INT DEFAULT 1,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at),
    INDEX idx_is_read (is_read)
);
