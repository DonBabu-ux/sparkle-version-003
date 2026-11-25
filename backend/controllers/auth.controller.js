// controllers/auth.controller.js - PRODUCTION VERSION
const { query, queryOne } = require('../utils/database/query');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const { JWT_SECRET } = require('../config/constants');
const crypto = require('crypto');
const { downloadExternalImage } = require('../utils/media.utils');
const logger = require('../utils/logger');
const { clientError } = require('../utils/serverError');
const { sendEmail, templates } = require('../config/email');
const { sendSMS } = require('../utils/sms');
const authService = require('../services/auth.service');
const emailService = require('../services/email.service');
const accountLifecycleService = require('../services/accountLifecycle.service');

// Helper to sanitize avatars - MOVED TO USER MODEL
const getSafeAvatarUrl = (url) => User.getSafeAvatarUrl(url);

// Validate JWT secret
const validateJWTSecret = () => {
    if (!JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured');
    }
    return true;
};

const signup = async (req, res) => {
  try {
    const deviceId = req.headers['x-device-id'] || 'signup-device';
    const result = await authService.signup(req.body, deviceId);
    // Service returns full response payload
    res.status(201).json(result);
  } catch (error) {
    if (error.validationErrors) {
      return res.status(400).json({ status: 'error', errors: error.validationErrors });
    }
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ status: 'error', message: 'User with this email or username already exists' });
    }
    logger.error('Signup Critical Error:', {
      error: error.message,
      stack: error.stack,
      body: { ...req.body, password: '***' }
    });
    res.status(500).json({ status: 'error', message: 'Failed to create account. Please try again later.' });
  }
};

