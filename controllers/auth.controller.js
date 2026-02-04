const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const crypto = require('crypto');

const signup = async (req, res) => {
    try {
        const { name, username, email, password, campus, major, year } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = crypto.randomUUID();

        // Match columns in db.sql: username, email, password_hash, campus, major, year_of_study
        await pool.query(
            'INSERT INTO users (user_id, name, username, email, password_hash, campus, major, year_of_study) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [userId, name, username, email, hashedPassword, campus, major, year]
        );

        res.status(201).json({ status: 'success', message: 'User created' });
    } catch (error) {
        console.error('Signup Error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// Helper to sanitize avatars - prioritizes internal uploads
const getSafeAvatarUrl = (url) => {
    if (url && url.startsWith('/uploads/')) return url;
    return '/uploads/avatars/default.png';
};

const login = async (req, res) => {
    try {
        const { username, password } = req.body; // Frontend sends 'username' field which might contain email

        // Support login by email OR username
        const [users] = await pool.query(
            'SELECT * FROM users WHERE email = ? OR username = ?',
            [username, username]
        );

        if (users.length === 0 || !(await bcrypt.compare(password, users[0].password_hash))) {
            return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: users[0].user_id }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('sparkleToken', token, { httpOnly: false, maxAge: 7 * 24 * 60 * 60 * 1000 });

        // Don't send password hash back and sanitize avatar
        const userResponse = {
            ...users[0],
            avatar_url: getSafeAvatarUrl(users[0].avatar_url)
        };
        delete userResponse.password_hash;

        res.json({ status: 'success', token, user: userResponse });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

const logout = (req, res) => {
    res.clearCookie('sparkleToken');
    res.json({ status: 'success', message: 'Logged out' });
};

const verifyEmail = (req, res) => { res.json({ status: 'success' }); };
const forgotPassword = (req, res) => { res.json({ status: 'success' }); };

module.exports = { signup, login, logout, verifyEmail, forgotPassword };
