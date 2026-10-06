const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const User = require('../models/User');
const emailService = require('../services/email.service');
const { sendSMS } = require('../utils/sms');
const infobipService = require('../services/infobip.service');
const redisService = require('../services/redis.service');
const logger = require('../utils/logger');

// ─── Utility ────────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically secure 6-digit OTP.
 * Uses crypto.randomInt to avoid modulo bias.
 */
const generateOTP = () => {
    const code = crypto.randomInt(100000, 999999).toString();
    return code;
};

/**
 * Hash an OTP with bcrypt for secure server-side storage.
 * Never store raw OTPs in the database.
 */
const hashOTP = async (code) => {
    return bcrypt.hash(code, 10);
};

/**
 * Verify an OTP against its stored bcrypt hash.
 */
const verifyOTPHash = async (code, hash) => {
    return bcrypt.compare(code, hash);
};

/**
 * Check Redis-based rate limiting for OTP requests.
 * Max 3 requests per user per channel per 10-minute window.
 */
const checkOTPRateLimit = async (userId, channel) => {
    try {
        const [recent] = await pool.query(
            'SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) as elapsed FROM otp_verifications WHERE user_id = ? AND channel = ? ORDER BY created_at DESC LIMIT 1',
            [userId, channel]
        );
        if (recent.length > 0 && recent[0].elapsed !== null && recent[0].elapsed < 60) {
            return { limited: true, retryAfter: 60 - recent[0].elapsed };
        }
    } catch (err) {
        // Fallback to redis
        logger.warn(`checkOTPRateLimit: OTP rate-limit DB check failed for user ${userId} channel ${channel}, using redis fallback`, err?.message || err);
    }

    const key = `2fa_otp_rate:${userId}:${channel}`;
    try {
        const count = await redisService.incr(key);
        if (count === 1) {
            await redisService.expire(key, 600); // 10 minute window
        }
        if (count > 3) {
            return { limited: true, retryAfter: 60 };
        }
        return { limited: false, retryAfter: 0 };
    } catch {
        // Fail-open if Redis is unavailable
        return { limited: false, retryAfter: 0 };
    }
};

/**
 * Record a security event in the database.
 */
