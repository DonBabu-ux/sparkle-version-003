const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { safeQuery } = require('../config/database');
const logger = require('../utils/logger');
const { JWT_SECRET } = require('../config/constants');

class AuthService {
    /**
     * Generate Access and Refresh tokens
     */
    async generateTokens(user, deviceId = 'unknown') {
        const accessToken = jwt.sign(
            {
                userId: user.user_id,
                email: user.email,
                username: user.username,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: '15m' } // Short lived
        );

        const refreshToken = crypto.randomBytes(40).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

        // Store refresh token in DB
        await safeQuery('INSERT INTO refresh_tokens (token_id, user_id, token, device_id, expires_at) VALUES (?, ?, ?, ?, ?)', [crypto.randomUUID(), user.user_id, refreshToken, deviceId, expiresAt]);

        return { accessToken, refreshToken };
    }

    /**
     * Verify and rotate refresh token
     */
    async refreshAccessToken(oldRefreshToken) {
        // 1. Find token in DB
        const tokens = await safeQuery('SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > NOW()', [oldRefreshToken]);

        if (tokens.length === 0) {
            throw new Error('Invalid or expired refresh token');
        }

        const tokenData = tokens[0];

        // 2. Get user data
        const users = await safeQuery('SELECT user_id, email, username, role FROM users WHERE user_id = ?', [tokenData.user_id]);

        if (users.length === 0) {
            throw new Error('User not found');
        }

        const user = users[0];

        // 3. Generate new tokens (Rotation)
        const newTokens = await this.generateTokens(user, tokenData.device_id);

        // 4. Delete old refresh token (to prevent reuse)
        await safeQuery('DELETE FROM refresh_tokens WHERE token = ?', [oldRefreshToken]);

        return newTokens;
    }

    /**
     * Track login activity for multi-device detection
     */
    async trackLoginActivity(userId, details) {
        const { deviceId, ipAddress, userAgent } = details;
        const redisService = require('./redis.service');
        const cacheKey = `session:verified:${userId}:${deviceId}`;

        // 1. Check Redis Cache first (Soft failure if Redis is down)
        try {
            const isCached = await redisService.get(cacheKey);
            if (isCached) return { isNewDevice: false };
        } catch (e) {
            logger.warn('Redis read failed in trackLoginActivity:', e.message);
        }

        // 2. Check Database
        const existing = await safeQuery('SELECT * FROM login_activity WHERE user_id = ? AND device_id = ?', [userId, deviceId]);

        const isNewDevice = existing.length === 0;

        await safeQuery(`INSERT INTO login_activity (activity_id, user_id, device_id, ip_address, user_agent, is_verified) 
             VALUES (?, ?, ?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE ip_address = ?, user_agent = ?, last_active = NOW()`,
             [
                 crypto.randomUUID(),
                 userId,
                 deviceId,
                 ipAddress,
                 userAgent,
                 !isNewDevice,
                 ipAddress,
                 userAgent
             ]);

        // 3. Cache the verification status in Redis (30 days) - Soft failure
        if (!isNewDevice) {
            try {
                await redisService.set(cacheKey, 'true', 30 * 24 * 60 * 60);
            } catch (e) {
                logger.warn('Redis write failed in trackLoginActivity:', e.message);
            }
        }

        return { isNewDevice };
    }