const login = async (req, res) => {
    try {
        const { username: loginId, password, rememberMe } = req.body;

        if (!loginId || !password) {
            return res.status(400).json({
                success: false,
                status: 'error',
                code: 'INVALID_REQUEST',
                message: 'Username or email and password are required.'
            });
        }

        validateJWTSecret();

        const ip = req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress;
        
        const { normalizeUsername } = require('../utils/validation/username');
        const normLoginId = normalizeUsername(loginId);
        const cleanEmail = String(loginId).trim().toLowerCase();

        // UNION ALL lets MySQL/MariaDB use a separate index per column instead of
        // doing a full table scan with OR across 3 columns (~8s → <10ms).
        // Each branch MUST be wrapped in () for MariaDB LIMIT-per-branch syntax.
        const user = await queryOne(
            `(SELECT * FROM users WHERE email = ? LIMIT 1)
             UNION ALL
             (SELECT * FROM users WHERE username_normalized = ? AND email != ? LIMIT 1)
             UNION ALL
             (SELECT * FROM users WHERE username = ? AND username_normalized != ? AND email != ? LIMIT 1)
             LIMIT 1`,
            [cleanEmail, normLoginId, cleanEmail, loginId, normLoginId, cleanEmail]
        );

        // Core security principle: Prevent account enumeration with constant-time dummy compare
        if (!user) {
            await bcrypt.compare(password, '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
            return res.status(401).json({
                success: false,
                status: 'error',
                code: 'INVALID_CREDENTIALS',
                message: 'Incorrect email or password. Please check your details and try again.'
            });
        }

        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        
        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                status: 'error',
                code: 'INVALID_CREDENTIALS',
                message: 'Incorrect email or password. Please check your details and try again.'
            });
        }

        // Account status checks (Suspended, Terminated, Pending Deletion, Disabled, Locked)
        if (user.account_status) {
            const statusLower = String(user.account_status).trim().toLowerCase();
            if (statusLower === 'suspended') {
                return res.status(403).json({
                    success: false,
                    status: 'error',
                    code: 'ACCOUNT_SUSPENDED',
                    message: 'This account is currently suspended. If this was a temporary self-suspension, you can reactivate your account.',
                    canReactivate: user.suspended_by === 'self' || !user.suspended_by
                });
            }
            if (statusLower === 'terminated') {
                return res.status(403).json({
                    success: false,
                    status: 'error',
                    code: 'ACCOUNT_TERMINATED',
                    message: 'This Sparkle account has been terminated and access is no longer available. If you believe this action was made in error, review the available recovery or appeal options.'
                });
            }
            if (statusLower === 'pending_deletion') {
                return res.status(403).json({
                    success: false,
                    status: 'error',
                    code: 'ACCOUNT_PENDING_DELETION',
                    message: 'This account is scheduled for deletion. You can cancel deletion within the 30-day grace period to restore access.',
                    scheduledAt: user.deletion_scheduled_at,
                    canCancel: true
                });
            }
            if (statusLower === 'deleted') {
                return res.status(403).json({
                    success: false,
                    status: 'error',
                    code: 'ACCOUNT_DELETED',
                    message: 'This account has been permanently deleted.'
                });
            }
            if (statusLower === 'disabled' || statusLower === 'deactivated') {
                return res.status(403).json({
                    success: false,
                    status: 'error',
                    code: 'ACCOUNT_DISABLED',
                    message: 'This account is currently unavailable. Please contact Sparkle Support for assistance.'
                });
            }
            if (statusLower === 'locked') {
                return res.status(423).json({
                    success: false,
                    status: 'error',
                    code: 'ACCOUNT_LOCKED',
                    message: 'For your security, sign-in has been temporarily restricted. Please follow the recovery options to regain access.'
                });
            }
        }


        // --- Check for 2FA (Email, SMS, or Authenticator) ---
        // Only require 2FA if an active factor is genuinely configured.
        // For TOTP authenticator, a secret MUST exist. If no factor is enabled, bypass 2FA directly.
        const hasTOTP = !!(user.two_factor_enabled && user.two_factor_secret);
        const has2FA = !!(user.email_2fa_enabled || user.sms_2fa_enabled || hasTOTP);
        if (has2FA) {
            let channel = 'email';
            // Wire 2FA destination to alternate security help email if configured, falling back to account email
            let destination = user.security_recovery_email || user.email;

            if (user.email_2fa_enabled) {
                channel = 'email';
                destination = user.security_recovery_email || user.email;
            } else if (user.sms_2fa_enabled && user.phone_number) {
                channel = 'sms';
                destination = user.phone_number;
            } else if (hasTOTP) {
                channel = 'authenticator';
            }

            if (channel === 'email' || channel === 'sms') {
                const otpCode = crypto.randomInt(100000, 999999).toString();
                const codeHash = await bcrypt.hash(otpCode, 10);

                await query(
                    'DELETE FROM otp_verifications WHERE user_id = ? AND channel = ? AND verified_at IS NULL',
                    [user.user_id, channel]
                );

                await query(
                    'INSERT INTO otp_verifications (verification_id, user_id, channel, destination, code_hash, expires_at) VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))',
                    [crypto.randomUUID(), user.user_id, channel, destination, codeHash]
                );

                logger.info('[LOGIN 2FA] OTP generated for user ' + user.username + ' (' + channel + ')');

                if (channel === 'email') {
                    try {
                        await emailService.send({
                            to: destination,
                            subject: 'Your Sparkle Login Verification Code',
                            templateName: '2fa-otp',
                            templateData: {
                                name: user.name || user.username,
                                code: otpCode,
                                purpose: 'Use the code below to log in to your Sparkle account.'
                            }
                        });
                    } catch (e) {
                        logger.error('Failed to send login 2FA email:', e);
                    }
                } else if (channel === 'sms' && user.phone_number) {
                    try {
                        await sendSMS(user.phone_number, otpCode);
                    } catch (e) {
                        logger.error('Failed to send login 2FA SMS:', e);
                    }
                }
            }

            const mask = (str) => {
                if (!str) return '***';
                if (str.includes('@')) {
                    const [l, d] = str.split('@');
                    return `${l[0]}***@${d}`;
                }
                return `***${str.slice(-4)}`;
            };

            return res.json({
                status: 'requires_2fa',
                userId: user.user_id,
                channel: channel,
                destination: mask(destination),
                message: channel === 'authenticator'
                    ? 'Enter the 6-digit code from your authenticator app, or use a recovery backup code.'
                    : `Enter the 6-digit code sent to ${mask(destination)}, or use a recovery backup code.`,
                rememberMe: !!rememberMe
            });
        }

        const deviceId = req.headers['x-device-id'] || 'unknown';
        // Generate production-grade tokens via service
        const { accessToken, refreshToken } = await authService.generateTokens(user, deviceId);

        // Track activity (optional, but good for security)
        const { isNewDevice } = await authService.trackLoginActivity(user.user_id, {
            deviceId,
            ipAddress: ip,
            userAgent: req.headers['user-agent']
        });

        // CREATE SESSION RECORD (powers Device Logins in Settings)
        const sessionId = crypto.randomUUID();
        const userAgent = req.headers['user-agent'] || 'Unknown Device';
        try {
            await query(
                'INSERT INTO user_sessions (session_id, user_id, device_name, ip_address) VALUES (?, ?, ?, ?)',
                [sessionId, user.user_id, userAgent, ip]
            );
            // Opportunistic cleanup: keep each user's session list bounded
            await query(
                'DELETE FROM user_sessions WHERE user_id = ? AND last_active < DATE_SUB(NOW(), INTERVAL 7 DAY)',
                [user.user_id]
            );
        } catch (sessionErr) {
            logger.warn('Failed to create user_sessions row on login: ' + (sessionErr?.message || sessionErr));
        }

        if (isNewDevice) {
            // Trigger security alert email (non-blocking)
            sendEmail({
                to: user.email,
                ...templates.securityAlert(user.name, {
                    ipAddress: ip,
                    userAgent: req.headers['user-agent'] || 'Unknown',
                    time: new Date().toLocaleString()
                })
            }).catch(err => logger.error('Failed to send security alert:', err));
        }

        const cookieMaxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
        res.cookie('sparkleToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: cookieMaxAge,
            path: '/'
        });

        const isOnboarded = user.onboarding_step >= 6;
        res.json({
            success: true,
            status: 'success',
            token: accessToken,
            refreshToken: refreshToken,
            sessionId,
            user: {
                id: user.user_id,
                user_id: user.user_id,
                name: user.name,
                username: user.username,
                email: user.email,
                email_verified: user.email_verified === 1,
                phone_verified: user.phone_verified === 1,
                avatar_url: getSafeAvatarUrl(user.avatar_url),
                onboarding_step: user.onboarding_step ?? 0,
                // C1 Ghost Mode: expose initial visibility so Settings seeds correctly
                is_hidden: user.is_hidden === 1,
                loggedIn: true,
                isNewDevice // Frontend can use this to show a "New device detected" message
            },
            next: isOnboarded 
                ? { route: '/home', reason: 'READY' }
                : { route: '/onboarding', reason: 'ONBOARDING_REQUIRED' }
        });

    } catch (error) {
        const requestId = 'SPK-' + crypto.randomBytes(3).toString('hex').toUpperCase();
        logger.error('Login Critical Error:', {
            requestId,
            error: error.message,
            stack: error.stack,
            body: { ...req.body, password: '***' },
            ip: req.ip
        });
        res.status(500).json({ 
            success: false,
            status: 'error', 
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Something went wrong on our side. Please try again shortly.', 
            requestId
        });
    }
};