const recordSecurityEvent = async (userId, eventType, details = {}, req = null, options = {}) => {
    try {
        const eventId = options.eventId || crypto.randomUUID();
        const sessionId = options.sessionId || req?.user?.session_id || req?.user?.sessionId || req?.headers?.['x-session-id'] || null;
        const isInterruptive = options.isInterruptive ? 1 : 0;
        await pool.query(
            `INSERT INTO security_events (event_id, user_id, event_type, details, ip_address, user_agent, session_id, is_interruptive) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                eventId,
                userId,
                eventType,
                JSON.stringify(details),
                req?.ip || null,
                req?.headers?.['user-agent'] || null,
                sessionId,
                isInterruptive
            ]
        );
        return eventId;
    } catch (err) {
        logger.warn('Security event logging failed:', err.message);
        return null;
    }
};

/**
 * Send a security notification to the user's notifications table.
 */
const sendSecurityNotification = async (userId, title, content, actionUrl = '/settings/security') => {
    try {
        await pool.query(
            `INSERT INTO notifications (notification_id, user_id, type, title, content, action_url, is_read)
             VALUES (UUID(), ?, 'security', ?, ?, ?, 0)`,
            [userId, title, content, actionUrl]
        );
    } catch (err) {
        logger.warn('Security notification delivery failed:', err.message);
    }
};

/**
 * Send a security alert email to user.
 */
const sendSecurityEmailAlert = async (user, subject, alertMessage, subMessage, req) => {
    try {
        if (!user || !user.email) return;
        const timeFormatted = new Date().toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
        await emailService.send({
            to: user.email,
            subject,
            templateName: 'security-alert',
            templateData: {
                name: user.name || 'Sparkle User',
                alertMessage,
                subMessage,
                time: timeFormatted,
                ipAddress: req?.ip || 'Unavailable',
                userAgent: req?.headers?.['user-agent'] || 'Unavailable device'
            }
        });
    } catch (err) {
        logger.warn('Security email alert failed:', err.message);
    }
};

// ─── Controller Methods ──────────────────────────────────────────────────────

/**
 * GET /api/security/status
 * Returns the current 2FA and session status for the authenticated user.
 */
const getSecurityStatus = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;

        const [rows] = await pool.query(
            `SELECT 
                two_factor_enabled,
                two_factor_secret,
                two_factor_backup_codes,
                email,
                phone_number,
                email_2fa_enabled,
                sms_2fa_enabled,
                email_2fa_verified_at,
                sms_2fa_verified_at,
                security_recovery_email,
                password_hash,
                password_changed_at
             FROM users WHERE user_id = ? LIMIT 1`,
            [userId]
        );

        if (!rows || rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }

        const user = rows[0];

        // Count remaining (unconsumed) backup codes
        let backupCodesRemaining = 0;
        if (user.two_factor_backup_codes) {
            try {
                const codes = typeof user.two_factor_backup_codes === 'string'
                    ? JSON.parse(user.two_factor_backup_codes)
                    : user.two_factor_backup_codes;
                if (Array.isArray(codes)) {
                    backupCodesRemaining = codes.length;
                }
            } catch (err) {
                logger.warn(`getSecurityStatus: two_factor_backup_codes JSON.parse failed for user ${userId}`, err?.message || err);
            }
        }

        // Mask email and phone for UI display
        const maskEmail = (email) => {
            if (!email) return null;
            const [local, domain] = email.split('@');
            if (!domain) return '•••@•••';
            const masked = local.slice(0, 1) + '•'.repeat(Math.max(0, local.length - 1));
            return `${masked}@${domain}`;
        };

        const maskPhone = (phone) => {
            if (!phone) return null;
            const cleaned = phone.replace(/\D/g, '');
            if (cleaned.length < 6) return '•••••••';
            return '•'.repeat(cleaned.length - 2) + cleaned.slice(-2);
        };

        const hasTOTP = !!(user.two_factor_enabled && user.two_factor_secret);
        const is2FAActive = !!(user.email_2fa_enabled || user.sms_2fa_enabled || hasTOTP);

        res.json({
            status: 'success',
            data: {
                two_fa_active: is2FAActive,
                totp_enabled: hasTOTP,
                email_2fa_enabled: !!user.email_2fa_enabled,
                email_2fa_verified_at: user.email_2fa_verified_at || null,
                email_masked: maskEmail(user.security_recovery_email || user.email),
                sms_2fa_enabled: !!user.sms_2fa_enabled,
                sms_2fa_verified_at: user.sms_2fa_verified_at || null,
                phone_masked: maskPhone(user.phone_number),
                phone_configured: !!user.phone_number,
                backup_codes_remaining: backupCodesRemaining,
                sms_provider_available: infobipService.isConfigured(),
                security_recovery_email_masked: maskEmail(user.security_recovery_email),
                has_security_recovery_email: !!user.security_recovery_email,
                has_password: !!user.password_hash,
                password_changed_at: user.password_changed_at || null,
                requires_2fa_factor_for_removal: is2FAActive
            }
        });
    } catch (err) {
        logger.error('Security status error:', err);
        res.status(500).json({ status: 'error', message: 'Failed to load security status' });
    }
};

/**
 * POST /api/security/2fa/email/request
 * Sends an OTP to the user's verified email address.
 */
const requestEmail2FA = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;

        const rateLimit = await checkOTPRateLimit(userId, 'email');
        if (rateLimit.limited) {
            return res.status(429).json({
                status: 'error',
                message: `Please wait ${rateLimit.retryAfter || 60} seconds before requesting another code.`,
                retryAfter: rateLimit.retryAfter || 60
            });
        }

        const [userRows] = await pool.query(
            'SELECT email, name, email_verified FROM users WHERE user_id = ? LIMIT 1',
            [userId]
        );

        if (!userRows || userRows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }

        const user = userRows[0];

        if (!user.email) {
            return res.status(400).json({ status: 'error', message: 'No email address is associated with your account.' });
        }

        const code = generateOTP();
        const codeHash = await hashOTP(code);

        // Invalidate any existing unused OTPs for this user+channel
        await pool.query(
            'DELETE FROM otp_verifications WHERE user_id = ? AND channel = ? AND verified_at IS NULL',
            [userId, 'email']
        );

        await pool.query(
            'INSERT INTO otp_verifications (verification_id, user_id, channel, destination, code_hash, expires_at) VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))',
            [crypto.randomUUID(), userId, 'email', user.email, codeHash]
        );

        logger.info(`[SECURITY 2FA] Email OTP generated for user ${userId} (${user.email}): ${code}`);

        // Send email
        await emailService.send({
            to: user.email,
            subject: 'Your Sparkle Security Verification Code',
            templateName: '2fa-otp',
            templateData: {
                name: user.name || 'Sparkle User',
                code: code,
                purpose: 'Use the code below to verify your email for two-factor authentication.'
            }
        });

        await recordSecurityEvent(userId, '2fa_email_otp_requested', { email: user.email }, req);

        res.json({
            status: 'success',
            message: 'Verification code sent to your email address.',
            expires_in: 600
        });
    } catch (err) {
        logger.error('Email 2FA request error:', err);
        res.status(500).json({ status: 'error', message: "We couldn't send your verification code. Please try again." });
    }
};

/**
 * POST /api/security/2fa/email/verify
 * Verifies an OTP and enables email 2FA for the user.
 */
const verifyEmail2FA = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { code } = req.body;

        if (!code || code.trim().length !== 6) {
            return res.status(400).json({ status: 'error', message: 'A 6-digit verification code is required.' });
        }

        const [rows] = await pool.query(
            `SELECT verification_id, code_hash, attempts, TIMESTAMPDIFF(SECOND, NOW(), expires_at) AS seconds_left
             FROM otp_verifications
             WHERE user_id = ? AND channel = 'email' AND verified_at IS NULL
             ORDER BY created_at DESC LIMIT 1`,
            [userId]
        );

        if (!rows || rows.length === 0 || rows[0].seconds_left <= 0) {
            return res.status(400).json({ status: 'error', message: 'Verification code has expired. Please request a new one.' });
        }

        const record = rows[0];

        // Prevent brute force — max 5 attempts
        if (record.attempts >= 5) {
            await pool.query('DELETE FROM otp_verifications WHERE verification_id = ?', [record.verification_id]);
            return res.status(429).json({ status: 'error', message: 'Too many failed attempts. Please request a new verification code.' });
        }

        const isValid = await verifyOTPHash(code.trim(), record.code_hash);

        if (!isValid) {
            await pool.query(
                'UPDATE otp_verifications SET attempts = attempts + 1 WHERE verification_id = ?',
                [record.verification_id]
            );
            return res.status(400).json({ status: 'error', message: 'The verification code is incorrect. Please try again.' });
        }

        // Mark as verified
        await pool.query(
            'UPDATE otp_verifications SET verified_at = NOW() WHERE verification_id = ?',
            [record.verification_id]
        );

        // Enable email 2FA on the user record
        await pool.query(
            'UPDATE users SET email_2fa_enabled = 1, email_2fa_verified_at = NOW() WHERE user_id = ?',
            [userId]
        );

        await recordSecurityEvent(userId, '2fa_email_enabled', {}, req);
        await sendSecurityNotification(
            userId,
            'Email two-factor authentication enabled',
            'Email verification has been added to your account as a two-factor authentication method.',
            '/settings/security'
        );

        res.json({
            status: 'success',
            message: 'Email verification enabled. Your account is now protected with email two-factor authentication.'
        });
    } catch (err) {
        logger.error('Email 2FA verify error:', err);
        res.status(500).json({ status: 'error', message: 'Verification failed. Please try again.' });
    }
};

/**
 * POST /api/security/2fa/email/disable
 * Disables email 2FA after password confirmation.
 */
const disableEmail2FA = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ status: 'error', message: 'Your account password is required to disable two-factor authentication.' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

        const bcryptModule = require('bcrypt');
        const passwordMatch = await bcryptModule.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ status: 'error', message: 'Incorrect password.' });
        }

        await pool.query(
            'UPDATE users SET email_2fa_enabled = 0, email_2fa_verified_at = NULL WHERE user_id = ?',
            [userId]
        );

        await recordSecurityEvent(userId, '2fa_email_disabled', {}, req);
        await sendSecurityNotification(
            userId,
            'Email two-factor authentication disabled',
            'Email verification has been removed from your account. Your account may be less secure.',
            '/settings/security'
        );

        res.json({ status: 'success', message: 'Email two-factor authentication has been disabled.' });
    } catch (err) {
        logger.error('Disable email 2FA error:', err);
        res.status(500).json({ status: 'error', message: 'Failed to disable email verification. Please try again.' });
    }
};

/**
 * POST /api/security/2fa/sms/request
 * Sends an OTP via SMS to the user's verified phone number.
 */
const requestSMS2FA = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;

        if (!infobipService.isConfigured()) {
            return res.status(503).json({
                status: 'error',
                message: 'SMS verification is not currently available. Please use email verification instead.',
                code: 'SMS_UNCONFIGURED'
            });
        }

        const rateLimit = await checkOTPRateLimit(userId, 'sms');
        if (rateLimit.limited) {
            return res.status(429).json({
                status: 'error',
                message: `Please wait ${rateLimit.retryAfter || 60} seconds before requesting another code.`,
                retryAfter: rateLimit.retryAfter || 60
            });
        }

        const [userRows] = await pool.query(
            'SELECT phone_number, name FROM users WHERE user_id = ? LIMIT 1',
            [userId]
        );

        if (!userRows || userRows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }

        const user = userRows[0];

        if (!user.phone_number) {
            return res.status(400).json({
                status: 'error',
                message: 'No phone number is linked to your account. Please add a phone number in your profile settings first.'
            });
        }

        const code = generateOTP();
        const codeHash = await hashOTP(code);

        // Invalidate any existing unused SMS OTPs for this user
        await pool.query(
            'DELETE FROM otp_verifications WHERE user_id = ? AND channel = ? AND verified_at IS NULL',
            [userId, 'sms']
        );

        await pool.query(
            'INSERT INTO otp_verifications (verification_id, user_id, channel, destination, code_hash, expires_at) VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))',
            [crypto.randomUUID(), userId, 'sms', user.phone_number, codeHash]
        );

        logger.info(`[SECURITY 2FA] SMS OTP generated for user ${userId} (${user.phone_number}): ${code}`);

        await sendSMS(user.phone_number, code);

        await recordSecurityEvent(userId, '2fa_sms_otp_requested', { phone: user.phone_number.slice(0, 4) + '••••' }, req);

        res.json({
            status: 'success',
            message: 'Verification code sent to your phone number.',
            expires_in: 600
        });
    } catch (err) {
        logger.error('SMS 2FA request error:', err);
        res.status(500).json({ status: 'error', message: "We couldn't send your verification code. Please try again." });
    }
};

/**
 * POST /api/security/2fa/sms/verify
 * Verifies an SMS OTP and enables SMS 2FA for the user.
 */
const verifySMS2FA = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { code } = req.body;

        if (!code || code.trim().length !== 6) {
            return res.status(400).json({ status: 'error', message: 'A 6-digit verification code is required.' });
        }

        const [rows] = await pool.query(
            `SELECT verification_id, code_hash, attempts, TIMESTAMPDIFF(SECOND, NOW(), expires_at) AS seconds_left
             FROM otp_verifications
             WHERE user_id = ? AND channel = 'sms' AND verified_at IS NULL
             ORDER BY created_at DESC LIMIT 1`,
            [userId]
        );

        if (!rows || rows.length === 0 || rows[0].seconds_left <= 0) {
            return res.status(400).json({ status: 'error', message: 'Verification code has expired. Please request a new one.' });
        }

        const record = rows[0];

        if (record.attempts >= 5) {
            await pool.query('DELETE FROM otp_verifications WHERE verification_id = ?', [record.verification_id]);
            return res.status(429).json({ status: 'error', message: 'Too many failed attempts. Please request a new verification code.' });
        }

        const isValid = await verifyOTPHash(code.trim(), record.code_hash);

        if (!isValid) {
            await pool.query(
                'UPDATE otp_verifications SET attempts = attempts + 1 WHERE verification_id = ?',
                [record.verification_id]
            );
            return res.status(400).json({ status: 'error', message: 'The verification code is incorrect. Please try again.' });
        }

        await pool.query(
            'UPDATE otp_verifications SET verified_at = NOW() WHERE verification_id = ?',
            [record.verification_id]
        );

        await pool.query(
            'UPDATE users SET sms_2fa_enabled = 1, sms_2fa_verified_at = NOW() WHERE user_id = ?',
            [userId]
        );

        await recordSecurityEvent(userId, '2fa_sms_enabled', {}, req);
        await sendSecurityNotification(
            userId,
            'SMS two-factor authentication enabled',
            'SMS verification has been added to your account as a two-factor authentication method.',
            '/settings/security'
        );

        res.json({
            status: 'success',
            message: 'SMS verification enabled. Your account is now protected with SMS two-factor authentication.'
        });
    } catch (err) {
        logger.error('SMS 2FA verify error:', err);
        res.status(500).json({ status: 'error', message: 'Verification failed. Please try again.' });
    }
};

/**
 * POST /api/security/2fa/sms/disable
 * Disables SMS 2FA after password confirmation.
 */
const disableSMS2FA = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ status: 'error', message: 'Your account password is required to disable two-factor authentication.' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

        const bcryptModule = require('bcrypt');
        const passwordMatch = await bcryptModule.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ status: 'error', message: 'Incorrect password.' });
        }

        await pool.query(
            'UPDATE users SET sms_2fa_enabled = 0, sms_2fa_verified_at = NULL WHERE user_id = ?',
            [userId]
        );

        await recordSecurityEvent(userId, '2fa_sms_disabled', {}, req);
        await sendSecurityNotification(
            userId,
            'SMS two-factor authentication disabled',
            'SMS verification has been removed from your account.',
            '/settings/security'
        );

        res.json({ status: 'success', message: 'SMS two-factor authentication has been disabled.' });
    } catch (err) {
        logger.error('Disable SMS 2FA error:', err);
        res.status(500).json({ status: 'error', message: 'Failed to disable SMS verification. Please try again.' });
    }
};

/**
 * POST /api/security/recovery-codes/generate
 * Generates new single-use recovery codes for the user.
 * Server-side only. Returned once, stored as hashes.
 */
const generateRecoveryCodes = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ status: 'error', message: 'Your account password is required to generate recovery codes.' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

        const bcryptModule = require('bcrypt');
        const passwordMatch = await bcryptModule.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ status: 'error', message: 'Incorrect password.' });
        }

        // Generate 10 single-use recovery codes
        const plainCodes = [];
        const hashedCodes = [];

        for (let i = 0; i < 10; i++) {
            const raw = crypto.randomBytes(5).toString('hex').toUpperCase();
            const formatted = `${raw.slice(0, 5)}-${raw.slice(5)}`;
            plainCodes.push(formatted);
            const hashed = await bcrypt.hash(formatted, 10);
            hashedCodes.push(hashed);
        }

        // Store hashes only — never plaintext
        await pool.query(
            'UPDATE users SET two_factor_backup_codes = ? WHERE user_id = ?',
            [JSON.stringify(hashedCodes), userId]
        );

        await recordSecurityEvent(userId, 'recovery_codes_regenerated', {}, req);
        await sendSecurityNotification(
            userId,
            'Recovery codes regenerated',
            'New recovery codes were generated for your account. Previous codes have been invalidated.',
            '/settings/security'
        );

        // Return plaintext ONCE — never again
        res.json({
            status: 'success',
            message: 'Recovery codes generated. Store them somewhere safe — they will not be shown again.',
            codes: plainCodes
        });
    } catch (err) {
        logger.error('Generate recovery codes error:', err);
        res.status(500).json({ status: 'error', message: 'Failed to generate recovery codes. Please try again.' });
    }
};

/**
 * POST /api/security/2fa/disable-all
 * Disables all active 2FA methods (email, SMS, authenticator) after password confirmation.
 */
const disableAll2FA = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ status: 'error', message: 'Account password is required to disable 2FA.' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

        const bcryptModule = require('bcryptjs');
        const passwordMatch = await bcryptModule.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ status: 'error', message: 'Incorrect password.' });
        }

        await pool.query(
            `UPDATE users SET 
                email_2fa_enabled = 0, 
                email_2fa_verified_at = NULL,
                sms_2fa_enabled = 0, 
                sms_2fa_verified_at = NULL,
                two_factor_enabled = 0, 
                two_factor_secret = NULL,
                two_factor_backup_codes = NULL
             WHERE user_id = ?`,
            [userId]
        );

        await pool.query('DELETE FROM otp_verifications WHERE user_id = ?', [userId]);

        await recordSecurityEvent(userId, '2fa_all_disabled', {}, req);
        await sendSecurityNotification(
            userId,
            'All two-factor authentication disabled',
            'All two-factor authentication methods have been removed from your account.',
            '/settings/security'
        );

        res.json({
            status: 'success',
            message: 'All two-factor authentication methods have been disabled. You can now configure a new method.'
        });
    } catch (err) {
        logger.error('Disable all 2FA error:', err);
        res.status(500).json({ status: 'error', message: 'Failed to disable 2FA. Please try again.' });
    }
};

/**
 * GET /api/security/available-factors
 * Returns the authentication factors available for this user to prove identity.
 */
const getAvailableFactors = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const [rows] = await pool.query(
            `SELECT 
                email,
                phone_number,
                security_recovery_email,
                password_hash,
                email_2fa_enabled,
                sms_2fa_enabled,
                two_factor_enabled,
                two_factor_secret,
                two_factor_backup_codes
             FROM users WHERE user_id = ? LIMIT 1`,
            [userId]
        );

        if (!rows || rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }

        const user = rows[0];

        let backupCodesRemaining = 0;
        if (user.two_factor_backup_codes) {
            try {
                const codes = typeof user.two_factor_backup_codes === 'string'
                    ? JSON.parse(user.two_factor_backup_codes)
                    : user.two_factor_backup_codes;
                if (Array.isArray(codes)) {
                    backupCodesRemaining = codes.length;
                }
            } catch (err) {
                logger.warn(`getAvailableFactors: two_factor_backup_codes JSON.parse failed for user ${userId}`, err?.message || err);
            }
        }

        const maskEmail = (email) => {
            if (!email) return null;
            const [local, domain] = email.split('@');
            if (!domain) return '•••@•••';
            const masked = local.slice(0, 1) + '•'.repeat(Math.max(0, local.length - 1));
            return `${masked}@${domain}`;
        };

        const maskPhone = (phone) => {
            if (!phone) return null;
            const cleaned = phone.replace(/\D/g, '');
            if (cleaned.length < 6) return '•••••••';
            return '•'.repeat(cleaned.length - 2) + cleaned.slice(-2);
        };

        const hasTOTP = !!(user.two_factor_enabled && user.two_factor_secret);
        const is2FAActive = !!(user.email_2fa_enabled || user.sms_2fa_enabled || hasTOTP);

        res.json({
            status: 'success',
            data: {
                has_password: !!user.password_hash,
                has_email_2fa: !!(user.email_2fa_enabled || user.email || user.security_recovery_email),
                email_masked: maskEmail(user.security_recovery_email || user.email),
                has_sms_2fa: !!user.sms_2fa_enabled,
                phone_masked: maskPhone(user.phone_number),
                has_recovery_codes: backupCodesRemaining > 0,
                backup_codes_remaining: backupCodesRemaining,
                has_security_recovery_email: !!user.security_recovery_email,
                security_recovery_email_masked: maskEmail(user.security_recovery_email),
                requires_2fa_factor_for_removal: is2FAActive
            }
        });
    } catch (err) {
        logger.error('Get available factors error:', err);
        res.status(500).json({ status: 'error', message: 'Failed to retrieve security factors.' });
    }
};

/**
 * POST /api/security/transaction/initiate
 * Starts a short-lived, purpose-bound security transaction.
 */
const initiateSecurityTransaction = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { purpose, factor_type, destination } = req.body;

        const VALID_PURPOSES = [
            '2fa_email_enroll',
            '2fa_sms_enroll',
            '2fa_email_alternate',
            '2fa_disable',
            'password_change',
            'password_reset',
            'pin_reset',
            'recovery_regen',
            'security_email_change'
        ];

        if (!purpose || !VALID_PURPOSES.includes(purpose)) {
            return res.status(400).json({ status: 'error', message: 'Invalid or missing security purpose.' });
        }

        const VALID_FACTORS = ['email', 'sms', 'recovery_code', 'password'];
        if (!factor_type || !VALID_FACTORS.includes(factor_type)) {
            return res.status(400).json({ status: 'error', message: 'Invalid verification factor.' });
        }

        const [userRows] = await pool.query(
            `SELECT email, phone_number, security_recovery_email, password_hash, 
                    email_2fa_enabled, sms_2fa_enabled, two_factor_enabled, two_factor_backup_codes, name
             FROM users WHERE user_id = ? LIMIT 1`,
            [userId]
        );

        if (!userRows || userRows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }

        const user = userRows[0];
        const is2FAActive = !!(user.email_2fa_enabled || user.sms_2fa_enabled || user.two_factor_enabled);

        // CRITICAL SECURITY RULE:
        // Password ALONE cannot remove the final 2FA protection if 2FA is active!
        if (purpose === '2fa_disable' && is2FAActive && factor_type === 'password') {
            return res.status(403).json({
                status: 'error',
                message: 'For your security, your account password alone cannot be used to turn off two-factor authentication. Please verify using an enrolled authentication method or recovery code.'
            });
        }

        // 1-minute countdown rate limit per resend for OTP security transactions
        if (factor_type === 'email' || factor_type === 'sms') {
            const [recentTx] = await pool.query(
                'SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) as elapsed FROM security_transactions WHERE user_id = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1',
                [userId, purpose]
            );
            if (recentTx.length > 0 && recentTx[0].elapsed !== null && recentTx[0].elapsed < 60) {
                const waitSeconds = 60 - recentTx[0].elapsed;
                return res.status(429).json({
                    status: 'error',
                    message: `Please wait ${waitSeconds} seconds before requesting a new code.`,
                    retryAfter: waitSeconds
                });
            }
        }

        // Cancel previous pending transactions of the same user & purpose
        await pool.query(
            "UPDATE security_transactions SET status = 'cancelled' WHERE user_id = ? AND purpose = ? AND status = 'pending'",
            [userId, purpose]
        );

        const txId = crypto.randomUUID();
        const actorSessionId = req.user.session_id || req.user.sessionId || req.headers['x-session-id'] || null;

        let codeHash = null;
        let finalDestination = null;
        let destinationMasked = null;

        if (factor_type === 'email') {
            if (purpose === '2fa_email_alternate') {
                if (!destination || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination.trim())) {
                    return res.status(400).json({ status: 'error', message: 'A valid email address is required.' });
                }
                finalDestination = destination.trim().toLowerCase();
            } else {
                finalDestination = user.security_recovery_email || user.email;
                if (!finalDestination) {
                    return res.status(400).json({ status: 'error', message: 'No email address found for this account.' });
                }
            }

            const code = generateOTP();
            codeHash = await hashOTP(code);

            const [local, domain] = finalDestination.split('@');
            destinationMasked = `${local.slice(0, 1)}•••••@${domain}`;

            // Insert transaction
            await pool.query(
                `INSERT INTO security_transactions 
                 (transaction_id, user_id, purpose, destination, otp_hash, expires_at, actor_session_id)
                 VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), ?)`,
                [txId, userId, purpose, finalDestination, codeHash, actorSessionId]
            );

            logger.info(`[SECURITY TX] Email OTP for tx ${txId} (${finalDestination}): ${code}`);

            // Send Email OTP
            let purposeDesc = 'Use the code below to complete your security verification.';
            if (purpose === '2fa_disable') purposeDesc = 'Use the code below to verify your request to turn off two-factor authentication.';
            if (purpose === 'password_change') purposeDesc = 'Use the code below to verify your identity before changing your password.';
            if (purpose === 'pin_reset') purposeDesc = 'Use the code below to verify your identity to reset your App Lock PIN.';
            if (purpose === '2fa_email_alternate') purposeDesc = 'Use the code below to verify this email address for Sparkle two-factor authentication.';

            await emailService.send({
                to: finalDestination,
                subject: 'Sparkle Security Verification Code',
                templateName: '2fa-otp',
                templateData: {
                    name: user.name || 'Sparkle User',
                    code: code,
                    purpose: purposeDesc
                }
            });

        } else if (factor_type === 'sms') {
            if (!user.phone_number) {
                return res.status(400).json({ status: 'error', message: 'No phone number linked to your account.' });
            }
            if (!infobipService.isConfigured()) {
                return res.status(503).json({ status: 'error', message: 'SMS verification is currently unavailable. Please use email or recovery codes.' });
            }

            const code = generateOTP();
            codeHash = await hashOTP(code);
            finalDestination = user.phone_number;
            const cleaned = finalDestination.replace(/\D/g, '');
            destinationMasked = '•'.repeat(Math.max(0, cleaned.length - 2)) + cleaned.slice(-2);

            await pool.query(
                `INSERT INTO security_transactions 
                 (transaction_id, user_id, purpose, destination, otp_hash, expires_at, actor_session_id)
                 VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), ?)`,
                [txId, userId, purpose, finalDestination, codeHash, actorSessionId]
            );

            logger.info(`[SECURITY TX] SMS OTP for tx ${txId} (${finalDestination}): ${code}`);
            await sendSMS(user.phone_number, code);

        } else if (factor_type === 'recovery_code') {
            let backupCodes = [];
            if (user.two_factor_backup_codes) {
                try {
                    backupCodes = typeof user.two_factor_backup_codes === 'string'
                        ? JSON.parse(user.two_factor_backup_codes)
                        : user.two_factor_backup_codes;
                } catch (err) {
                    logger.warn(`initiateSecurityTransaction: recovery_code backup codes JSON.parse failed for tx ${txId} user ${userId}`, err?.message || err);
                }
            }
            if (!Array.isArray(backupCodes) || backupCodes.length === 0) {
                return res.status(400).json({ status: 'error', message: 'No recovery codes are available on this account.' });
            }

            await pool.query(
                `INSERT INTO security_transactions 
                 (transaction_id, user_id, purpose, expires_at, actor_session_id)
                 VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), ?)`,
                [txId, userId, purpose, actorSessionId]
            );

        } else if (factor_type === 'password') {
            await pool.query(
                `INSERT INTO security_transactions 
                 (transaction_id, user_id, purpose, expires_at, actor_session_id)
                 VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), ?)`,
                [txId, userId, purpose, actorSessionId]
            );
        }

        await recordSecurityEvent(userId, 'security_transaction_initiated', { purpose, factor_type }, req, { sessionId: actorSessionId });

        res.json({
            status: 'success',
            data: {
                transaction_id: txId,
                purpose,
                factor_type,
                destination_masked: destinationMasked,
                expires_in: 600
            }
        });
    } catch (err) {
        logger.error('Initiate security transaction error:', err);
        res.status(500).json({ status: 'error', message: 'Failed to initiate security verification.' });
    }
};

/**
 * POST /api/security/transaction/verify
 * Validates the factor provided for a pending security transaction and issues a single-use verification token.
 */
const verifySecurityTransaction = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { transaction_id, code, factor_type } = req.body;

        if (!transaction_id || !code) {
            return res.status(400).json({ status: 'error', message: 'Transaction ID and verification code are required.' });
        }

        const [txRows] = await pool.query(
            `SELECT transaction_id, user_id, purpose, destination, otp_hash, attempt_count, max_attempts,
                    TIMESTAMPDIFF(SECOND, NOW(), expires_at) AS seconds_left
             FROM security_transactions
             WHERE transaction_id = ? AND user_id = ? AND status = 'pending' LIMIT 1`,
            [transaction_id, userId]
        );

        if (!txRows || txRows.length === 0) {
            return res.status(400).json({ status: 'error', message: 'Security transaction is invalid or has already been used.' });
        }

        const tx = txRows[0];

        if (tx.seconds_left <= 0) {
            await pool.query("UPDATE security_transactions SET status = 'expired' WHERE transaction_id = ?", [tx.transaction_id]);
            return res.status(400).json({ status: 'error', message: 'Verification transaction has expired. Please try again.' });
        }

        if (tx.attempt_count >= tx.max_attempts) {
            await pool.query("UPDATE security_transactions SET status = 'cancelled' WHERE transaction_id = ?", [tx.transaction_id]);
            return res.status(429).json({ status: 'error', message: 'Too many failed verification attempts. Transaction has been cancelled.' });
        }

        let isMatch = false;

        if (tx.otp_hash) {
            // Email or SMS OTP check
            isMatch = await verifyOTPHash(code.trim(), tx.otp_hash);
        } else if (factor_type === 'recovery_code') {
            // Check against stored backup codes
            const [userRows] = await pool.query(
                'SELECT two_factor_backup_codes FROM users WHERE user_id = ? LIMIT 1',
                [userId]
            );
            if (userRows.length > 0 && userRows[0].two_factor_backup_codes) {
                let codes = [];
                try {
                    codes = typeof userRows[0].two_factor_backup_codes === 'string'
                        ? JSON.parse(userRows[0].two_factor_backup_codes)
                        : userRows[0].two_factor_backup_codes;
                } catch (err) {
                    logger.error(`verifySecurityTransaction: recovery_code backup codes JSON.parse failed for tx ${transaction_id} user ${userId} — verification cannot match codes`, err?.message || err);
                }

                const normalizedInput = code.trim().toUpperCase().replace(/[\s-]/g, '');
                let matchedIndex = -1;

                for (let i = 0; i < codes.length; i++) {
                    const candidate = codes[i];
                    // Stored code could be bcrypt hash or legacy string
                    if (candidate.startsWith('$2a$') || candidate.startsWith('$2b$')) {
                        // Compare normalized
                        // Also try formatted (XXXXX-XXXXX) if length is 10
                        let formattedInput = normalizedInput;
                        if (normalizedInput.length === 10) {
                            formattedInput = `${normalizedInput.slice(0, 5)}-${normalizedInput.slice(5)}`;
                        }
                        const matched = (await bcrypt.compare(normalizedInput, candidate)) ||
                                        (await bcrypt.compare(formattedInput, candidate));
                        if (matched) {
                            matchedIndex = i;
                            break;
                        }
                    } else if (candidate.replace(/[\s-]/g, '').toUpperCase() === normalizedInput) {
                        matchedIndex = i;
                        break;
                    }
                }

                if (matchedIndex !== -1) {
                    isMatch = true;
                    // SINGLE USE: Burn the used recovery code immediately!
                    codes.splice(matchedIndex, 1);
                    await pool.query(
                        'UPDATE users SET two_factor_backup_codes = ? WHERE user_id = ?',
                        [JSON.stringify(codes), userId]
                    );
                    await recordSecurityEvent(userId, 'recovery_code_consumed', { remaining: codes.length }, req);
                }
            }
        } else {
            // Password check
            const [userRows] = await pool.query(
                'SELECT password_hash FROM users WHERE user_id = ? LIMIT 1',
                [userId]
            );
            if (userRows.length > 0 && userRows[0].password_hash) {
                isMatch = await bcrypt.compare(code, userRows[0].password_hash);
            }
        }

        if (!isMatch) {
            await pool.query(
                'UPDATE security_transactions SET attempt_count = attempt_count + 1 WHERE transaction_id = ?',
                [tx.transaction_id]
            );
            const remaining = tx.max_attempts - (tx.attempt_count + 1);
            return res.status(400).json({
                status: 'error',
                message: `Verification code or credential was incorrect. ${remaining > 0 ? remaining + ' attempts remaining.' : 'Transaction locked.'}`
            });
        }

        // Generate high-entropy single-use authorization token
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        await pool.query(
            `UPDATE security_transactions 
             SET status = 'verified',
                 verification_token = ?,
                 token_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE),
                 verified_at = NOW()
             WHERE transaction_id = ?`,
            [tokenHash, tx.transaction_id]
        );

        await recordSecurityEvent(userId, 'security_transaction_verified', { purpose: tx.purpose }, req);

        res.json({
            status: 'success',
            data: {
                verification_token: rawToken,
                purpose: tx.purpose,
                message: 'Identity verified successfully.'
            }
        });
    } catch (err) {
        logger.error('Verify security transaction error:', err);
        res.status(500).json({ status: 'error', message: 'Verification processing failed.' });
    }
};

/**
 * POST /api/security/2fa/disable
 * Disables 2FA using a verified security transaction token.
 * Password alone is rejected if 2FA was active.
 */
const disable2FAWithToken = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { verification_token } = req.body;

        if (!verification_token) {
            return res.status(400).json({ status: 'error', message: 'Verification token is required.' });
        }

        const tokenHash = crypto.createHash('sha256').update(verification_token).digest('hex');

        const [txRows] = await pool.query(
            `SELECT transaction_id, purpose, TIMESTAMPDIFF(SECOND, NOW(), token_expires_at) AS seconds_left
             FROM security_transactions
             WHERE verification_token = ? AND user_id = ? AND status = 'verified' AND purpose = '2fa_disable' LIMIT 1`,
            [tokenHash, userId]
        );

        if (!txRows || txRows.length === 0 || txRows[0].seconds_left <= 0) {
            return res.status(401).json({ status: 'error', message: 'Verification token has expired or is invalid. Please verify again.' });
        }

        const tx = txRows[0];

        // Consume transaction
        await pool.query(
            "UPDATE security_transactions SET status = 'consumed', consumed_at = NOW() WHERE transaction_id = ?",
            [tx.transaction_id]
        );

        // Disable 2FA
        await pool.query(
            `UPDATE users SET 
                email_2fa_enabled = 0, 
                email_2fa_verified_at = NULL,
                sms_2fa_enabled = 0, 
                sms_2fa_verified_at = NULL,
                two_factor_enabled = 0, 
                two_factor_secret = NULL,
                two_factor_backup_codes = NULL
             WHERE user_id = ?`,
            [userId]
        );

        await pool.query('DELETE FROM otp_verifications WHERE user_id = ?', [userId]);

        const [userRows] = await pool.query('SELECT email, name FROM users WHERE user_id = ? LIMIT 1', [userId]);
        const user = userRows[0] || {};

        await recordSecurityEvent(userId, '2fa_turned_off', {}, req);
        await sendSecurityNotification(
            userId,
            'Two-factor authentication turned off',
            'Two-factor authentication has been removed from your Sparkle account.',
            '/settings/security'
        );

        await sendSecurityEmailAlert(
            user,
            'Security Alert: Two-factor authentication turned off',
            'Two-factor authentication was turned off on your Sparkle account.',
            "If you did not make this change, please secure your account immediately and reset your password.",
            req
        );

        res.json({
            status: 'success',
            message: 'Two-factor authentication has been turned off.'
        });
    } catch (err) {
        logger.error('Disable 2FA with token error:', err);
        res.status(500).json({ status: 'error', message: 'Failed to turn off two-factor authentication.' });
    }
};

/**
 * POST /api/security/password/change
 * Changes account password using a verified security transaction token.
 * Triggers interruptive realtime alert to other active sessions.
 */
const changePasswordWithToken = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { verification_token, new_password } = req.body;

        if (!verification_token || !new_password) {
            return res.status(400).json({ status: 'error', message: 'Verification token and new password are required.' });
        }

        if (new_password.length < 8) {
            return res.status(400).json({ status: 'error', message: 'New password must be at least 8 characters.' });
        }

        const tokenHash = crypto.createHash('sha256').update(verification_token).digest('hex');

        const [txRows] = await pool.query(
            `SELECT transaction_id, purpose, actor_session_id, TIMESTAMPDIFF(SECOND, NOW(), token_expires_at) AS seconds_left
             FROM security_transactions
             WHERE verification_token = ? AND user_id = ? AND status = 'verified' AND purpose = 'password_change' LIMIT 1`,
            [tokenHash, userId]
        );

        if (!txRows || txRows.length === 0 || txRows[0].seconds_left <= 0) {
            return res.status(401).json({ status: 'error', message: 'Security authorization has expired or is invalid. Please verify again.' });
        }

        const tx = txRows[0];

        // Consume token
        await pool.query(
            "UPDATE security_transactions SET status = 'consumed', consumed_at = NOW() WHERE transaction_id = ?",
            [tx.transaction_id]
        );

        // Hash and update password
        const hashedPassword = await bcrypt.hash(new_password, 10);
        await pool.query(
            'UPDATE users SET password_hash = ?, password_changed_at = NOW() WHERE user_id = ?',
            [hashedPassword, userId]
        );

        const actorSessionId = tx.actor_session_id || req.user.session_id || req.user.sessionId || req.headers['x-session-id'] || 'current';
        const eventId = crypto.randomUUID();

        // Record interruptive security event
        await recordSecurityEvent(
            userId,
            'password_changed',
            { actor_session_id: actorSessionId },
            req,
            { eventId, sessionId: actorSessionId, isInterruptive: true }
        );

        // Fetch user for notifications
        const [userRows] = await pool.query('SELECT email, name FROM users WHERE user_id = ? LIMIT 1', [userId]);
        const user = userRows[0] || {};

        // In-app notification
        await sendSecurityNotification(
            userId,
            'Your password was changed',
            'Your Sparkle account password was successfully updated.',
            '/settings/security'
        );

        // Send email alert
        await sendSecurityEmailAlert(
            user,
            'Your Sparkle password was changed',
            'Your Sparkle account password was changed.',
            "If you made this change, you can safely disregard this email. If you did NOT change your password, please secure your account immediately.",
            req
        );

        // Realtime Socket.IO Broadcast to all user sessions
        try {
            const socketModule = require('../socket');
            if (typeof socketModule.emitSecurityAlert === 'function') {
                socketModule.emitSecurityAlert(userId, {
                    event_id: eventId,
                    event_type: 'password_changed',
                    actor_session_id: actorSessionId,
                    time: new Date().toISOString(),
                    ip_address: req.ip || null,
                    user_agent: req.headers['user-agent'] || null
                });
            }
        } catch (socketErr) {
            logger.warn('Socket alert broadcast error:', socketErr.message);
        }

        res.json({
            status: 'success',
            message: 'Password changed successfully.'
        });
    } catch (err) {
        logger.error('Change password error:', err);
        res.status(500).json({ status: 'error', message: 'Failed to update password.' });
    }
};

/**
 * POST /api/security/pin/reset-token
 * Issues a short-lived single-use authorization token for local App Lock PIN reset.
 */
const generatePinResetToken = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { verification_token } = req.body;

        if (!verification_token) {
            return res.status(400).json({ status: 'error', message: 'Verification token is required.' });
        }

        const tokenHash = crypto.createHash('sha256').update(verification_token).digest('hex');

        const [txRows] = await pool.query(
            `SELECT transaction_id, TIMESTAMPDIFF(SECOND, NOW(), token_expires_at) AS seconds_left
             FROM security_transactions
             WHERE verification_token = ? AND user_id = ? AND status = 'verified' AND purpose = 'pin_reset' LIMIT 1`,
            [tokenHash, userId]
        );

        if (!txRows || txRows.length === 0 || txRows[0].seconds_left <= 0) {
            return res.status(401).json({ status: 'error', message: 'Verification has expired or is invalid.' });
        }

        await pool.query(
            "UPDATE security_transactions SET status = 'consumed', consumed_at = NOW() WHERE transaction_id = ?",
            [txRows[0].transaction_id]
        );

        const resetAuthToken = crypto.randomBytes(24).toString('hex');
        await recordSecurityEvent(userId, 'app_pin_reset_authorized', {}, req);

        res.json({
            status: 'success',
            data: {
                reset_auth_token: resetAuthToken,
                message: 'PIN reset authorization granted.'
            }
        });
    } catch (err) {
        logger.error('Generate PIN reset token error:', err);
        res.status(500).json({ status: 'error', message: 'Failed to authorize PIN reset.' });
    }
};

/**
 * POST /api/security/2fa/alternate-email/request
 * Initiates enrollment of an alternate security/recovery email for 2FA.
 */
const requestAlternateEmail2FA = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { email } = req.body;

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return res.status(400).json({ status: 'error', message: 'A valid email address is required.' });
        }

        const cleanEmail = email.trim().toLowerCase();
        const code = generateOTP();
        const codeHash = await hashOTP(code);
        const txId = crypto.randomUUID();

        // Invalidate older alternate email transactions
        await pool.query(
            "UPDATE security_transactions SET status = 'cancelled' WHERE user_id = ? AND purpose = '2fa_email_alternate' AND status = 'pending'",
            [userId]
        );

        await pool.query(
            `INSERT INTO security_transactions 
             (transaction_id, user_id, purpose, destination, otp_hash, expires_at)
             VALUES (?, ?, '2fa_email_alternate', ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
            [txId, userId, cleanEmail, codeHash]
        );

        logger.info(`[SECURITY 2FA] Alternate email OTP for user ${userId} (${cleanEmail}): ${code}`);

        const [userRows] = await pool.query('SELECT name FROM users WHERE user_id = ? LIMIT 1', [userId]);
        const userName = userRows[0]?.name || 'Sparkle User';

        await emailService.send({
            to: cleanEmail,
            subject: 'Sparkle Security Email Verification Code',
            templateName: '2fa-otp',
            templateData: {
                name: userName,
                code: code,
                purpose: 'Use the code below to verify this alternate email address for Sparkle two-factor authentication.'
            }
        });

        await recordSecurityEvent(userId, '2fa_alternate_email_requested', { email: cleanEmail }, req);

        res.json({
            status: 'success',
            data: {
                transaction_id: txId,
                destination: cleanEmail,
                expires_in: 600,
                message: 'Verification code sent to your alternate email address.'
            }
        });
    } catch (err) {
        logger.error('Request alternate email 2FA error:', err);
        res.status(500).json({ status: 'error', message: 'Failed to send verification code.' });
    }
};

