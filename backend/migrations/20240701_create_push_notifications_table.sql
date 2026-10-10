-- MySQL - Create push_notifications table (fallback)
CREATE TABLE IF NOT EXISTS push_notifications (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    data JSON DEFAULT NULL,
    type VARCHAR(50) DEFAULT 'general',
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_sent_at (sent_at),
    INDEX idx_is_read (is_read)
);