    /**
     * Generate available username suggestions for a base username.
     * Instagram-style: separator transforms of the requested handle,
     * a numeric ladder, tasteful suffixes/prefixes, and name-derived
     * handles when a display name is provided.
     */
    async generateAvailableUsernames(baseUsername, displayName = '') {
        const { normalizeUsername } = require('../utils/validation/username');
        const clean = normalizeUsername(baseUsername);
        if (clean.length < 2) {
            return [];
        }

        const seen = new Set();
        const candidates = [];
        const push = (c) => {
            if (c.length >= 3 && c.length <= 30 && /^[a-z0-9._]+$/.test(c) && !seen.has(c)) {
                seen.add(c);
                candidates.push(c);
            }
        };

        // Core handle without trailing digits/versions: wanjiku12 -> wanjiku
        const core = clean.replace(/[._]*\d+$/, '') || clean;
        const parts = core.split(/[._]/).filter(Boolean);

        // 1. Instagram-style separator transforms of the requested handle
        if (parts.length > 1) {
            const first = parts[0];
            const last = parts[parts.length - 1];
            push(parts.join(''));            // wanjikumwangi
            push(parts.join('_'));           // wanjiku_mwangi
            push(`${first}.${last}`);        // wanjiku.mwangi (re-normalized)
            push(`${first}.${last[0]}`);     // wanjiku.m
            push(`${first}_${last[0]}`);     // wanjiku_m
        }

        // 2. Handles derived from the display name (e.g. signup: "John Doe" -> johndoe)
        const name = String(displayName || '').trim().toLowerCase().replace(/[^a-z\s.'-]/g, '');
        const nameParts = name.split(/[\s.'-]+/).filter(Boolean);
        if (nameParts.length >= 2) {
            const first = nameParts[0];
            const last = nameParts[nameParts.length - 1];
            push(`${first}${last}`);         // johndoe
            push(`${first}_${last}`);        // john_doe
            push(`${first}.${last}`);        // john.doe
            push(`${first}.${last[0]}`);     // john.d
        }

        // 3. Numeric ladder on the requested handle and its core
        for (const base of [clean, core]) {
            for (const suffix of ['1', '_1', '2', '_2', '01', '02', '_3']) {
                push(`${base}${suffix}`);
            }
        }

        // 4. Familiar suffixes / prefixes
        push(`${core}_ke`);
        push(`${core}_official`);
        push(`real_${core}`);
        push(`the_${core}`);

        if (candidates.length === 0) return [];

        const placeholders = candidates.map(() => '?').join(', ');
        const rows = await safeQuery(
            `SELECT username_normalized FROM users WHERE username_normalized IN (${placeholders})`,
            candidates
        );
        const taken = new Set(rows.map(r => String(r.username_normalized).toLowerCase()));
        const available = candidates.filter(c => !taken.has(c.toLowerCase()) && c !== clean);

        return available.slice(0, 6);
    }

    /** Signup */
    async signup(data, deviceId = 'unknown') {
        const { logEvent } = require('../utils/analytics');
        await logEvent('signup_started', null, { deviceId });

        // Normalize inputs
        const name = data.name ? String(data.name).trim() : '';
        const username = data.username ? String(data.username).trim() : '';
        const email = data.email ? String(data.email).trim().toLowerCase() : '';
        const password = data.password ? String(data.password) : '';
        const campus = data.campus ? String(data.campus).trim() : null;
        const major = data.major ? String(data.major).trim() : null;
        const year = data.year ? String(data.year).trim() : null;
        const phone_number = data.phone_number ? String(data.phone_number).trim() : null;
        const user_type = data.user_type ? String(data.user_type).trim().toLowerCase() : '';
        const student_id = data.student_id ? String(data.student_id).trim() : null;

        const errors = [];

        // Field presence and formats
        if (!name) {
            errors.push({ field: 'name', code: 'NAME_REQUIRED', message: 'Name is required.' });
        } else if (name.length < 2 || name.length > 100) {
            errors.push({ field: 'name', code: 'INVALID_NAME', message: 'Name must be between 2 and 100 characters.' });
        }

        const { validateEmail } = require('../utils/validation/email');
        const emailResult = validateEmail(email);
        if (!emailResult.valid) {
            errors.push(emailResult.error);
        }

        const { validateUsername } = require('../utils/validation/username');
        const usernameResult = validateUsername(username);
        if (!usernameResult.valid) {
            errors.push(usernameResult.error);
        }

        const { validatePassword } = require('../utils/validation/password');
        const passwordResult = validatePassword(password);
        if (!passwordResult.valid) {
            errors.push(passwordResult.error);
        }

        const validUserTypes = ['student', 'alumni', 'teacher', 'faculty'];
        if (!user_type) {
            errors.push({ field: 'user_type', code: 'USER_TYPE_REQUIRED', message: 'User type is required.' });
        } else if (!validUserTypes.includes(user_type)) {
            errors.push({ field: 'user_type', code: 'INVALID_USER_TYPE', message: 'User type must be one of: student, alumni, teacher, faculty.' });
        }

        if (phone_number) {
            const phoneRegex = /^\+[1-9]\d{1,14}$/;
            if (!phoneRegex.test(phone_number)) {
                errors.push({ field: 'phone_number', code: 'INVALID_PHONE', message: 'Phone number must be in E.164 format (e.g. +1234567890).' });
            }
        }

        // Uniqueness check
        const normEmail = emailResult.value || email;
        const normUsername = usernameResult.value || username;

        if (emailResult.valid || usernameResult.valid) {
            const existing = await safeQuery(
                'SELECT email, username FROM users WHERE email = ? OR username = ? LIMIT 2',
                [normEmail, normUsername]
            );

            let emailTaken = false;
            let usernameTaken = false;

            for (const row of existing) {
                if (emailResult.valid && row.email.toLowerCase() === normEmail.toLowerCase()) {
                    emailTaken = true;
                }
                if (usernameResult.valid && row.username.toLowerCase() === normUsername.toLowerCase()) {
                    usernameTaken = true;
                }
            }

            if (emailTaken) {
                errors.push({ field: 'email', code: 'EMAIL_TAKEN', message: 'Email address is already registered.' });
            }
            if (usernameTaken) {
                const suggestions = await this.generateAvailableUsernames(normUsername, name);
                errors.push({
                    field: 'username',
                    code: 'USERNAME_TAKEN',
                    message: 'Username is already taken.',
                    suggestions
                });
            }
        }

        if (errors.length > 0) {
            const err = new Error('Signup validation failed.');
            err.validationErrors = errors;
            throw err;
        }

        const hashedPassword = await require('bcryptjs').hash(password, 12);
        const userId = crypto.randomUUID();

        const { transaction } = require('../utils/database/transaction');
        try {
            await transaction(async (conn) => {
                await conn.execute(
                    'INSERT INTO users (user_id, name, username, email, password_hash, campus, major, year_of_study, phone_number, user_type, student_id, onboarding_step) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)',
                    [userId, name, normUsername, normEmail, hashedPassword, campus || null, major || null, year || null, phone_number || null, user_type, student_id || null]
                );

                await conn.execute(
                    'INSERT INTO notifications (notification_id, user_id, type, title, content, action_url, is_read) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [crypto.randomUUID(), userId, 'system_welcome', 'Welcome to Sparkle', 'Discover trends, follow creators, and share your first spark.', '/explore', 0]
                );

                const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
                await conn.execute(
                    'INSERT INTO email_verifications (verification_id, user_id, email, code, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR)) ON DUPLICATE KEY UPDATE code = ?, expires_at = DATE_ADD(NOW(), INTERVAL 24 HOUR)',
                    [crypto.randomUUID(), userId, normEmail, verificationCode, verificationCode]
                );

                // Record versioned legal consent acceptances
                const termsVer = data.terms_version || '1.0';
                const privacyVer = data.privacy_version || '1.0';
                await conn.execute(
                    'INSERT INTO user_legal_consents (id, user_id, document_id, version) VALUES (?, ?, ?, ?), (?, ?, ?, ?)',
                    [
                        crypto.randomUUID(), userId, 'terms', termsVer,
                        crypto.randomUUID(), userId, 'privacy', privacyVer
                    ]
                ).catch(err => logger.error('Failed to record legal consent:', err));

                // Atomic referral attribution if referral code or handoff token provided
                const refCode = data.referral_code || data.referralCode || data.ref;
                const handoffTok = data.handoff_token || data.handoffToken;
                if (refCode || handoffTok) {
                    try {
                        const ReferralService = require('./referral.service');
                        await ReferralService.attributeSignup({
                            newUserId: userId,
                            referralCode: refCode,
                            handoffToken: handoffTok,
                            attributionMethod: handoffTok ? 'handoff_token' : 'manual_code',
                            conn
                        });
                    } catch (refErr) {
                        logger.warn('[AuthService] Referral attribution warning:', refErr.message);
                    }
                }

                const { sendEmail } = require('../config/email');
                sendEmail({
                    to: normEmail,
                    subject: 'Verify Your Email - Sparkle ✨',
                    templateName: 'verify-email',
                    templateData: {
                        name: name,
                        code: verificationCode,
                        verifyUrl: `${process.env.APP_URL || 'http://localhost:3000'}/auth/verify-email?code=${verificationCode}`
                    }
                }).catch(err => logger.error('Failed to send signup verification email:', err));

            });

            // Ensure new user gets their canonical referral code generated immediately
            try {
                const ReferralService = require('./referral.service');
                await ReferralService.getOrCreateUserReferralCode({ user_id: userId, username: normUsername });
            } catch (refCodeErr) {
                logger.warn('[AuthService] Could not generate initial referral code:', refCodeErr.message);
            }

            // Log event and generate tokens after successfully committing user insertion to the DB
            await logEvent('signup_completed', userId, { deviceId });

            // Bootstrap the new user's first-run experience (welcome conversation, notifications, onboarding)
            const userBootstrap = require('./userBootstrap.service');
            await userBootstrap.bootstrapNewUser(userId);

            const { accessToken, refreshToken } = await this.generateTokens({ user_id: userId, name, username: normUsername, email: normEmail, user_type }, deviceId);

            return {
                success: true,
                status: 'success',
                message: 'Account created! Please verify your email.',
                token: accessToken,
                refreshToken,
                user: {
                    id: userId,
                    user_id: userId,
                    name: name,
                    username: normUsername,
                    email: normEmail,
                    campus,
                    email_verified: false,
                    loggedIn: true
                },
                next: {
                    route: '/onboarding',
                    reason: 'ONBOARDING_REQUIRED'
                }
            };
        } catch (dbError) {
            if (dbError.code === 'ER_DUP_ENTRY') {
                const err = new Error('Signup validation failed.');
                err.validationErrors = [{
                    field: 'general',
                    code: 'DUPLICATE_ENTRY',
                    message: 'User with this email or username was registered concurrently.'
                }];
                throw err;
            }
            throw dbError;
        }
    }
}

module.exports = new AuthService();

