// controllers/auth.controller.js - PRODUCTION VERSION
const { query } = require('../utils/database/query');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const crypto = require('crypto');
const { downloadExternalImage } = require('../utils/media.utils');
const logger = require('../utils/logger');
const { sendEmail } = require('../config/email');
const { sendSMS } = require('../utils/sms');

// Helper to sanitize avatars
const getSafeAvatarUrl = (url) => {
    if (!url) return '/uploads/avatars/default.png';
    if (url.startsWith('/uploads/')) return url;
    if (url.startsWith('http')) return url;
    return '/uploads/avatars/default.png';
};

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
        const { name, username, email, password, campus, major, year, phone_number } = req.body;
        // Validation
        if (!name || !username || !email || !password) {
            return res.status(400).json({
                error: 'Required fields missing',
                message: 'Name, username, email, and password are required'
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
            'INSERT INTO users (user_id, name, username, email, password_hash, campus, major, year_of_study, phone_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [userId, name, username, email, hashedPassword, campus || null, major || null, year || null, phone_number || null]
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
        const { username: loginId, password } = req.body;

        if (!loginId || !password) {
            return res.status(400).json({
                error: 'Missing credentials',
                message: 'Username/Email and Password are required'
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
        if (!passwordMatch) {
            return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
        }

        // --- NEW: Check for 2FA ---
        if (user.two_factor_enabled && user.two_factor_pin) {
            return res.json({
                status: 'twofa_required',
                message: 'Two-factor authentication required',
                userId: user.user_id,
                email: user.email // for identification in PIN UI
            });
        }

        const token = jwt.sign({ 
            userId: user.user_id, 
            email: user.email, 
            username: user.username,
            tokenVersion: user.token_version || 0
        }, JWT_SECRET, { expiresIn: '7d' });

        // CREATE SESSION RECORD
        const sessionId = crypto.randomBytes(16).toString('hex');
        const userAgent = req.headers['user-agent'] || 'Unknown Device';
        const ip = req.ip || req.connection.remoteAddress;

        await query(
            'INSERT INTO user_sessions (session_id, user_id, device_name, ip_address) VALUES (?, ?, ?, ?)',
            [sessionId, user.user_id, userAgent, ip]
        );

        res.cookie('sparkleToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
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
        const { userId, pin } = req.body;
        if (!userId || !pin) {
            return res.status(400).json({ status: 'error', message: 'User ID and PIN are required' });
        }

        const [users] = await query('SELECT * FROM users WHERE user_id = ? LIMIT 1', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }

        const user = users[0];
        if (!user.two_factor_pin) {
            return res.status(400).json({ status: 'error', message: '2FA not correctly configured' });
        }

        const pinMatch = await bcrypt.compare(pin.toString(), user.two_factor_pin);
        if (!pinMatch) {
            return res.status(401).json({ status: 'error', message: 'Invalid 2FA PIN' });
        }

        // PIN correct, issue token
        validateJWTSecret();
        const token = jwt.sign({ 
            userId: user.user_id, 
            email: user.email, 
            username: user.username,
            tokenVersion: user.token_version || 0
        }, JWT_SECRET, { expiresIn: '7d' });

        // CREATE SESSION RECORD
        const sessionId = crypto.randomBytes(16).toString('hex');
        const userAgent = req.headers['user-agent'] || 'Unknown Device';
        const ip = req.ip || req.connection.remoteAddress;

        await query(
            'INSERT INTO user_sessions (session_id, user_id, device_name, ip_address) VALUES (?, ?, ?, ?)',
            [sessionId, user.user_id, userAgent, ip]
        );

        res.cookie('sparkleToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
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
        logger.error('Verify 2FA Error:', error);
        res.status(500).json({ status: 'error', message: 'PIN verification failed' });
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
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await query(
            'INSERT INTO password_resets (reset_id, user_id, email, token, expires_at) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE token = ?, expires_at = ?',
            [crypto.randomUUID(), user.user_id, email, token, expiresAt, token, expiresAt]
        );

        sendEmail({
            to: email,
            subject: 'Reset Your Password - Sparkle',
            templateName: 'reset-password',
            templateData: {
                name: user.name,
                resetUrl: `${process.env.APP_URL || 'http://localhost:3000'}/auth/reset-password?token=${token}`
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
        const { token, newPassword } = req.body;
        if (!token || !newPassword) return res.status(400).json({ status: 'error', message: 'Token and new password are required' });

        const [resets] = await query(
            'SELECT * FROM password_resets WHERE token = ? AND expires_at > NOW() AND used_at IS NULL LIMIT 1',
            [token]
        );

        if (resets.length === 0) {
            return res.status(400).json({ status: 'error', message: 'Invalid or expired reset token' });
        }

        const reset = resets[0];
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        await query('UPDATE users SET password_hash = ? WHERE user_id = ?', [hashedPassword, reset.user_id]);
        await query('UPDATE password_resets SET used_at = NOW() WHERE reset_id = ?', [reset.reset_id]);

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

module.exports = { signup, login, logout, verifyEmail, forgotPassword, resetPassword, verifySMS, resendVerification, validateToken, switchAccount, verify2FA };
