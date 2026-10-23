// services/accountRecovery.service.js - Public Login-Independent Account Recovery Portal Service
'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('../config/database');
const logger = require('../utils/logger');
const redisService = require('./redis.service');
const emailService = require('./email.service');
const accountLifecycleService = require('./accountLifecycle.service');
const dataExportService = require('./dataExport.service');

class AccountRecoveryService {
    /**
     * Step 1: Initiate a recovery challenge (Non-authenticated public endpoint)
     * Generic responses to mitigate account enumeration
     */
    async initiateChallenge({ contactIdentifier, actionType, ipAddress = '' }) {
        if (!contactIdentifier) throw new Error('Contact identifier (email or phone) is required');
        const contact = String(contactIdentifier).trim().toLowerCase();

        const validActions = ['CANCEL_DELETION', 'APPEAL_TERMINATION', 'DATA_EXPORT', 'STATUS_CHECK'];
        if (!validActions.includes(actionType)) throw new Error('Invalid recovery action specified');

        // Rate limiting check via Redis (soft-fail if remote Redis latency spikes)
        try {
            const rateKey = `ratelimit:recovery:${contact}`;
            const count = await redisService.incr(rateKey);
            if (count === 1) await redisService.expire(rateKey, 600);
            if (count > 8) {
                throw new Error('Too many recovery requests. Please wait a few minutes before trying again.');
            }
        } catch (rErr) {
            if (rErr.message?.includes('Too many recovery')) throw rErr;
            logger.debug(`[AccountRecovery] Redis rate limit skipped: ${rErr.message}`);
        }

        // Look up user by email
        const [users] = await pool.query(`
            SELECT user_id, email, name, account_status, deletion_scheduled_at
            FROM users
            WHERE email = ?
            LIMIT 1
        `, [contact]);

        if (users.length === 0) {
            // Mitigate enumeration: return generic simulated success
            return {
                success: true,
                message: 'If an account matches this contact, a verification challenge code has been dispatched.',
                targetContact: contact.replace(/(.{2})(.*)(@.*)/, '$1***$3')
            };
        }

        const user = users[0];

        // Specific pre-validation per action
        if (actionType === 'CANCEL_DELETION' && user.account_status !== 'pending_deletion') {
            return {
                success: false,
                code: 'NOT_PENDING_DELETION',
                message: 'This account is not currently scheduled for deletion.'
            };
        }

        if (actionType === 'APPEAL_TERMINATION' && user.account_status !== 'terminated') {
            return {
                success: false,
                code: 'NOT_TERMINATED',
                message: 'This account is not terminated.'
            };
        }

        // Generate 6-digit numeric OTP code with CSPRNG
        const code = crypto.randomInt(100000, 999999).toString();
        const requestId = crypto.randomUUID();
        const ttlSeconds = 15 * 60; // 15 mins
        const challengeCodeHash = await bcrypt.hash(code, 10);

        // Store challenge in DB. Only a hash of the user-entered code is persisted.
        await pool.query(`
            INSERT INTO account_recovery_requests (
                request_id, user_id, contact_identifier, contact_type,
                challenge_code, action_type, status, expires_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', DATE_ADD(NOW(), INTERVAL 15 MINUTE), NOW())
        `, [
            requestId,
            user.user_id,
            contact,
            contact.includes('@') ? 'email' : 'phone',
            challengeCodeHash,
            actionType
        ]);

        // Send challenge via email in background (do NOT block HTTP response on SMTP roundtrip)
        const actionLabels = {
            CANCEL_DELETION: 'Cancel Pending Account Deletion',
            APPEAL_TERMINATION: 'Appeal Account Termination',
            DATA_EXPORT: 'Data Archive Request',
            STATUS_CHECK: 'Check Request Status'
        };

        setImmediate(() => {
            emailService.send({
                to: user.email,
                subject: `Sparkle Verification Code: ${code}`,
                templateName: 'recovery-challenge',
                templateData: {
                    name: user.name,
                    code,
                    actionName: actionLabels[actionType] || 'Account Recovery'
                }
            }).catch(err => logger.warn(`[AccountRecovery] Background email dispatch failed: ${err.message}`));
        });

        return {
            success: true,
            requestId,
            message: 'Verification challenge code has been sent to your verified contact.',
            targetContact: contact.replace(/(.{2})(.*)(@.*)/, '$1***$3')
        };
    }

