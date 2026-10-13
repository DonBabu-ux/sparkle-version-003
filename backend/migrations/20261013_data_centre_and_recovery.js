// migrations/20261013_data_centre_and_recovery.js - Migration for Data Export Jobs & Recovery Portal
'use strict';

const pool = require('../config/database');
const logger = require('../utils/logger');

module.exports = async function up() {
    logger.info('[Migration] Running 20261013_data_centre_and_recovery...');

    // 1. data_export_jobs table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS data_export_jobs (
            job_id VARCHAR(36) NOT NULL PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL,
            categories JSON NOT NULL,
            format ENUM('pdf', 'xlsx', 'csv', 'json') NOT NULL DEFAULT 'pdf',
            delivery_email VARCHAR(255) NOT NULL,
            is_alternate_email TINYINT(1) DEFAULT 0,
            status ENUM('REQUESTED', 'QUEUED', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'REQUESTED',
            file_path VARCHAR(500) DEFAULT NULL,
            file_size_bytes BIGINT DEFAULT NULL,
            download_token VARCHAR(128) DEFAULT NULL UNIQUE,
            token_expires_at TIMESTAMP NULL DEFAULT NULL,
            failure_reason VARCHAR(500) DEFAULT NULL,
            download_count INT DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP NULL DEFAULT NULL,
            INDEX idx_export_user (user_id, status),
            INDEX idx_export_token (download_token),
            INDEX idx_export_status (status, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    // 2. account_recovery_requests table (for login-independent cancellation, appeal verification, & exports)
    await pool.query(`
        CREATE TABLE IF NOT EXISTS account_recovery_requests (
            request_id VARCHAR(36) NOT NULL PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL,
            contact_identifier VARCHAR(255) NOT NULL,
            contact_type ENUM('email', 'phone') NOT NULL DEFAULT 'email',
            challenge_code VARCHAR(64) NOT NULL,
            action_type ENUM('CANCEL_DELETION', 'APPEAL_TERMINATION', 'DATA_EXPORT', 'STATUS_CHECK') NOT NULL,
            status ENUM('PENDING', 'VERIFIED', 'CONSUMED', 'EXPIRED', 'FAILED') NOT NULL DEFAULT 'PENDING',
            attempts INT DEFAULT 0,
            verified_token VARCHAR(128) DEFAULT NULL UNIQUE,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            verified_at TIMESTAMP NULL DEFAULT NULL,
            INDEX idx_recovery_user (user_id, action_type),
            INDEX idx_recovery_contact (contact_identifier),
            INDEX idx_recovery_token (verified_token)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    // 3. account_appeal_cases table (for platform-initiated terminations)
    await pool.query(`
        CREATE TABLE IF NOT EXISTS account_appeal_cases (
            case_id VARCHAR(36) NOT NULL PRIMARY KEY,
            reference_number VARCHAR(32) NOT NULL UNIQUE,
            user_id VARCHAR(36) NOT NULL,
            contact_email VARCHAR(255) NOT NULL,
            reason_category VARCHAR(100) NOT NULL,
            explanation TEXT NOT NULL,
            status ENUM('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFORMATION', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'SUBMITTED',
            reviewer_id VARCHAR(36) DEFAULT NULL,
            reviewer_decision VARCHAR(255) DEFAULT NULL,
            reviewer_notes TEXT DEFAULT NULL,
            decided_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_appeal_user (user_id),
            INDEX idx_appeal_ref (reference_number),
            INDEX idx_appeal_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    logger.info('[Migration] 20261013_data_centre_and_recovery applied successfully.');
};