const verify2FA = async (req, res) => {
    try {
        const { userId, code, rememberMe } = req.body;
        if (!userId || !code) {
            return res.status(400).json({ status: 'error', message: 'User ID and code are required' });
        }

        const users = await query('SELECT * FROM users WHERE user_id = ? LIMIT 1', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }

        const user = users[0];
        let verified = false;
        const cleanCode = code.toString().trim();
        const upperCode = cleanCode.toUpperCase();

        // 1. Check otp_verifications table (Email and SMS 2FA)
        const otpRecords = await query(
            `SELECT verification_id, code_hash, attempts, TIMESTAMPDIFF(SECOND, NOW(), expires_at) AS seconds_left
             FROM otp_verifications
             WHERE user_id = ? AND verified_at IS NULL
             ORDER BY created_at DESC LIMIT 5`,
            [userId]
        );

        if (Array.isArray(otpRecords)) {
            for (const rec of otpRecords) {
                if (rec.seconds_left > 0) {
                    // A 6-digit CSPRNG code against a 10-minute window. The
                    // column existed and was read, but never incremented or
                    // checked, so an attacker with an IP pool could brute-force
                    // the 10^6 space until they hit. Cap at 5 attempts, then
                    // void the code. No voided_at column exists, so verified_at
                    // is reused as the dead marker: the query above already
                    // filters on `verified_at IS NULL`, which means a voided
                    // code is already excluded from every later attempt.
                    if (Number(rec.attempts || 0) >= 5) {
                        await query(
                            'UPDATE otp_verifications SET verified_at = NOW() WHERE verification_id = ?',
                            [rec.verification_id]
                        );
                        continue;
                    }
                    const match = await bcrypt.compare(cleanCode, rec.code_hash);
                    if (match) {
                        verified = true;
                        await query('UPDATE otp_verifications SET verified_at = NOW() WHERE verification_id = ?', [rec.verification_id]);
                        break;
                    }
                    await query(
                        'UPDATE otp_verifications SET attempts = attempts + 1 WHERE verification_id = ?',
                        [rec.verification_id]
                    );
                }
            }
        }

        // 2. Check legacy email_verifications table (for temporary login recovery codes)
        if (!verified) {
            const verifications = await query(
                'SELECT * FROM email_verifications WHERE user_id = ? AND code = ? AND TIMESTAMPDIFF(SECOND, NOW(), expires_at) > 0 AND verified_at IS NULL LIMIT 1',
                [userId, cleanCode]
            );

            if (verifications && verifications.length > 0) {
                verified = true;
                await query('UPDATE email_verifications SET verified_at = NOW() WHERE verification_id = ?', [verifications[0].verification_id]);
            }
        }

        // 3. Check permanent recovery backup codes (single-use, stored as bcrypt hashes or plaintext)
        if (!verified && user.two_factor_backup_codes) {
            let backupCodes = [];
            try {
                backupCodes = typeof user.two_factor_backup_codes === 'string' 
                    ? JSON.parse(user.two_factor_backup_codes) 
                    : user.two_factor_backup_codes;
            } catch (e) { backupCodes = []; }

            if (Array.isArray(backupCodes)) {
                for (let i = 0; i < backupCodes.length; i++) {
                    const stored = backupCodes[i];
                    let isMatch = false;

                    if (typeof stored === 'string') {
                        if (stored.startsWith('$2')) {
                            // Bcrypt hash from security centre
                            isMatch = await bcrypt.compare(upperCode, stored);
                        } else {
                            // Plaintext comparison
                            isMatch = stored.toUpperCase() === upperCode;
                        }
                    }

                    if (isMatch) {
                        verified = true;
                        // Single-use: burn used backup code immediately
                        backupCodes.splice(i, 1);
                        await query('UPDATE users SET two_factor_backup_codes = ? WHERE user_id = ?', [JSON.stringify(backupCodes), userId]);
                        logger.info(`[RECOVERY CODE VERIFIED] User ${user.user_id} authenticated via recovery code. Remaining: ${backupCodes.length}`);
                        break;
                    }
                }
            }
        }

        // 4. Fallback: Authenticator TOTP app
        if (!verified && user.two_factor_enabled && user.two_factor_secret) {
            verified = speakeasy.totp.verify({
                secret: user.two_factor_secret,
                encoding: 'base32',
                token: cleanCode
            });
        }

        if (!verified) {
            return res.status(401).json({ 
                success: false,
                status: 'error', 
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid or expired verification code or recovery code.' 
            });
        }

        // Token correct, issue token
        validateJWTSecret();
        const sessionDuration = rememberMe ? '30d' : '24h';
        const token = jwt.sign({ 
            userId: user.user_id, 
            email: user.email, 
            username: user.username,
            tokenVersion: user.token_version || 0
        }, JWT_SECRET, { expiresIn: sessionDuration });

        // CREATE SESSION RECORD
        const sessionId = crypto.randomBytes(16).toString('hex');
        const userAgent = req.headers['user-agent'] || 'Unknown Device';
        const ip = req.ip || req.connection.remoteAddress;

        await query(
            'INSERT INTO user_sessions (session_id, user_id, device_name, ip_address) VALUES (?, ?, ?, ?)',
            [sessionId, user.user_id, userAgent, ip]
        );

        const cookieMaxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
        res.cookie('sparkleToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: cookieMaxAge,
            path: '/'
        });

        res.json({
            status: 'success',
            token,
            sessionId,
            user: {
                id: user.user_id,
                user_id: user.user_id,
                name: user.name,
                username: user.username,
                email: user.email,
                email_verified: user.email_verified === 1,
                phone_verified: user.phone_verified === 1,
                avatar_url: getSafeAvatarUrl(user.avatar_url),
                // C1 Ghost Mode: expose initial visibility so Settings seeds correctly
                is_hidden: user.is_hidden === 1,
                loggedIn: true
            }
        });
    } catch (error) {
        console.error('Verify 2FA Error:', error);
        res.status(500).json({ status: 'error', message: 'Verification failed' });
    }
};

const request2FARecovery = async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ status: 'error', message: 'User ID is required' });

        const users = await query('SELECT user_id, name, email, security_recovery_email FROM users WHERE user_id = ? LIMIT 1', [userId]);
        if (users.length === 0) return res.status(404).json({ status: 'error', message: 'User not found' });

        const user = users[0];

        // 1-minute countdown rate limit per resend
        const recentRequest = await query(
            'SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) as elapsed FROM email_verifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [userId]
        );
        if (recentRequest.length > 0 && recentRequest[0].elapsed !== null && recentRequest[0].elapsed < 60) {
            const waitSeconds = 60 - recentRequest[0].elapsed;
            return res.status(429).json({
                status: 'error',
                message: `Please wait ${waitSeconds}s before requesting a new recovery code.`,
                retryAfter: waitSeconds
            });
        }

        const recoveryDestination = user.security_recovery_email || user.email;
        const recoveryCode = crypto.randomInt(100000, 999999).toString();

        await query(
            'INSERT INTO email_verifications (verification_id, user_id, email, code, expires_at, created_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE), NOW()) ON DUPLICATE KEY UPDATE code = VALUES(code), expires_at = DATE_ADD(NOW(), INTERVAL 15 MINUTE), verified_at = NULL, created_at = NOW()',
            [crypto.randomUUID(), userId, recoveryDestination, recoveryCode]
        );

        await sendEmail({
            to: recoveryDestination,
            subject: 'Your 2FA Recovery Code - Sparkle ✨',
            templateName: 'verify-email', // Reuse verification template
            templateData: {
                name: user.name,
                code: recoveryCode,
                message: 'Use this code to bypass your 2FA security check. It will expire in 15 minutes.',
                verifyUrl: `${process.env.APP_URL || 'https://sparklewebapp.vercel.app'}/login`
            }
        });

        res.json({ status: 'success', message: 'Recovery code sent to your verified recovery email!', cooldown: 60 });
    } catch (error) {
        logger.error('2FA Recovery Error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to send recovery code. Please try again.' });
    }
};