    /**
     * Step 2: Verify challenge code and obtain short-lived scoped recovery action token
     */
    async verifyChallenge({ requestId, code }) {
        if (!requestId || !code) throw new Error('Request ID and code are required');

        const [requests] = await pool.query(`
            SELECT * FROM account_recovery_requests
            WHERE request_id = ? AND status = 'PENDING' AND expires_at > NOW()
        `, [requestId]);

        if (requests.length === 0) {
            throw new Error('Recovery challenge expired or invalid. Please request a new one.');
        }

        const reqRecord = requests[0];

        if (reqRecord.attempts >= 5) {
            await pool.query('UPDATE account_recovery_requests SET status = "FAILED" WHERE request_id = ?', [requestId]);
            throw new Error('Too many incorrect verification attempts. Challenge voided.');
        }

        const codeMatch = await bcrypt.compare(String(code).trim(), reqRecord.challenge_code);
        if (!codeMatch) {
            await pool.query('UPDATE account_recovery_requests SET attempts = attempts + 1 WHERE request_id = ?', [requestId]);
            throw new Error('Incorrect verification code. Please check and try again.');
        }

        // Issue single-use scoped verification token valid for 15 minutes. Store only a hash.
        const verifiedToken = crypto.randomBytes(32).toString('hex');
        const verifiedTokenHash = crypto.createHash('sha256').update(verifiedToken).digest('hex');

        await pool.query(`
            UPDATE account_recovery_requests
            SET status = 'VERIFIED',
                verified_token_hash = ?,
                verified_at = NOW()
            WHERE request_id = ?
        `, [verifiedTokenHash, requestId]);

        return {
            success: true,
            verifiedToken,
            actionType: reqRecord.action_type,
            userId: reqRecord.user_id,
            message: 'Identity verified successfully.'
        };
    }

    /**
     * Step 3A: Execute Cancel Deletion (Requires verifiedToken)
     */
    async executeCancelDeletion({ verifiedToken }) {
        const verifiedTokenHash = crypto.createHash('sha256').update(verifiedToken).digest('hex');

        const [requests] = await pool.query(`
            SELECT r.*, u.name, u.email, u.account_status, u.deletion_scheduled_at
            FROM account_recovery_requests r
            JOIN users u ON r.user_id = u.user_id
            WHERE r.verified_token_hash = ? AND r.status = 'VERIFIED'
              AND r.action_type = 'CANCEL_DELETION'
              AND r.verified_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)
        `, [verifiedTokenHash]);

        if (requests.length === 0) {
            throw new Error('Invalid, consumed, or expired recovery session token.');
        }

        const r = requests[0];

        // Consume token immediately, exactly once
        const [consumeResult] = await pool.query(
            'UPDATE account_recovery_requests SET status = "CONSUMED" WHERE request_id = ? AND status = "VERIFIED"',
            [r.request_id]
        );
        if (consumeResult.affectedRows !== 1) {
            throw new Error('Invalid, consumed, or expired recovery session token.');
        }

        // Authoritatively restore account via AccountLifecycleService
        const restoreResult = await accountLifecycleService.cancelDeletion({
            userId: r.user_id,
            actorId: 'recovery_portal',
            actorRole: 'user'
        });

        // Notify user
        await emailService.send({
            to: r.email,
            subject: 'Your Sparkle Account Deletion has been Cancelled',
            templateName: 'deletion-cancelled',
            templateData: { name: r.name }
        }).catch(e => logger.warn(`[AccountRecovery] Notify err: ${e.message}`));

        return {
            success: true,
            status: 'active',
            message: 'Your account deletion has been successfully cancelled. You may now log in normally.',
            account: restoreResult
        };
    }