/**
 * POST /api/security/2fa/alternate-email/verify
 * Confirms OTP for alternate security email and enables it for 2FA.
 */
const verifyAlternateEmail2FA = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { transaction_id, code } = req.body;

        if (!transaction_id || !code) {
            return res.status(400).json({ status: 'error', message: 'Transaction ID and verification code are required.' });
        }

        const [txRows] = await pool.query(
            `SELECT transaction_id, destination, otp_hash, attempt_count, max_attempts,
                    TIMESTAMPDIFF(SECOND, NOW(), expires_at) AS seconds_left
             FROM security_transactions
             WHERE transaction_id = ? AND user_id = ? AND purpose = '2fa_email_alternate' AND status = 'pending' LIMIT 1`,
            [transaction_id, userId]
        );

        if (!txRows || txRows.length === 0 || txRows[0].seconds_left <= 0) {
            return res.status(400).json({ status: 'error', message: 'Verification request has expired. Please try again.' });
        }

        const tx = txRows[0];

        if (tx.attempt_count >= tx.max_attempts) {
            await pool.query("UPDATE security_transactions SET status = 'cancelled' WHERE transaction_id = ?", [tx.transaction_id]);
            return res.status(429).json({ status: 'error', message: 'Too many attempts. Request cancelled.' });
        }

        const isValid = await verifyOTPHash(code.trim(), tx.otp_hash);
        if (!isValid) {
            await pool.query(
                'UPDATE security_transactions SET attempt_count = attempt_count + 1 WHERE transaction_id = ?',
                [tx.transaction_id]
            );
            return res.status(400).json({ status: 'error', message: 'The verification code is incorrect.' });
        }

        // Mark consumed
        await pool.query(
            "UPDATE security_transactions SET status = 'consumed', consumed_at = NOW(), verified_at = NOW() WHERE transaction_id = ?",
            [tx.transaction_id]
        );

        // Update user record with alternate security email
        await pool.query(
            `UPDATE users SET 
                security_recovery_email = ?,
                email_2fa_enabled = 1,
                email_2fa_verified_at = NOW()
             WHERE user_id = ?`,
            [tx.destination, userId]
        );

        await recordSecurityEvent(userId, '2fa_alternate_email_enabled', { email: tx.destination }, req);
        await sendSecurityNotification(
            userId,
            'Security recovery email verified',
            `Your security email (${tx.destination}) is now active for two-factor authentication.`,
            '/settings/security'
        );

        res.json({
            status: 'success',
            message: 'Alternate email verified and enabled for two-factor authentication.'
        });
    } catch (err) {
        logger.error('Verify alternate email error:', err);
        res.status(500).json({ status: 'error', message: 'Failed to verify alternate email.' });
    }
};

