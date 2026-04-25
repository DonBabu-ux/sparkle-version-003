const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const User = require('../models/User');
const EmailVerification = require('../models/EmailVerification');
const PasswordReset = require('../models/PasswordReset');
const { sendEmail, templates } = require('../config/email');
const logger = require('../utils/logger');
const crypto = require('crypto');

// Enhanced signup with email verification
const signup = async (req, res) => {
    try {
        const { email, password, name, username, campus, major, yearOfStudy } = req.body;

        // Check if user exists
        const existingUser = await User.findByEmail(email) || await User.findByUsername(username);
        if (existingUser) {
            return res.status(400).json({
                error: 'User already exists',
                field: existingUser.email === email ? 'email' : 'username'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = crypto.randomUUID();

        // Create user (email_verified = false)
        await pool.query(
            `INSERT INTO users (
                user_id, email, password_hash, name, username, campus, 
                major, year_of_study, email_verified, joined_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, false, NOW())`,
            [userId, email, hashedPassword, name, username, campus, major, yearOfStudy]
        );

        // Create email verification
        const { code } = await EmailVerification.create(userId, email);

        // Send verification email (non-blocking)
        sendEmail({
            to: email,
            ...templates.verifyEmail(name, code)
        }).catch(err => logger.error('Failed to send verification email:', err));

        // Generate JWT
        const token = jwt.sign(
            { userId, email, username, name, campus },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.cookie('sparkleToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            sameSite: 'lax'
        });

        res.status(201).json({
            status: 'success',
            message: 'Registration successful! Please check your email to verify your account.',
            data: { email_verified: false }
        });
    } catch (error) {
        logger.error('Signup error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Verify email
const verifyEmail = async (req, res) => {
    try {
        const { code } = req.body;

        const verification = await EmailVerification.verify(code);

        if (!verification) {
            return res.status(400).json({
                error: 'Invalid or expired verification code'
            });
        }

        // Send welcome email (non-blocking)
        const [users] = await pool.query(
            'SELECT name, email FROM users WHERE user_id = ?',
            [verification.user_id]
        );

        if (users[0]) {
            sendEmail({
                to: users[0].email,
                ...templates.welcomeEmail(users[0].name)
            }).catch(err => logger.error('Failed to send welcome email:', err));
        }

        res.json({
            status: 'success',
            message: 'Email verified successfully! You can now access all features.'
        });
    } catch (error) {
        logger.error('Verify email error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Resend verification email
const resendVerification = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.email_verified) {
            return res.status(400).json({ error: 'Email already verified' });
        }

        // Rate Limit OTP requests (Redis-based)
        const isLimited = await EmailVerification.isRateLimited(email);
        if (isLimited) {
            return res.status(429).json({ 
                error: 'Too many requests', 
                message: 'Please wait a minute before requesting another code.' 
            });
        }

        const { code } = await EmailVerification.create(user.user_id, email);

        await sendEmail({
            to: email,
            ...templates.verifyEmail(user.name, code)
        });

        res.json({
            status: 'success',
            message: 'Verification email resent successfully'
        });
    } catch (error) {
        logger.error('Resend verification error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Forgot password
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findByEmail(email);
        if (!user) {
            // Don't reveal if user exists for security
            return res.json({
                status: 'success',
                message: 'If an account exists with this email, you will receive password reset instructions.'
            });
        }

        const { token } = await PasswordReset.create(user.user_id, email);

        await sendEmail({
            to: email,
            ...templates.resetPassword(user.name, token)
        });

        res.json({
            status: 'success',
            message: 'Password reset email sent successfully'
        });
    } catch (error) {
        logger.error('Forgot password error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Reset password
const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        const reset = await PasswordReset.verify(token);
        if (!reset) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await pool.query(
            'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE user_id = ?',
            [hashedPassword, reset.user_id]
        );

        await PasswordReset.markAsUsed(reset.reset_id);

        res.json({
            status: 'success',
            message: 'Password reset successfully. You can now login with your new password.'
        });
    } catch (error) {
        logger.error('Reset password error:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    signup,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword
};