const resend2FA = async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ status: 'error', message: 'User ID is required' });

        const users = await query(
            'SELECT user_id, name, username, email, phone_number, security_recovery_email, email_2fa_enabled, sms_2fa_enabled, two_factor_enabled, two_factor_secret FROM users WHERE user_id = ? LIMIT 1',
            [userId]
        );
        if (users.length === 0) return res.status(404).json({ status: 'error', message: 'User not found' });

        const user = users[0];

        // 1-minute countdown rate limit per resend across otp_verifications
        const recentOTP = await query(
            'SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) as elapsed FROM otp_verifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [userId]
        );
        if (recentOTP.length > 0 && recentOTP[0].elapsed !== null && recentOTP[0].elapsed < 60) {
            const waitSeconds = 60 - recentOTP[0].elapsed;
            return res.status(429).json({
                status: 'error',
                message: `Please wait ${waitSeconds}s before requesting a new code.`,
                retryAfter: waitSeconds
            });
        }

        let channel = 'email';
        let destination = user.security_recovery_email || user.email;

        if (user.sms_2fa_enabled && user.phone_number) {
            channel = 'sms';
            destination = user.phone_number;
        } else if (user.email_2fa_enabled || (!user.sms_2fa_enabled && !user.two_factor_secret)) {
            channel = 'email';
            destination = user.security_recovery_email || user.email;
        } else {
            // Authenticator fallback
            channel = 'email';
            destination = user.security_recovery_email || user.email;
        }

        const otpCode = crypto.randomInt(100000, 999999).toString();
        const codeHash = await bcrypt.hash(otpCode, 10);

        await query(
            'DELETE FROM otp_verifications WHERE user_id = ? AND channel = ? AND verified_at IS NULL',
            [user.user_id, channel]
        );

        await query(
            'INSERT INTO otp_verifications (verification_id, user_id, channel, destination, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), NOW())',
            [crypto.randomUUID(), user.user_id, channel, destination, codeHash]
        );

        logger.info('[LOGIN 2FA] OTP generated for user ' + user.username + ' (' + channel + ')');

        if (channel === 'email') {
            await emailService.send({
                to: destination,
                subject: 'Your Sparkle Login Verification Code',
                templateName: '2fa-otp',
                templateData: {
                    name: user.name || user.username,
                    code: otpCode,
                    purpose: 'Use the code below to log in to your Sparkle account.'
                }
            });
        } else if (channel === 'sms' && user.phone_number) {
            await sendSMS(user.phone_number, otpCode);
        }

        const mask = (str) => {
            if (!str) return '***';
            if (str.includes('@')) {
                const [l, d] = str.split('@');
                return `${l[0]}***@${d}`;
            }
            return `***${str.slice(-4)}`;
        };

        return res.json({
            status: 'success',
            message: `Verification code sent to ${mask(destination)}.`,
            cooldown: 60
        });
    } catch (error) {
        logger.error('Resend 2FA Error:', error);
        return res.status(500).json({ status: 'error', message: 'Failed to resend verification code. Please try again.' });
    }
};


const verifyEmail = async (req, res) => {
    try {
        const { code, email: bodyEmail } = req.body;
        const authUserId = req.user?.user_id;

        if (!code) {
            return res.status(400).json({ status: 'error', message: 'Verification code is required' });
        }

        const cleanCode = String(code).trim();
        let targetEmail = bodyEmail ? String(bodyEmail).trim().toLowerCase() : null;

        if (!targetEmail && authUserId) {
            const u = await queryOne('SELECT email FROM users WHERE user_id = ? LIMIT 1', [authUserId]);
            targetEmail = u?.email;
        }

        if (!targetEmail) {
            return res.status(400).json({ status: 'error', message: 'Email address and verification code are required' });
        }

        const verifications = await query(
            'SELECT * FROM email_verifications WHERE (email = ? OR user_id = ?) AND code = ? AND expires_at > NOW() AND verified_at IS NULL ORDER BY created_at DESC LIMIT 1',
            [targetEmail, authUserId || '', cleanCode]
        );

        if (!verifications || verifications.length === 0) {
            return res.status(400).json({ status: 'error', message: 'Invalid or expired verification code' });
        }

        const verification = verifications[0];
        const userId = verification.user_id;

        // Mark verification record as verified
        await query('UPDATE email_verifications SET verified_at = NOW() WHERE verification_id = ?', [verification.verification_id]);
        await query('UPDATE users SET email_verified = 1, email_verified_at = NOW() WHERE user_id = ?', [userId]);

        // One-time verification reward (+25 Sparkle Points)
        let rewardAwarded = false;
        const rewardPoints = 25;
        const rewardId = crypto.randomUUID();

        try {
            // Atomic INSERT IGNORE on UNIQUE user_id constraint
            const insertResult = await query(
                'INSERT IGNORE INTO email_verification_rewards (id, user_id, points_awarded, status, created_at) VALUES (?, ?, ?, ?, NOW())',
                [rewardId, userId, rewardPoints, 'credited']
            );

            if (insertResult && (insertResult.affectedRows === 1 || insertResult[0]?.affectedRows === 1)) {
                await query('UPDATE users SET sparkle_points = COALESCE(sparkle_points, 0) + ? WHERE user_id = ?', [rewardPoints, userId]);
                rewardAwarded = true;
                logger.info(`[Rewards] +${rewardPoints} Sparkle Points awarded to user ${userId} for email verification.`);
            }
        } catch (rewardErr) {
            logger.warn('[Rewards] Could not process verification reward:', rewardErr.message);
        }

        // Fetch updated user
        const updatedUser = await queryOne(
            'SELECT user_id, name, username, email, email_verified, email_verified_at, sparkle_points, avatar_url, campus, role FROM users WHERE user_id = ? LIMIT 1',
            [userId]
        );

        // Send welcome email (asynchronous, non-blocking)
        sendEmail({
            to: targetEmail,
            subject: 'Welcome to Sparkle! 🎉',
            templateName: 'welcome',
            templateData: {
                name: updatedUser?.name || 'Sparkle Member',
                dashboardUrl: `${process.env.APP_URL || 'https://sparklewebapp.vercel.app'}/dashboard`
            }
        }).catch(e => logger.error('Welcome email failed:', e));

        // Qualify any pending referral
        try {
            const ReferralService = require('../services/referral.service');
            await ReferralService.qualifyReferral(userId);
        } catch (qualErr) {
            logger.warn('[AuthController] Referral qualification warning:', qualErr.message);
        }

        res.json({
            status: 'success',
            message: 'Email verified successfully!',
            email_verified: true,
            reward: {
                awarded: rewardAwarded,
                points: rewardPoints,
                message: rewardAwarded ? `+${rewardPoints} Sparkle Points awarded!` : 'Reward already claimed.'
            },
            user: updatedUser
        });
    } catch (error) {
        logger.error('Verify Email Error:', error);
        res.status(500).json({ status: 'error', message: 'Verification failed' });
    }
};

