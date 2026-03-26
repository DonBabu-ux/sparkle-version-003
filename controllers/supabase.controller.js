const { createClient } = require('@supabase/supabase-js');
const { query } = require('../utils/database/query');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const crypto = require('crypto');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');

// Supabase Configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
    try {
        supabase = createClient(supabaseUrl, supabaseKey);
    } catch (err) {
        logger.error('Failed to initialize Supabase client:', err);
    }
} else {
    logger.warn('Supabase credentials missing in .env. Social/Phone auth will be limited.');
}

/**
 * Synchronize a Google (or other social) user with the MySQL database.
 * Used after frontend successful OAuth.
 */
const syncSocialUser = async (req, res) => {
    try {
        const { profile } = req.body;

        if (!profile || !profile.email) {
            return res.status(400).json({ status: 'error', message: 'Missing user profile' });
        }

        const { email, full_name, avatar_url } = profile;
        const name = full_name || email.split('@')[0];

        // Find existing user
        const [users] = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);

        let userId;
        let username;
        let isNewUser = false;

        if (users.length === 0) {
            // New User Registration
            userId = crypto.randomUUID();
            username = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') + Math.floor(Math.random() * 1000);
            isNewUser = true;

            const dummyPassword = crypto.randomBytes(16).toString('hex');
            const hashedPassword = await bcrypt.hash(dummyPassword, 12);

            await query(
                'INSERT INTO users (user_id, name, username, email, password_hash, avatar_url, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [userId, name, username, email, hashedPassword, avatar_url, 1]
            );
            logger.info(`New social user created: ${email}`);
        } else {
            // Existing User Login
            userId = users[0].user_id;
            username = users[0].username;

            // Sync profile data if needed
            if (avatar_url && users[0].avatar_url !== avatar_url) {
                await query('UPDATE users SET avatar_url = ? WHERE user_id = ?', [avatar_url, userId]);
            }
        }

        // Generate Token
        const token = jwt.sign({ userId, email, username }, JWT_SECRET, { expiresIn: '7d' });

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
            isNewUser,
            user: {
                id: userId,
                name,
                username,
                email,
                avatar_url: avatar_url || users[0]?.avatar_url,
                loggedIn: true
            }
        });

    } catch (error) {
        logger.error('Social Sync Error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to synchronize account' });
    }
};

/**
 * Handle Supabase OTP Verification & Sync
 * This is called after the client verifies OTP with Supabase
 */
const syncVerifiedOTP = async (req, res) => {
    try {
        const { type, value, metadata } = req.body; // type: 'phone' or 'email'

        if (!type || !value) {
            return res.status(400).json({ status: 'error', message: 'Missing verification data' });
        }

        // 1. Find or Create User
        let userSearchQuery = type === 'phone' ? 'SELECT * FROM users WHERE phone_number = ? LIMIT 1' : 'SELECT * FROM users WHERE email = ? LIMIT 1';
        const [users] = await query(userSearchQuery, [value]);

        let userId;
        let isNewUser = false;
        let username;

        if (users.length === 0) {
            // Creation flow (should usually happen via the main signup but handle here as fallback)
            userId = crypto.randomUUID();
            isNewUser = true;
            username = (metadata?.username || value.replace(/[^a-zA-Z0-9]/g, '')) + Math.floor(Math.random() * 1000);

            // Use provided password if available, otherwise dummy
            const passwordToHash = metadata?.password || crypto.randomBytes(16).toString('hex');
            const hashedPassword = await bcrypt.hash(passwordToHash, 12);

            const columns = ['user_id', 'username', 'password_hash'];
            const params = [userId, username, hashedPassword];

            if (type === 'phone') {
                columns.push('phone_number', 'phone_verified');
                params.push(value, 1);
            } else {
                columns.push('email', 'email_verified');
                params.push(value, 1);
            }

            if (metadata?.name) {
                columns.push('name');
                params.push(metadata.name);
            }

            // Sync academic details if available in metadata
            if (metadata?.campus) {
                columns.push('campus');
                params.push(metadata.campus);
            }
            if (metadata?.major) {
                columns.push('major');
                params.push(metadata.major);
            }
            if (metadata?.year) {
                columns.push('year_of_study');
                params.push(metadata.year);
            }

            const sql = `INSERT INTO users (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
            await query(sql, params);
        } else {
            // Update flow
            userId = users[0].user_id;
            username = users[0].username;
            const updateField = type === 'phone' ? 'phone_verified' : 'email_verified';
            await query(`UPDATE users SET ${updateField} = 1 WHERE user_id = ?`, [userId]);
        }

        // 2. Generate Session
        const email = users[0]?.email || metadata?.email || (type === 'email' ? value : null);
        const token = jwt.sign({ userId, email, username }, JWT_SECRET, { expiresIn: '7d' });

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
            user: {
                id: userId,
                username,
                email,
                loggedIn: true
            }
        });

    } catch (error) {
        logger.error('OTP Sync Error:', error);
        res.status(500).json({ status: 'error', message: 'Verification sync failed' });
    }
};

module.exports = { syncSocialUser, syncVerifiedOTP };
