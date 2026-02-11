// controllers/auth.controller.js - PRODUCTION VERSION
const { query } = require('../utils/database/query');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const crypto = require('crypto');
const { downloadExternalImage } = require('../utils/media.utils');

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
    if (JWT_SECRET === 'your_jwt_secret_here' || JWT_SECRET.length < 32) {
        throw new Error('JWT_SECRET is not secure. Use a strong random string.');
    }
    return true;
};

const signup = async (req, res) => {
    try {
        const { name, username, email, password, campus, major, year } = req.body;
        // Validation
        if (!name || !username || !email || !password || !campus) {
            return res.status(400).json({
                status: 'error',
                message: 'All required fields must be provided'
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

        const hashedPassword = await bcrypt.hash(password, 12); // Increased cost factor for production
        const userId = crypto.randomUUID();

        await query(
            'INSERT INTO users (user_id, name, username, email, password_hash, campus, major, year_of_study) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [userId, name, username, email, hashedPassword, campus, major, year]
        );

        // Generate token for immediate login
        validateJWTSecret();
        const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({
            status: 'success',
            message: 'User created successfully',
            token,
            user: {
                id: userId,
                name,
                username,
                email,
                campus,
                major,
                year,
                loggedIn: true
            }
        });
    } catch (error) {
        console.error('Signup Error:', error.message);

        // Handle specific errors
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                status: 'error',
                message: 'User with this email or username already exists'
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Failed to create account'
        });
    }
};

const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Basic validation
        if (!username || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'Username and password are required'
            });
        }

        // Validate JWT configuration
        validateJWTSecret();

        // Query user from database - using retry wrapper
        const [users] = await query(
            'SELECT * FROM users WHERE email = ? OR username = ? LIMIT 1',
            [username, username]
        );

        if (users.length === 0) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid credentials'
            });
        }

        const user = users[0];

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid credentials'
            });
        }

        // Generate JWT token
        const tokenPayload = {
            userId: user.user_id,
            email: user.email,
            username: user.username
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, {
            expiresIn: '7d'
        });

        // Set secure cookie
        res.cookie('sparkleToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/'
        });

        // Lazy migration: If avatar is a CDN link, download it locally
        let safeAvatarUrl = user.avatar_url;
        if (safeAvatarUrl && (safeAvatarUrl.includes('fbcdn.net') || safeAvatarUrl.includes('fbsbx.com'))) {
            try {
                const localAvatar = await downloadExternalImage(safeAvatarUrl, 'avatars');
                if (localAvatar && localAvatar.startsWith('/uploads/')) {
                    safeAvatarUrl = localAvatar;
                    // Update the user's avatar_url in the database for future requests
                    const User = require('../models/User'); // Import here to avoid circular dependency if any
                    await User.update(user.user_id, { avatar_url: safeAvatarUrl });
                    console.log(`✅ Successfully migrated avatar for user ${user.username} to local storage: ${safeAvatarUrl}`);
                }
            } catch (dlError) {
                console.error(`❌ Failed to lazily migrate avatar for user ${user.username}:`, dlError.message);
            }
        }

        // Prepare user response
        const userResponse = {
            id: user.user_id,
            name: user.name,
            username: user.username,
            email: user.email,
            campus: user.campus,
            major: user.major,
            year: user.year_of_study,
            avatar_url: getSafeAvatarUrl(safeAvatarUrl),
            created_at: user.created_at,
            loggedIn: true
        };

        // Successful response
        res.json({
            status: 'success',
            token,
            user: userResponse
        });

    } catch (error) {
        console.error('Login Error:', error.message);

        // Handle specific errors
        let userMessage = 'Login failed. Please try again.';
        if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST') {
            userMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
        } else if (error.message.includes('JWT_SECRET')) {
            userMessage = 'Server configuration error';
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ER_ACCESS_DENIED_ERROR') {
            userMessage = 'Database connection failed';
        }

        res.status(500).json({
            status: 'error',
            message: userMessage,
            error: error.message
        });
    }
};

const logout = (req, res) => {
    res.clearCookie('sparkleToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
    });

    res.json({
        status: 'success',
        message: 'Logged out successfully'
    });
};

const verifyEmail = (req, res) => {
    res.status(501).json({
        status: 'error',
        message: 'Email verification not implemented'
    });
};

const forgotPassword = (req, res) => {
    res.status(501).json({
        status: 'error',
        message: 'Password reset not implemented'
    });
};

const validateToken = (req, res) => {
    // authMiddleware already validates the token and attaches user to req
    res.json({
        status: 'success',
        valid: true,
        user: req.user
    });
};

module.exports = { signup, login, logout, verifyEmail, forgotPassword, validateToken };