const getVerificationStatus = async (req, res) => {
    try {
        const userId = req.user?.user_id;
        if (!userId) return res.status(401).json({ status: 'error', message: 'Authentication required' });

        const user = await queryOne(
            'SELECT user_id, email, email_verified, email_verified_at, sparkle_points FROM users WHERE user_id = ? LIMIT 1',
            [userId]
        );
        if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

        const pending = await queryOne(
            'SELECT expires_at, created_at FROM email_verifications WHERE user_id = ? AND expires_at > NOW() AND verified_at IS NULL ORDER BY created_at DESC LIMIT 1',
            [userId]
        );

        const rewardRecord = await queryOne(
            'SELECT id, points_awarded, created_at FROM email_verification_rewards WHERE user_id = ? LIMIT 1',
            [userId]
        );

        res.json({
            status: 'success',
            data: {
                email: user.email,
                is_verified: Boolean(user.email_verified),
                email_verified: Boolean(user.email_verified),
                email_verified_at: user.email_verified_at,
                is_pending: !user.email_verified && Boolean(pending),
                expires_at: pending?.expires_at || null,
                reward_claimed: Boolean(rewardRecord),
                reward_points: 25,
                sparkle_points: user.sparkle_points || 0
            }
        });
    } catch (error) {
        logger.error('Get Verification Status Error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to retrieve verification status' });
    }
};

