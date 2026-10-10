-- ============================================================
-- Migration 008: Email verification, password resets, admin panel
-- ============================================================

-- Email verifications table
CREATE TABLE IF NOT EXISTS email_verifications (
    verification_id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    email VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ev_user_id (user_id),
    INDEX idx_ev_code (code),
    UNIQUE KEY unique_user_email (user_id, email)
);

-- Password resets table
CREATE TABLE IF NOT EXISTS password_resets (
    reset_id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pr_token (token),
    INDEX idx_pr_user_id (user_id)
);

-- Admin logs table
CREATE TABLE IF NOT EXISTS admin_logs (
    log_id CHAR(36) PRIMARY KEY,
    admin_id CHAR(36) NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id CHAR(36),
    details JSON,
    level ENUM('info', 'warning', 'danger') DEFAULT 'info',
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_al_admin_id (admin_id),
    INDEX idx_al_created_at (created_at),
    INDEX idx_al_target (target_type, target_id)
);

-- System settings table
CREATE TABLE IF NOT EXISTS system_settings (
    setting_id CHAR(36) PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT,
    category VARCHAR(50) DEFAULT 'general',
    description TEXT,
    data_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    is_public BOOLEAN DEFAULT FALSE,
    updated_by CHAR(36),
    updated_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ss_category (category),
    INDEX idx_ss_key (setting_key)
);

-- Push notifications table
CREATE TABLE IF NOT EXISTS push_notifications (
    notification_id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    body TEXT,
    data JSON,
    sent_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pn_user_id (user_id),
    INDEX idx_pn_created_at (created_at)
);

-- Insert default system settings (idempotent)
INSERT INTO system_settings (setting_id, setting_key, setting_value, category, description, data_type, is_public) VALUES
    (UUID(), 'site_name', 'Sparkle', 'general', 'Site name', 'string', true),
    (UUID(), 'site_description', 'Campus Social & Commerce Platform', 'general', 'Site description', 'string', true),
    (UUID(), 'allow_registration', 'true', 'security', 'Allow new user registrations', 'boolean', false),
    (UUID(), 'require_email_verification', 'true', 'security', 'Require email verification', 'boolean', false),
    (UUID(), 'max_upload_size_mb', '10', 'uploads', 'Max file upload size in MB', 'number', false),
    (UUID(), 'maintenance_mode', 'false', 'system', 'Put site in maintenance mode', 'boolean', false)
ON DUPLICATE KEY UPDATE setting_key = setting_key;
