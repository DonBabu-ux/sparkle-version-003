// controllers/auth.controller.js - PRODUCTION VERSION
const { query } = require('../utils/database/query');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const { JWT_SECRET } = require('../config/constants');
const crypto = require('crypto');
const { downloadExternalImage } = require('../utils/media.utils');
const logger = require('../utils/logger');
const { sendEmail } = require('../config/email');
const { sendSMS } = require('../utils/sms');

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
        validateJWTSecret();
        const { name, username, email, password, campus, major, year, phone_number, user_type, student_id } = req.body;
        // Validation
        if (!name || !username || !email || !password || !user_type) {
            return res.status(400).json({
                error: 'Required fields missing',
                message: 'Name, username, email, password, and user type are required'
            });
        }

        // Student ID validation (Algorithm 2.6)
        if (user_type === 'student' && !student_id) {
            return res.status(400).json({
                error: 'Student ID required',
                message: 'Students must provide a valid student ID'
            });
        }


        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid email format'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const userId = crypto.randomUUID();

        await query(
            'INSERT INTO users (user_id, name, username, email, password_hash, campus, major, year_of_study, phone_number, user_type, student_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [userId, name, username, email, hashedPassword, campus || null, major || null, year || null, phone_number || null, user_type, student_id || null]
        );

        // --- NEW: System Welcome Notification ---
        // Automatically insert a pinned welcome notification for new users
        await query(
            'INSERT INTO notifications (notification_id, user_id, type, title, content, action_url, is_read) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [crypto.randomUUID(), userId, 'system_welcome', 'Welcome to Sparkle', 'Discover trends, follow creators, and share your first spark.', '/explore', 0]
        );


        // --- NEW: Generate email verification code ---
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await query(
            'INSERT INTO email_verifications (verification_id, user_id, email, code, expires_at) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE code = ?, expires_at = ?',
            [crypto.randomUUID(), userId, email, verificationCode, expiresAt, verificationCode, expiresAt]
        );

        // Send verification email
        sendEmail({
            to: email,
            subject: 'Verify Your Email - Sparkle ✨',
            templateName: 'verify-email',
            templateData: {
                name,
                code: verificationCode,
                verifyUrl: `${process.env.APP_URL || 'http://localhost:3000'}/auth/verify-email?code=${verificationCode}`
            }
        }).catch(err => logger.error('Failed to send signup verification email:', err));

        // Generate token for immediate login
        const token = jwt.sign({ 
            userId, 
            email, 
            username, 
            tokenVersion: 0 
        }, JWT_SECRET, { expiresIn: '7d' });

        logger.info(`New user signed up: ${username} (${email}) - ID: ${userId}`);

        res.status(201).json({
            status: 'success',
            message: 'Account created! Please verify your email.',
            token,
            user: {
                id: userId,
                name,
                username,
                email,
                campus,
                email_verified: false,
                loggedIn: true
            }
        });
    } catch (error) {
        console.error('Signup Error [Full]:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                status: 'error',
                message: 'User with this email or username already exists'
            });
        }
        res.status(500).json({
            status: 'error',
            message: 'Failed to create account',
            details: error.message
        });
    }
};