/**
 * GET /api/security/alerts/unacknowledged
 * Fetches critical interruptive security events (e.g. password changed elsewhere) that need client attention.
 */
const getUnacknowledgedSecurityAlerts = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const currentSessionId = req.user.session_id || req.user.sessionId || req.headers['x-session-id'] || null;

        const [rows] = await pool.query(
            `SELECT event_id, event_type, details, ip_address, user_agent, session_id, created_at
             FROM security_events
             WHERE user_id = ? AND is_interruptive = 1 AND acknowledged_at IS NULL
             ORDER BY created_at DESC LIMIT 5`,
            [userId]
        );

        // Filter out events that were initiated by the current session
        const filtered = rows.filter(r => {
            if (currentSessionId && r.session_id && r.session_id === currentSessionId) {
                return false;
            }
            return true;
        });

        res.json({
            status: 'success',
            data: {
                alerts: filtered
            }
        });
    } catch (err) {
        logger.error('Get unacknowledged alerts error:', err);
        res.status(500).json({ status: 'error', message: 'Failed to load security alerts.' });
    }
};

/**
 * POST /api/security/alerts/:eventId/acknowledge
 * Acknowledges a critical security alert so it won't interrupt the user again.
 */
const acknowledgeSecurityAlert = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { eventId } = req.params;

        if (!eventId) {
            return res.status(400).json({ status: 'error', message: 'Event ID is required.' });
        }

        await pool.query(
            'UPDATE security_events SET acknowledged_at = NOW() WHERE event_id = ? AND user_id = ?',
            [eventId, userId]
        );

        res.json({ status: 'success', message: 'Security alert acknowledged.' });
    } catch (err) {
        logger.error('Acknowledge security alert error:', err);
        res.status(500).json({ status: 'error', message: 'Failed to acknowledge alert.' });
    }
};

module.exports = {
    getSecurityStatus,
    getAvailableFactors,
    initiateSecurityTransaction,
    verifySecurityTransaction,
    disable2FAWithToken,
    changePasswordWithToken,
    generatePinResetToken,
    requestAlternateEmail2FA,
    verifyAlternateEmail2FA,
    getUnacknowledgedSecurityAlerts,
    acknowledgeSecurityAlert,
    requestEmail2FA,
    verifyEmail2FA,
    disableEmail2FA,
    requestSMS2FA,
    verifySMS2FA,
    disableSMS2FA,
    disableAll2FA,
    generateRecoveryCodes
};

