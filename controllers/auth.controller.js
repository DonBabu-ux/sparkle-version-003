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
const { sendEmail, templates } = require('../config/email');
const { sendSMS } = require('../utils/sms');
const authService = require('../services/auth.service');
const emailService = require('../services/email.service');

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

        // Account status checks (Suspended, Disabled, Locked)
        if (user.account_status) {
            const statusLower = String(user.account_status).trim().toLowerCase();
            if (statusLower === 'suspended') {
                return res.status(403).json({
                    success: false,
                    status: 'error',
                    code: 'ACCOUNT_SUSPENDED',
                    message: 'This account is currently unavailable. Please contact Sparkle Support if you believe this is a mistake.'
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

                logger.info(`[LOGIN 2FA] OTP for user ${user.username} (${channel} to ${destination}): ${otpCode}`);

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
                    const match = await bcrypt.compare(cleanCode, rec.code_hash);
                    if (match) {
                        verified = true;
                        await query('UPDATE otp_verifications SET verified_at = NOW() WHERE verification_id = ?', [rec.verification_id]);
                        break;
                    }
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
        const recoveryCode = Math.floor(100000 + Math.random() * 900000).toString();

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

        logger.info(`[RESEND 2FA] OTP for user ${user.username} (${channel} to ${destination}): ${otpCode}`);

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
        const { code, email } = req.body;
        if (!code || !email) {
            return res.status(400).json({ status: 'error', message: 'Email and code are required' });
        }

        const verifications = await query(
            'SELECT * FROM email_verifications WHERE email = ? AND code = ? AND expires_at > NOW() AND verified_at IS NULL LIMIT 1',
            [email, code]
        );

        if (verifications.length === 0) {
            return res.status(400).json({ status: 'error', message: 'Invalid or expired verification code' });
        }

        const verification = verifications[0];

        // Mark as verified
        await query('UPDATE email_verifications SET verified_at = NOW() WHERE verification_id = ?', [verification.verification_id]);
        await query('UPDATE users SET email_verified = 1 WHERE user_id = ?', [verification.user_id]);

        // Send welcome email
        const users = await query('SELECT name FROM users WHERE user_id = ?', [verification.user_id]);
        if (users[0]) {
            sendEmail({
                to: email,
                subject: 'Welcome to Sparkle! 🎉',
                templateName: 'welcome',
                templateData: {
                    name: users[0].name,
                    dashboardUrl: `${process.env.APP_URL || 'http://localhost:3000'}/dashboard`
                }
            }).catch(e => logger.error('Welcome email failed:', e));
        }

        // Qualify any pending referral
        try {
            const ReferralService = require('../services/referral.service');
            await ReferralService.qualifyReferral(verification.user_id);
        } catch (qualErr) {
            logger.warn('[AuthController] Referral qualification warning:', qualErr.message);
        }

        res.json({ status: 'success', message: 'Email verified successfully!' });
    } catch (error) {
        logger.error('Verify Email Error:', error);
        res.status(500).json({ status: 'error', message: 'Verification failed' });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ status: 'error', message: 'Email is required' });

        const user = await queryOne(
            'SELECT user_id, name FROM users WHERE email = ? LIMIT 1',
            [email]
        );
        if (!user) {
            // Security: don't reveal if user exists
            return res.json({ status: 'success', message: "If an account exists for this email, we've sent password reset instructions." });
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

        const token = Math.floor(100000 + Math.random() * 900000).toString();

        // Clear previous resets for this user to avoid confusion/collisions
        await query('DELETE FROM password_resets WHERE email = ?', [email]);

        await query(
            'INSERT INTO password_resets (reset_id, user_id, email, token, expires_at, created_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR), NOW())',
            [crypto.randomUUID(), user.user_id, email, token]
        );

        logger.info(`Password reset requested for ${email}. Code: ${token}`);

        await sendEmail({
            to: email,
            subject: 'Reset Your Password - SparkleApp',
            templateName: 'reset-password',
            templateData: {
                name: user.name,
                code: token,
                resetUrl: `${process.env.APP_URL || 'https://sparklewebapp.vercel.app'}/reset-password?email=${encodeURIComponent(email)}&code=${token}`
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

        // Query by token first (the 6-digit code)
        // We order by created_at DESC to get the most recent one if there are collisions
        const resets = await query(
            'SELECT *, NOW() as db_now FROM password_resets WHERE token = ? AND expires_at > NOW() AND used_at IS NULL ORDER BY created_at DESC',
            [resetCode]
        );

        logger.info(`Reset attempt: Code=${resetCode}, Email=${email}. Found ${resets.length} active records in DB.`);

        let reset = null;
        if (resets.length > 0) {
            // Log details for each record found
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
            logger.warn(`Password reset failed for ${email || 'unknown'} - Code: ${resetCode}. Reason: No valid matching/unexpired code found.`);
            return res.status(400).json({ status: 'error', message: 'Invalid or expired verification code' });
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
        const { email, type } = req.body; // type: 'email' or 'sms'
        if (!email) return res.status(400).json({ status: 'error', message: 'Email is required' });

        const users = await query('SELECT user_id, name, email_verified, phone_number FROM users WHERE email = ? LIMIT 1', [email]);
        if (users.length === 0) return res.status(404).json({ status: 'error', message: 'User not found' });

        const user = users[0];

        if (type === 'sms') {
            const code = Math.floor(100000 + Math.random() * 900000).toString();
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
                retryAfter: waitSeconds
            });
        }

        // --- NEW: Rate Limiting for Resend (Algorithm 3.3) ---
        const resendCount = await query(
            'SELECT COUNT(*) as count FROM verification_requests WHERE user_id = ? AND type = "email" AND requested_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)',
            [user.user_id]
        );

        if (resendCount[0].count >= 3) {
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


        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await query(
            'INSERT INTO email_verifications (verification_id, user_id, email, code, expires_at, created_at) VALUES (?, ?, ?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE code = ?, expires_at = ?, created_at = NOW()',
            [crypto.randomUUID(), user.user_id, email, code, expiresAt, code, expiresAt]
        );

        await sendEmail({
            to: email,
            subject: 'Verify Your Email - Sparkle ✨',
            templateName: 'verify-email',
            templateData: {
                name: user.name,
                code,
                verifyUrl: `${process.env.APP_URL || 'https://sparklewebapp.vercel.app'}/verify-email?code=${code}`
            }
        });

        res.json({ status: 'success', message: 'Verification email resent!' });
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
        const { refreshToken: oldToken } = req.body;
        if (!oldToken) {
            return res.status(400).json({ error: 'Refresh token is required' });
        }

        const { accessToken, refreshToken } = await authService.refreshAccessToken(oldToken);

        res.json({
            status: 'success',
            token: accessToken,
            refreshToken: refreshToken
        });
    } catch (error) {
        logger.error('Token refresh failed:', error.message);
        res.status(401).json({ status: 'error', message: error.message });
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
        // Use indexed lookup on username_normalized
        const existing = await query('SELECT user_id, username, username_normalized FROM users WHERE username_normalized = ? LIMIT 1', [normUsername]);

        if (existing.length > 0) {
            const currentUserId = req.query.current_user_id || (req.user && (req.user.userId || req.user.user_id));
            if (currentUserId && String(existing[0].user_id) === String(currentUserId)) {
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
        const existing = await query('SELECT email FROM users WHERE email = ? LIMIT 1', [normEmail]);

        if (existing.length > 0) {
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

module.exports = { signup, login, logout, verifyEmail, forgotPassword, resetPassword, verifySMS, resendVerification, validateToken, switchAccount, verify2FA, request2FARecovery, resend2FA, refreshToken, checkUsername, checkEmail };