    /**
     * Step 3B: Submit Appeal for Platform-Initiated Termination
     */
    async submitAppeal({ verifiedToken, reasonCategory, explanation, attachments = null }) {
        const verifiedTokenHash = crypto.createHash('sha256').update(verifiedToken).digest('hex');

        const [requests] = await pool.query(`
            SELECT r.*, u.name, u.email, u.account_status
            FROM account_recovery_requests r
            JOIN users u ON r.user_id = u.user_id
            WHERE r.verified_token_hash = ? AND r.status = 'VERIFIED'
              AND r.action_type = 'APPEAL_TERMINATION'
              AND r.verified_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)
        `, [verifiedTokenHash]);

        if (requests.length === 0) throw new Error('Invalid or expired appeal session token.');
        const r = requests[0];

        if (!explanation || explanation.trim().length < 20) {
            throw new Error('Please provide a substantive explanation for your appeal (at least 20 characters).');
        }

        // Consume verification token
        const [consumeResult] = await pool.query(
            'UPDATE account_recovery_requests SET status = "CONSUMED" WHERE request_id = ? AND status = "VERIFIED"',
            [r.request_id]
        );
        if (consumeResult.affectedRows !== 1) {
            throw new Error('Invalid or expired appeal session token.');
        }

        // Generate Appeal Case Reference: SPK-APL-XXXXXX (CSPRNG)
        const refNumber = 'SPK-APL-' + crypto.randomInt(100000, 999999);
        const caseId = crypto.randomUUID();

        await pool.query(`
            INSERT INTO account_appeal_cases (
                case_id, reference_number, user_id, contact_email,
                reason_category, explanation, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'SUBMITTED', NOW())
        `, [
            caseId,
            refNumber,
            r.user_id,
            r.email,
            reasonCategory || 'General Appeal',
            explanation.trim()
        ]);

        // Send confirmation email
        await emailService.send({
            to: r.email,
            subject: `Appeal Case Received [${refNumber}] - Sparkle Trust & Safety`,
            templateName: 'appeal-received',
            templateData: {
                name: r.name,
                referenceNumber: refNumber,
                category: reasonCategory
            }
        }).catch(e => logger.warn(`[AccountRecovery] Appeal confirmation err: ${e.message}`));

        return {
            success: true,
            referenceNumber: refNumber,
            status: 'SUBMITTED',
            message: `Your appeal has been logged under reference #${refNumber}. Our Trust & Safety team will review your case.`
        };
    }

    /**
     * Step 3C: Emergency Data Export Request from Recovery Portal
     */
    async executeEmergencyExport({ verifiedToken, format = 'pdf', categories = [] }) {
        const verifiedTokenHash = crypto.createHash('sha256').update(verifiedToken).digest('hex');

        const [requests] = await pool.query(`
            SELECT r.*, u.email
            FROM account_recovery_requests r
            JOIN users u ON r.user_id = u.user_id
            WHERE r.verified_token_hash = ? AND r.status = 'VERIFIED'
              AND r.action_type = 'DATA_EXPORT'
              AND r.verified_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)
        `, [verifiedTokenHash]);

        if (requests.length === 0) throw new Error('Invalid or expired recovery session token.');
        const r = requests[0];

        const [consumeResult] = await pool.query(
            'UPDATE account_recovery_requests SET status = "CONSUMED" WHERE request_id = ? AND status = "VERIFIED"',
            [r.request_id]
        );
        if (consumeResult.affectedRows !== 1) {
            throw new Error('Invalid or expired recovery session token.');
        }

        const exportResult = await dataExportService.requestExport({
            userId: r.user_id,
            requestedCategories: categories,
            format,
            deliveryEmail: r.email,
            isAlternate: false
        });

        return {
            success: true,
            ...exportResult
        };
    }

    /**
     * Step 4: Check Status of an Appeal or Export without login
     */
    async checkAppealStatus(referenceNumber, contactIdentifier) {
        if (!referenceNumber || !contactIdentifier) {
            throw new Error('Case reference number and contact identifier are required.');
        }

        const [cases] = await pool.query(`
            SELECT reference_number, status, reason_category, created_at, decided_at, reviewer_decision
            FROM account_appeal_cases
            WHERE reference_number = ? AND LOWER(contact_email) = ?
        `, [referenceNumber.trim(), contactIdentifier.trim().toLowerCase()]);

        if (cases.length === 0) {
            throw new Error('No appeal case found matching that reference and email.');
        }

        const c = cases[0];
        return {
            referenceNumber: c.reference_number,
            status: c.status,
            category: c.reason_category,
            submittedAt: c.created_at,
            decidedAt: c.decided_at,
            decisionOutcome: c.status === 'APPROVED' ? 'Approved (Reactivation scheduled)' : (c.status === 'REJECTED' ? 'Decision Upheld' : null)
        };
    }
}

module.exports = new AccountRecoveryService();