const login = async (req, res) => {
    try {
        const { username: loginId, password, rememberMe } = req.body;

        if (!loginId || !password) {
            return res.status(400).json({
                error: 'Missing credentials',
                message: 'Username/Email and Password are required'
            });
        }

        // --- NEW: Rate Limiting (Algorithm 1.9) ---
        const ip = req.ip || req.connection.remoteAddress;
        const [attempts] = await query(
            'SELECT COUNT(*) as count FROM login_attempts WHERE (login_id = ? OR ip_address = ?) AND is_successful = 0 AND attempt_time > DATE_SUB(NOW(), INTERVAL 15 MINUTE)',
            [loginId, ip]
        );

        if (attempts[0].count >= 5) {
            return res.status(429).json({
                status: 'error',
                message: 'Too many failed attempts. Please try again in 15 minutes.'
            });
        }

        validateJWTSecret();


        const [users] = await query(
            'SELECT * FROM users WHERE email = ? OR username = ? LIMIT 1',
            [loginId, loginId]
        );

        if (users.length === 0) {
            return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
        }

        const user = users[0];
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        
        // Record attempt
        await query(
            'INSERT INTO login_attempts (attempt_id, user_id, login_id, ip_address, is_successful) VALUES (?, ?, ?, ?, ?)',
            [crypto.randomUUID(), user.user_id, loginId, ip, passwordMatch ? 1 : 0]
        );

        if (!passwordMatch) {
            return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
        }


        // --- NEW: Check for 2FA (Algorithm 42) ---
        if (user.two_factor_enabled) {
            return res.json({
                status: 'requires_2fa',
                userId: user.user_id,
                email: user.email, // Include email for the frontend to show
                message: `Please enter your 2FA code sent to ${user.email}`,
                rememberMe: !!rememberMe
            });
        }

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
        // const ip = req.ip || req.connection.remoteAddress; // Removed duplicate declaration

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
        console.error('Login Error [Full]:', error);
        res.status(500).json({ status: 'error', message: 'Login failed', details: error.message });
    }
};

const verify2FA = async (req, res) => {
    try {
        const { userId, code, rememberMe } = req.body;
        if (!userId || !code) {
            return res.status(400).json({ status: 'error', message: 'User ID and code are required' });
        }

        const [users] = await query('SELECT * FROM users WHERE user_id = ? LIMIT 1', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }

        const user = users[0];
        let verified = false;

        // Check if the code matches an unexpired emailed recovery code
        const [verifications] = await query(
            'SELECT * FROM email_verifications WHERE user_id = ? AND code = ? AND expires_at > NOW() AND verified_at IS NULL LIMIT 1',
            [userId, code]
        );

        if (verifications.length > 0) {
            verified = true;
            await query('UPDATE email_verifications SET verified_at = NOW() WHERE verification_id = ?', [verifications[0].verification_id]);
        }

        // If not an emailed code, check permanent backup codes
        if (!verified && user.two_factor_backup_codes) {
            let backupCodes = [];
            try {
                backupCodes = typeof user.two_factor_backup_codes === 'string' 
                    ? JSON.parse(user.two_factor_backup_codes) 
                    : user.two_factor_backup_codes;
            } catch (e) { backupCodes = []; }

            const codeIndex = backupCodes.indexOf(code);
            if (codeIndex !== -1) {
                verified = true;
                // Remove used backup code
                backupCodes.splice(codeIndex, 1);
                await query('UPDATE users SET two_factor_backup_codes = ? WHERE user_id = ?', [JSON.stringify(backupCodes), userId]);
            }
        }

        // If not verified by backup code, try TOTP (if enabled)
        if (!verified && user.two_factor_enabled && user.two_factor_secret) {
            verified = speakeasy.totp.verify({
                secret: user.two_factor_secret,
                encoding: 'base32',
                token: code
            });
        }

        if (!verified) {
            return res.status(401).json({ status: 'error', message: 'Invalid or expired 2FA code' });
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

        const [users] = await query('SELECT user_id, name, email FROM users WHERE user_id = ? LIMIT 1', [userId]);
        if (users.length === 0) return res.status(404).json({ status: 'error', message: 'User not found' });

        const user = users[0];
        const recoveryCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Insert into email_verifications instead of backup codes for temporary, strictly-expiring codes
        // Use DATE_ADD(NOW()) to avoid Node.js vs MySQL timezone mismatch issues
        await query(
            'INSERT INTO email_verifications (verification_id, user_id, email, code, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 2 MINUTE)) ON DUPLICATE KEY UPDATE code = VALUES(code), expires_at = DATE_ADD(NOW(), INTERVAL 2 MINUTE), verified_at = NULL',
            [crypto.randomUUID(), userId, user.email, recoveryCode]
        );

        await sendEmail({
            to: user.email,
            subject: 'Your 2FA Recovery Code - Sparkle ✨',
            templateName: 'verify-email', // Reuse verification template
            templateData: {
                name: user.name,
                code: recoveryCode,
                message: 'Use this code to bypass your 2FA security check. It will expire in 2 minutes.',
                verifyUrl: `${process.env.APP_URL || 'http://localhost:3000'}/login`
            }
        });

        res.json({ status: 'success', message: 'Recovery code sent to your email!' });
    } catch (error) {
        logger.error('2FA Recovery Error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to send recovery code' });
    }
};