const changePendingEmail = async (req, res) => {
    try {
        const userId = req.user?.user_id;
        if (!userId) return res.status(401).json({ status: 'error', message: 'Authentication required' });

        const { newEmail } = req.body;
        if (!newEmail || !String(newEmail).includes('@')) {
            return res.status(400).json({ status: 'error', message: 'A valid email address is required.' });
        }

        const cleanEmail = String(newEmail).trim().toLowerCase();

        const user = await queryOne('SELECT email, email_verified, name FROM users WHERE user_id = ? LIMIT 1', [userId]);
        if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

        if (user.email_verified) {
            return res.status(400).json({
                status: 'error',
                message: 'Your email address is already verified. Changing a verified email must be performed through Security Settings.'
            });
        }

        if (user.email === cleanEmail) {
            return res.status(400).json({ status: 'error', message: 'The new email address matches your current pending email.' });
        }

        const existing = await queryOne('SELECT user_id FROM users WHERE email = ? AND user_id != ? LIMIT 1', [cleanEmail, userId]);
        if (existing) {
            return res.status(409).json({ status: 'error', message: 'This email address is already registered to another account.' });
        }

        // Invalidate old verification records for this user
        await query('DELETE FROM email_verifications WHERE user_id = ?', [userId]);

        // Update pending email on users
        await query('UPDATE users SET email = ? WHERE user_id = ?', [cleanEmail, userId]);

        // Generate new 6-digit code
        const code = crypto.randomInt(100000, 999999).toString();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await query(
            'INSERT INTO email_verifications (verification_id, user_id, email, code, expires_at, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
            [crypto.randomUUID(), userId, cleanEmail, code, expiresAt]
        );

        // Send email with new verification code
        sendEmail({
            to: cleanEmail,
            subject: 'Verify Your Email - Sparkle ✨',
            templateName: 'verify-email',
            templateData: {
                name: user.name,
                code,
                verifyUrl: `${process.env.APP_URL || 'https://sparklewebapp.vercel.app'}/verify-email#email=${encodeURIComponent(cleanEmail)}&code=${code}`
            }
        }).catch(e => logger.error('Change email verification dispatch failed:', e));

        res.json({
            status: 'success',
            message: 'Pending email updated and new verification code sent.',
            email: cleanEmail
        });
    } catch (error) {
        logger.error('Change Pending Email Error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to update pending email.' });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ status: 'error', message: 'Email is required' });

        const user = await queryOne(
            'SELECT user_id, name, account_status, email_verified FROM users WHERE email = ? LIMIT 1',
            [email]
        );
        if (!user) {
            // Security: don't reveal if user exists
            return res.json({ status: 'success', message: "If an account exists for this email, we've sent password reset instructions." });
        }

        const userStatus = user.account_status ? String(user.account_status).trim().toLowerCase() : 'active';
        if (userStatus === 'terminated' || userStatus === 'deleted' || userStatus === 'pending_deletion') {
            // Security policy: Password reset cannot reactivate or reset terminated/deletion-pending accounts
            logger.info(`Password reset blocked for ${email}: status is '${userStatus}'`);
            return res.json({ status: 'success', message: "If an account exists for this email, we've sent password reset instructions." });
        }

        // Section 8 Security Enforcement:
        // An unverified email cannot be used to independently authorize password resets
        if (!user.email_verified) {
            logger.info(`Password reset blocked for unverified email: ${email}`);
            return res.json({
                status: 'success',
                message: "If a verified account exists for this email, we've sent password reset instructions."
            });
        }

        // 1-minute countdown rate limit per reset request
        const recentReset = await query(
            'SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) as elapsed FROM password_resets WHERE email = ? ORDER BY created_at DESC LIMIT 1',
            [email]
        );
        if (recentReset.length > 0 && recentReset[0].elapsed !== null && recentReset[0].elapsed < 60) {
            const waitSeconds = 60 - recentReset[0].elapsed;
            return res.status(429).json({
                status: 'error',
                message: `Please wait ${waitSeconds}s before requesting another reset code.`,
                retryAfter: waitSeconds
            });
        }

        const token = crypto.randomInt(100000, 999999).toString();
        // Store only the SHA-256 hash (VARCHAR(64) matches exactly). The plaintext
        // code goes to the user's email; a DB dump/log leak can't be replayed.
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        // Clear previous resets for this user to avoid confusion/collisions
        await query('DELETE FROM password_resets WHERE email = ?', [email]);

        await query(
            'INSERT INTO password_resets (reset_id, user_id, email, token, expires_at, created_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR), NOW())',
            [crypto.randomUUID(), user.user_id, email, tokenHash]
        );

        logger.info(`Password reset requested for ${email} — code issued (not logged for security)`);

        await sendEmail({
            to: email,
            subject: 'Reset Your Password - SparkleApp',
            templateName: 'reset-password',
            templateData: {
                name: user.name,
                code: token,
                resetUrl: `${process.env.APP_URL || 'https://sparklewebapp.vercel.app'}/reset-password#email=${encodeURIComponent(email)}&code=${token}`
            }
        }).catch(e => logger.error('Reset email failed:', e));

        res.json({ status: 'success', message: "If an account exists for this email, we've sent password reset instructions.", cooldown: 60 });
    } catch (error) {
        logger.error('Forgot Password Error:', error);
        res.status(500).json({ status: 'error', message: 'Request failed' });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { token, email, code, newPassword } = req.body;
        const resetCode = code || token;
        if (!resetCode || !newPassword) {
            return res.status(400).json({ status: 'error', message: 'Verification code and new password are required' });
        }

        // Brute-force guard: cap verify attempts per code (5/hour) when Redis is
        // available. Fails open if Redis is unreachable — the 60s issuance
        // cooldown and 1-hour expiry still bound the attack window.
        try {
            const { connection } = require('../utils/queue');
            if (connection) {
                const attemptsKey = `pwreset:attempts:${resetCode}`;
                const attempts = await connection.incr(attemptsKey);
                if (attempts === 1) await connection.expire(attemptsKey, 3600);
                if (attempts > 5) {
                    logger.warn('Password reset locked out after too many attempts');
                    return res.status(429).json({ status: 'error', message: 'Too many attempts. Please request a new code.' });
                }
            }
        } catch (rateErr) {
            logger.warn('Password reset attempt guard skipped:', rateErr.message);
        }

        // Query by the token's SHA-256 hash (the plaintext code is never stored).
        // We order by created_at DESC to get the most recent one if there are collisions
        const resetCodeHash = crypto.createHash('sha256').update(resetCode).digest('hex');
        const resets = await query(
            'SELECT *, NOW() as db_now FROM password_resets WHERE token = ? AND expires_at > NOW() AND used_at IS NULL ORDER BY created_at DESC',
            [resetCodeHash]
        );

        logger.info(`Reset attempt for ${email || 'unknown email'}. Found ${resets.length} active records in DB.`);

        let reset = null;
        if (resets.length > 0) {
            // Log details for each record found (never the code itself)
            resets.forEach(r => {
                const expired = new Date(r.expires_at) < new Date(r.db_now);
                logger.info(`Checking record: Email=${r.email}, Expires=${r.expires_at}, DB_Now=${r.db_now}, Expired=${expired}`);
            });

            if (email) {
                const trimmedEmail = email.trim().toLowerCase();
                reset = resets.find(r => r.email.trim().toLowerCase() === trimmedEmail);
            } else {
                // If no email provided, just take the most recent one (already filtered by SQL)
                reset = resets[0];
            }
        }

        if (!reset) {
            logger.warn(`Password reset failed for ${email || 'unknown'}: no valid matching/unexpired code found.`);
            return res.status(400).json({ status: 'error', message: 'Invalid or expired verification code' });
        }

        // Verify account is eligible for reset
        const targetUser = await queryOne('SELECT user_id, account_status FROM users WHERE user_id = ? LIMIT 1', [reset.user_id]);
        if (targetUser) {
            const targetStatus = targetUser.account_status ? String(targetUser.account_status).trim().toLowerCase() : 'active';
            if (targetStatus === 'terminated' || targetStatus === 'deleted' || targetStatus === 'pending_deletion') {
                return res.status(403).json({ status: 'error', message: 'Password reset is not permitted for this account.' });
            }
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);

        await query('UPDATE users SET password_hash = ? WHERE user_id = ?', [hashedPassword, reset.user_id]);
        await query('UPDATE password_resets SET used_at = NOW() WHERE reset_id = ?', [reset.reset_id]);

        logger.info(`Password reset successful for User ID: ${reset.user_id}`);

        res.json({ status: 'success', message: 'Password reset successfully! You can now login.' });
    } catch (error) {
        logger.error('Reset Password Error:', error);
        res.status(500).json({ status: 'error', message: 'Reset failed' });
    }
};

const verifySMS = async (req, res) => {
    // Placeholder for now
    res.status(501).json({ status: 'error', message: 'SMS verification is currently a placeholder' });
};

