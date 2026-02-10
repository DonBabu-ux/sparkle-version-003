const { query } = require('../utils/database/query');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const crypto = require('crypto');

const signup = async (req, res) => {
    try {
        const { name, username, email, password, campus, major, year } = req.body;

        if (!name || !username || !email || !password) {
            return res.status(400).json({ status: 'error', message: 'Missing required fields' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = crypto.randomUUID();

        // Match columns in db.sql: username, email, password_hash, campus, major, year_of_study
        await query(
            'INSERT INTO users (user_id, name, username, email, password_hash, campus, major, year_of_study) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [userId, name, username, email, hashedPassword, campus, major, year]
        );

        res.status(201).json({ status: 'success', message: 'User created' });
    } catch (error) {
        console.error('❌ Signup Error:', error);

        // Provide user-friendly error messages
        let userMessage = 'Signup failed. Please try again.';
        if (error.code === 'ER_DUP_ENTRY') {
            userMessage = 'Username or email already exists.';
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST') {
            userMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
        }

        res.status(500).json({ status: 'error', message: userMessage, error: userMessage });
    }
};

// Helper to sanitize avatars - prioritizes internal uploads
const getSafeAvatarUrl = (url) => {
    if (url && url.startsWith('/uploads/')) return url;
    return '/uploads/avatars/default.png';
};

const login = async (req, res) => {
    try {
        console.log('🔐 Login attempt:', { username: req.body.username, hasPassword: !!req.body.password });

        const { username, password } = req.body; // Frontend sends 'username' field which might contain email

        if (!username || !password) {
            console.error('❌ Missing credentials');
            return res.status(400).json({ status: 'error', message: 'Username and password are required' });
        }

        // Support login by email OR username
        console.log('📊 Querying database for user:', username);
        const [users] = await query(
            'SELECT * FROM users WHERE email = ? OR username = ?',
            [username, username]
        );

        console.log('📊 Users found:', users.length);

        if (users.length === 0) {
            console.error('❌ User not found');
            return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
        }

        console.log('🔑 Comparing passwords...');
        const passwordMatch = await bcrypt.compare(password, users[0].password_hash);
        console.log('🔑 Password match:', passwordMatch);

        if (!passwordMatch) {
            console.error('❌ Password mismatch');
            return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
        }

        console.log('✅ Login successful, generating token...');
        const token = jwt.sign({ userId: users[0].user_id }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('sparkleToken', token, { httpOnly: false, maxAge: 7 * 24 * 60 * 60 * 1000 });

        // Don't send password hash back and sanitize avatar
        const userResponse = {
            ...users[0],
            avatar_url: getSafeAvatarUrl(users[0].avatar_url)
        };
        delete userResponse.password_hash;

        console.log('✅ Sending success response');
        res.json({ status: 'success', token, user: userResponse });
    } catch (error) {
        console.error('❌ Login Error (FULL):', error);
        console.error('❌ Error stack:', error.stack);
        console.error('❌ Error details:', {
            name: error.name,
            message: error.message,
            code: error.code,
            errno: error.errno,
            sqlMessage: error.sqlMessage
        });

        // Provide user-friendly error messages
        let userMessage = 'Login failed. Please try again.';
        if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST') {
            userMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
        }

        res.status(500).json({
            status: 'error',
            message: userMessage,
            error: error.message
        });
    }
};

const logout = (req, res) => {
    res.clearCookie('sparkleToken');
    res.json({ status: 'success', message: 'Logged out' });
};

const verifyEmail = (req, res) => { res.json({ status: 'success' }); };
const forgotPassword = (req, res) => { res.json({ status: 'success' }); };

module.exports = { signup, login, logout, verifyEmail, forgotPassword };