const verifyEmail = async (req, res) => {
    try {
        const { code, email } = req.body;
        if (!code || !email) {
            return res.status(400).json({ status: 'error', message: 'Email and code are required' });
        }

        const [verifications] = await query(
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
        const [users] = await query('SELECT name FROM users WHERE user_id = ?', [verification.user_id]);
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

        const [users] = await query('SELECT user_id, name FROM users WHERE email = ? LIMIT 1', [email]);
        if (users.length === 0) {
            // Security: don't reveal if user exists
            return res.json({ status: 'success', message: 'If an account exists, you will receive reset instructions.' });
        }

        const user = users[0];
        const token = Math.floor(100000 + Math.random() * 900000).toString();

        // Clear previous resets for this user to avoid confusion/collisions
        await query('DELETE FROM password_resets WHERE email = ?', [email]);

        await query(
            'INSERT INTO password_resets (reset_id, user_id, email, token, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))',
            [crypto.randomUUID(), user.user_id, email, token]
        );

        logger.info(`Password reset requested for ${email}. Code: ${token}`);

        sendEmail({
            to: email,
            subject: 'Reset Your Password - Sparkle ✨',
            templateName: 'reset-password',
            templateData: {
                name: user.name,
                code: token,
                resetUrl: `${process.env.APP_URL || 'http://localhost:3000'}/auth/reset-password?email=${encodeURIComponent(email)}&code=${token}`
            }
        }).catch(e => logger.error('Reset email failed:', e));

        res.json({ status: 'success', message: 'Password reset instructions sent!' });
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
        const [resets] = await query(
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

        const [users] = await query('SELECT user_id, name, email_verified, phone_number FROM users WHERE email = ? LIMIT 1', [email]);
        if (users.length === 0) return res.status(404).json({ status: 'error', message: 'User not found' });

        const user = users[0];

        if (type === 'sms') {
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            await sendSMS(user.phone_number, code);
            return res.json({ status: 'success', message: 'SMS verification code resent!' });
        }

        // --- NEW: Rate Limiting for Resend (Algorithm 3.3) ---
        const [resendCount] = await query(
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
            'INSERT INTO email_verifications (verification_id, user_id, email, code, expires_at) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE code = ?, expires_at = ?',
            [crypto.randomUUID(), user.user_id, email, code, expiresAt, code, expiresAt]
        );

        await sendEmail({
            to: email,
            subject: 'Verify Your Email - Sparkle ✨',
            templateName: 'verify-email',
            templateData: {
                name: user.name,
                code,
                verifyUrl: `${process.env.APP_URL || 'http://localhost:3000'}/auth/verify-email?code=${code}`
            }
        });

        res.json({ status: 'success', message: 'Verification email resent!' });
    } catch (error) {
        logger.error('Resend Verification Error:', error);
        res.status(500).json({ status: 'error', message: 'Resend failed' });
    }
};

const logout = (req, res) => {
    res.clearCookie('sparkleToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
    });
    // Also clear token from localStorage via redirect
    res.redirect('/login');
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
        const [users] = await query('SELECT * FROM users WHERE user_id = ? LIMIT 1', [decoded.userId]);

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

module.exports = { signup, login, logout, verifyEmail, forgotPassword, resetPassword, verifySMS, resendVerification, validateToken, switchAccount, verify2FA, request2FARecovery };