const resendVerification = async (req, res) => {
    try {
        const { email: bodyEmail, type } = req.body || {}; // type: 'email' or 'sms'
        let email = bodyEmail ? String(bodyEmail).trim().toLowerCase() : null;
        const authUserId = req.user?.user_id;

        if (!email && authUserId) {
            const u = await queryOne('SELECT email FROM users WHERE user_id = ? LIMIT 1', [authUserId]);
            if (u) email = u.email;
        }

        if (!email) return res.status(400).json({ status: 'error', message: 'Email is required' });

        const users = await query('SELECT user_id, name, email_verified, phone_number FROM users WHERE email = ? LIMIT 1', [email]);
        if (users.length === 0) return res.status(404).json({ status: 'error', message: 'User not found' });

        const user = users[0];

        if (type === 'sms') {
            const code = crypto.randomInt(100000, 999999).toString();
            await sendSMS(user.phone_number, code);
            return res.json({ status: 'success', message: 'SMS verification code resent!' });
        }

        // 1-minute countdown rate limit per resend
        const recentRequest = await query(
            'SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) as elapsed FROM email_verifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [user.user_id]
        );
        if (recentRequest.length > 0 && recentRequest[0].elapsed !== null && recentRequest[0].elapsed < 60) {
            const waitSeconds = 60 - recentRequest[0].elapsed;
            return res.status(429).json({
                status: 'error',
                message: `Please wait ${waitSeconds}s before requesting a new code.`,
                retryAfter: waitSeconds,
                cooldown: waitSeconds
            });
        }

        // Rate Limiting for Resend: max 3 per hour
        const resendCount = await query(
            'SELECT COUNT(*) as count FROM verification_requests WHERE user_id = ? AND type = "email" AND requested_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)',
            [user.user_id]
        );

        if (resendCount && resendCount[0]?.count >= 3) {
            return res.status(429).json({
                status: 'error',
                message: 'You can only request a new code 3 times per hour.'
            });
        }

        // Log request
        await query(
            'INSERT INTO verification_requests (request_id, user_id, type) VALUES (?, ?, ?)',
            [crypto.randomUUID(), user.user_id, 'email']
        );

        if (user.email_verified) return res.status(400).json({ status: 'error', message: 'Email already verified' });

        const code = crypto.randomInt(100000, 999999).toString();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await query(
            'INSERT INTO email_verifications (verification_id, user_id, email, code, expires_at, created_at) VALUES (?, ?, ?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE code = ?, expires_at = ?, created_at = NOW()',
            [crypto.randomUUID(), user.user_id, email, code, expiresAt, code, expiresAt]
        );

        sendEmail({
            to: email,
            subject: 'Verify Your Email - Sparkle ✨',
            templateName: 'verify-email',
            templateData: {
                name: user.name,
                code,
                verifyUrl: `${process.env.APP_URL || 'https://sparklewebapp.vercel.app'}/verify-email#email=${encodeURIComponent(email)}&code=${code}`
            }
        }).catch(e => logger.error('Resend verification dispatch failed:', e));

        res.json({ status: 'success', message: 'Verification email resent!', cooldown: 60 });
    } catch (error) {
        logger.error('Resend Verification Error:', error);
        res.status(500).json({ status: 'error', message: 'Resend failed' });
    }
};

const logout = async (req, res) => {
    try {
        const { refreshToken, fcmToken, pushEndpoint } = req.body;
        const userId = req.user?.userId || req.user?.user_id;

        if (refreshToken) {
            await query('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
        } else if (userId) {
            // Fallback: clear all tokens for this user on this device (optional)
            await query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
        }

        // Clean up device notification tokens so notification keys are strictly wired to one active account
        if (fcmToken) {
            await query('DELETE FROM fcm_tokens WHERE token = ?', [fcmToken]);
        }
        if (pushEndpoint) {
            await query('DELETE FROM push_subscriptions WHERE endpoint = ?', [pushEndpoint]);
        }

        res.clearCookie('sparkleToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/'
        });

        res.json({ status: 'success', message: 'Logged out successfully' });
    } catch (error) {
        logger.error('Logout error:', error);
        res.status(500).json({ error: 'Failed to logout' });
    }
};

const validateToken = (req, res) => {
    res.json({ status: 'success', valid: true, user: req.user });
};

const switchAccount = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const users = await query('SELECT * FROM users WHERE user_id = ? LIMIT 1', [decoded.userId]);

        if (users.length === 0) {
            return res.status(401).json({ status: 'error', message: 'User not found' });
        }

        res.cookie('sparkleToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/'
        });

        res.json({ status: 'success', message: 'Account switched successfully' });
    } catch (error) {
        console.error('Switch Account Error:', error.message);
        res.status(401).json({ status: 'error', message: 'Invalid or expired token' });
    }
};

const refreshToken = async (req, res) => {
    try {
        const oldToken = req.body?.refreshToken || req.cookies?.sparkleRefresh;
        if (!oldToken) {
            return res.status(400).json({ error: 'Refresh token is required' });
        }

        const { accessToken, refreshToken: newRefreshToken } = await authService.refreshAccessToken(oldToken);

        // Also refresh the cookie if present or requested
        if (req.cookies && req.cookies.sparkleToken) {
            res.cookie('sparkleToken', accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 24 * 60 * 60 * 1000,
                path: '/'
            });
        }

        res.json({
            status: 'success',
            token: accessToken,
            refreshToken: newRefreshToken
        });
    } catch (error) {
        logger.error('Token refresh failed:', error.message);
        clientError(res, error, 'Invalid or expired refresh token', 401);
    }
};

const checkUsername = async (req, res) => {
    try {
        const { username } = req.query;
        if (!username) {
            return res.status(400).json({ success: false, code: 'USERNAME_REQUIRED', message: 'Username parameter is required.' });
        }

        const { validateUsername } = require('../utils/validation/username');
        const validation = validateUsername(username);
        if (!validation.valid) {
            return res.json({
                success: true,
                available: false,
                code: validation.error.code,
                message: validation.error.message,
                suggestions: []
            });
        }

        const normUsername = validation.value;
        const currentUserId = req.query.current_user_id || (req.user && (req.user.userId || req.user.user_id));

        let taken = false;
        let existingUserId = null;

        if (currentUserId) {
            const existing = await query('SELECT user_id FROM users WHERE username_normalized = ? LIMIT 1', [normUsername]);
            taken = existing.length > 0;
            existingUserId = existing.length > 0 ? existing[0].user_id : null;
        } else {
            const identityLookup = require('../services/identityBloom/identityLookup');
            const result = await identityLookup.checkIdentity('username', normUsername);
            taken = result.taken;
        }

        if (taken) {
            if (currentUserId && String(existingUserId) === String(currentUserId)) {
                return res.json({
                    success: true,
                    available: true,
                    isCurrent: true,
                    message: 'This is your current username.',
                    suggestions: []
                });
            }
            const suggestions = await authService.generateAvailableUsernames(normUsername);
            return res.json({
                success: true,
                available: false,
                code: 'USERNAME_TAKEN',
                message: 'Username is already taken.',
                suggestions
            });
        }

        res.json({
            success: true,
            available: true,
            code: 'USERNAME_AVAILABLE',
            suggestions: []
        });
    } catch (error) {
        logger.error('Check Username Error:', error);
        res.status(500).json({ success: false, message: 'Failed to check username' });
    }
};

