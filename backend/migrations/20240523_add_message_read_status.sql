

CREATE TABLE IF NOT EXISTS message_read_status (
    id CHAR(36) PRIMARY KEY,
    message_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    delivered_at TIMESTAMP NULL DEFAULT NULL,
    read_at TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT fk_message FOREIGN KEY (message_id) REFERENCES messages(message_id) ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY uq_msg_user (message_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Update existing messages to have a default record for the sender (so they see their own sent status)
INSERT IGNORE INTO message_read_status (id, message_id, user_id, delivered_at, read_at)
SELECT UUID(), message_id, sender_id, sent_at, sent_at FROM messages;