const checkEmail = async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email parameter is required.' });
        }

        const { validateEmail } = require('../utils/validation/email');
        const validation = validateEmail(email);
        if (!validation.valid) {
            return res.json({
                success: true,
                available: false,
                message: validation.error.message
            });
        }

        const normEmail = validation.value;
        const identityLookup = require('../services/identityBloom/identityLookup');
        const result = await identityLookup.checkIdentity('email', normEmail);

        if (result.taken) {
            return res.json({
                success: true,
                available: false,
                message: 'Email address is already registered.'
            });
        }

        res.json({
            success: true,
            available: true
        });
    } catch (error) {
        logger.error('Check Email Error:', error);
        res.status(500).json({ success: false, message: 'Failed to check email' });
    }
};

/**
 * Public endpoint to reactivate a self-suspended account
 */
const reactivateAccount = async (req, res) => {
    try {
        const { identifier, password } = req.body;
        if (!identifier || !password) {
            return res.status(400).json({ error: 'Username or email and password are required' });
        }

        const cleanId = String(identifier).trim().toLowerCase();
        const users = await query(
            'SELECT * FROM users WHERE email = ? OR username = ? OR username_normalized = ? LIMIT 1',
            [cleanId, cleanId, cleanId]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Incorrect credentials' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Incorrect credentials' });
        }

        const status = (user.account_status || 'active').toLowerCase();
        if (status !== 'suspended') {
            return res.status(400).json({ error: `Account is currently '${status}', not suspended.` });
        }

        const result = await accountLifecycleService.reactivateAccount({
            userId: user.user_id,
            actorId: 'self',
            actorRole: 'user',
            req
        });

        // Issue tokens on successful reactivation
        const deviceId = req.headers['x-device-id'] || 'reactivation-device';
        const { accessToken, refreshToken } = await authService.generateTokens(user, deviceId);

        res.cookie('sparkleToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000,
            path: '/'
        });

        return res.json({
            success: true,
            message: result.message,
            token: accessToken,
            refreshToken
        });
    } catch (error) {
        logger.error('Reactivate account error: ' + error.message);
        return clientError(res, error, 'Failed to reactivate account');
    }
};

/**
 * Public endpoint to cancel a pending deletion during the 30-day grace period
 */
const cancelDeletion = async (req, res) => {
    try {
        const { identifier, password } = req.body;
        if (!identifier || !password) {
            return res.status(400).json({ error: 'Username or email and password are required' });
        }

        const cleanId = String(identifier).trim().toLowerCase();
        const users = await query(
            'SELECT * FROM users WHERE email = ? OR username = ? OR username_normalized = ? LIMIT 1',
            [cleanId, cleanId, cleanId]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Incorrect credentials' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Incorrect credentials' });
        }

        const status = (user.account_status || 'active').toLowerCase();
        if (status !== 'pending_deletion') {
            return res.status(400).json({ error: `Account is currently '${status}', not pending deletion.` });
        }

        const result = await accountLifecycleService.cancelDeletion({
            userId: user.user_id,
            actorId: 'self',
            actorRole: 'user',
            req
        });

        const deviceId = req.headers['x-device-id'] || 'cancel-deletion-device';
        const { accessToken, refreshToken } = await authService.generateTokens(user, deviceId);

        res.cookie('sparkleToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000,
            path: '/'
        });

        return res.json({
            success: true,
            message: result.message,
            token: accessToken,
            refreshToken
        });
    } catch (error) {
        logger.error('Cancel deletion error: ' + error.message);
        clientError(res, error, 'Failed to cancel deletion');
    }
};

// ---------------------------------------------------------------------------
// Email Diagnostic endpoint (admin / dev only)
// ---------------------------------------------------------------------------
const emailDiagnostic = async (req, res) => {
    try {
        // Guard: only admins OR requests carrying the EMAIL_DEBUG_KEY header
        const isAdmin = req.user?.role === 'admin';
        const debugKey = process.env.EMAIL_DEBUG_KEY;
        const headerKey = req.headers['x-sparkle-debug-key'];
        const hasDebugKey = debugKey && headerKey && headerKey === debugKey;

        if (!isAdmin && !hasDebugKey) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied — admin role or debug key required.'
            });
        }

        const { testEmail, provider } = req.body || {};
        const target = testEmail
            ? String(testEmail).trim().toLowerCase()
            : (req.user?.email || null);

        if (!target) {
            return res.status(400).json({
                status: 'error',
                message: 'testEmail is required in the request body.'
            });
        }

        const providerStatus = emailService.getProviderStatus();

        let testResults;
        if (provider === 'gmail') {
            try {
                const html = '<p>Sparkle Gmail SMTP diagnostic test. If you received this, Gmail is working.</p>';
                const r = await emailService._sendViaGmail({ to: target, subject: '[Sparkle] Gmail Test', html, text: 'Sparkle Gmail diagnostic test.' });
                testResults = { gmail: { success: true, messageId: r.messageId }, resend: null };
            } catch (err) {
                testResults = { gmail: { success: false, error: err.message, code: err.code }, resend: null };
            }
        } else if (provider === 'resend') {
            try {
                const html = '<p>Sparkle Resend API diagnostic test. If you received this, Resend is working.</p>';
                const r = await emailService._sendViaResend({ to: target, subject: '[Sparkle] Resend Test', html, text: 'Sparkle Resend diagnostic test.' });
                testResults = { gmail: null, resend: { success: true, messageId: r.messageId } };
            } catch (err) {
                testResults = { gmail: null, resend: { success: false, error: err.message, httpStatus: err.response?.status } };
            }
        } else {
            // Default: test both
            testResults = await emailService.testProviders(target);
        }

        return res.json({
            status: 'success',
            testEmail: target,
            providerStatus,
            results: testResults,
        });
    } catch (error) {
        logger.error('Email diagnostic error:', error);
        return res.status(500).json({ status: 'error', message: 'Diagnostic failed: ' + error.message });
    }
};

module.exports = { 
    signup, 
    login, 
    logout, 
    verifyEmail, 
    forgotPassword, 
    resetPassword, 
    verifySMS, 
    resendVerification, 
    validateToken, 
    switchAccount, 
    verify2FA, 
    request2FARecovery, 
    resend2FA, 
    refreshToken, 
    checkUsername, 
    checkEmail,
    reactivateAccount,
    cancelDeletion,
    getVerificationStatus,
    changePendingEmail,
    emailDiagnostic
};
