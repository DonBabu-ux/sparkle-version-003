const User = require('../models/User');
const Post = require('../models/Post');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');
const { downloadExternalImage, processImage } = require('../utils/media.utils');
const notificationController = require('./notification.controller');
const crypto = require('crypto');
const path = require('path');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');



const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId || req.user.user_id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        const errorMsg = error?.message || String(error).slice(0, 200);
        logger.error('Get current user error: ' + errorMsg);
        res.status(500).json({ error: 'Failed to get user' });
    }
};

const searchUsers = async (req, res) => {
    try {
        const query = req.query.q || '';
        const currentUserId = req.user.userId || req.user.user_id;
        const filters = {
            campus: req.query.affiliation || req.query.campus,
            major: req.query.interests || req.query.major,
            year: req.query.experience_level || req.query.year,
            relationship: req.query.relationship,
            // also keep the properties named as expected by the model just in case
            affiliation: req.query.affiliation || req.query.campus,
            interests: req.query.interests || req.query.major,
            experience_level: req.query.experience_level || req.query.year
        };

        const users = await User.search(query, currentUserId, filters);

        const sanitizedUsers = users.map(u => ({
            ...u,
            id: u.user_id,
            avatar: u.avatar_url || '/uploads/avatars/default.png',
            affiliation: u.affiliation || u.campus,
            interests: u.interests || u.major,
            experience_level: u.experience_level || u.year_of_study
        }));

        res.json(sanitizedUsers);
    } catch (error) {
        const errorMsg = error?.message || String(error).slice(0, 200);
        logger.error('Search users error: ' + errorMsg);
        res.status(500).json({ error: 'Failed to search users' });
    }
};

const searchFollowingUsers = async (req, res) => {
    try {
        const query = req.query.q || '';
        const currentUserId = req.user.userId || req.user.user_id;

        const users = await User.searchFollowing(query, currentUserId);
        res.json(users);
    } catch (error) {
        const errorMsg = error?.message || String(error).slice(0, 200);
        logger.error('Search following users error: ' + errorMsg);
        res.status(500).json({ error: 'Failed to search following users' });
    }
};

const updateProfile = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { isSystemAccountId } = require('../helpers/systemAccount.helper');
        if (isSystemAccountId(userId)) {
            return res.status(403).json({ error: 'Sparkle Official Account profile cannot be edited.' });
        }

        // Fetch current user for cooldown checks + bio diff
        const currentUser = await User.findById(userId);
        if (!currentUser) return res.status(404).json({ error: 'User not found' });

        const now = Date.now();

        // --- 7-Day Display Name Cooldown (server clock only) ---
        if (req.body.name !== undefined && req.body.name !== currentUser.name) {
            if (currentUser.name_updated_at) {
                const msSince = now - new Date(currentUser.name_updated_at).getTime();
                const daysSince = msSince / (1000 * 60 * 60 * 24);
                if (daysSince < 7) {
                    const retryDays = Math.ceil(7 - daysSince);
                    const retryAt = new Date(new Date(currentUser.name_updated_at).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
                    return res.status(429).json({
                        code: 'NAME_CHANGE_COOLDOWN',
                        message: `You can change your display name again in ${retryDays} day${retryDays > 1 ? 's' : ''}.`,
                        error: `You can change your display name again in ${retryDays} day${retryDays > 1 ? 's' : ''}.`,
                        retryDays,
                        retryAt
                    });
                }
            }
        }

        // --- 30-Day Username Cooldown + Availability (server clock only) ---
        const { normalizeUsername, validateUsername } = require('../utils/validation/username');
        const authService = require('../services/auth.service');
        let normNewUsername = null;

        if (req.body.username !== undefined) {
            normNewUsername = normalizeUsername(req.body.username);
            const normCurrentUsername = normalizeUsername(currentUser.username);

            if (normNewUsername !== normCurrentUsername) {
                // 1. Validate format
                const validation = validateUsername(normNewUsername);
                if (!validation.valid) {
                    return res.status(400).json({
                        code: validation.error.code,
                        error: validation.error.message,
                        message: validation.error.message
                    });
                }

                // 2. Enforce 30-day cooldown
                if (currentUser.username_updated_at) {
                    const msSince = now - new Date(currentUser.username_updated_at).getTime();
                    const daysSince = msSince / (1000 * 60 * 60 * 24);
                    if (daysSince < 30) {
                        const retryDays = Math.ceil(30 - daysSince);
                        const retryAt = new Date(new Date(currentUser.username_updated_at).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
                        return res.status(429).json({
                            code: 'USERNAME_CHANGE_COOLDOWN',
                            message: `You can change your username again in ${retryDays} day${retryDays > 1 ? 's' : ''}.`,
                            error: `You can change your username again in ${retryDays} day${retryDays > 1 ? 's' : ''}.`,
                            retryDays,
                            retryAt
                        });
                    }
                }

                // 3. Check availability using indexed database lookup
                const existingUser = await User.findByUsername(normNewUsername);
                if (existingUser && String(existingUser.user_id) !== String(userId)) {
                    const suggestions = await authService.generateAvailableUsernames(normNewUsername);
                    return res.status(409).json({
                        code: 'USERNAME_TAKEN',
                        error: 'Username already taken',
                        message: 'This username is already taken. Please choose another.',
                        suggestions
                    });
                }
            }
        }

        const updates = {
            name: req.body.name,
            username: normNewUsername !== null ? normNewUsername : req.body.username,
            bio: req.body.bio,
            major: req.body.major,
            campus: req.body.campus,
            headline: req.body.headline,
            website: req.body.website,
            birthday: req.body.birthday || null,
            phone_number: req.body.phone_number
        };

        // Atomically set cooldown timestamps on changes
        if (req.body.name !== undefined && req.body.name !== currentUser.name) {
            updates.name_updated_at = new Date();
        }
        if (normNewUsername !== null && normNewUsername !== normalizeUsername(currentUser.username)) {
            updates.username_updated_at = new Date();
        }

        // Strip undefined keys so we don't overwrite with null accidentally
        Object.keys(updates).forEach(k => { if (updates[k] === undefined) delete updates[k]; });

        const oldBio = currentUser.bio || '';
        await User.update(userId, updates);

        // Invalidate profile/user caches
        try {
            const cacheService = require('../services/cache.service');
            const oldNorm = normalizeUsername(currentUser.username);
            await Promise.all([
                cacheService.del(`user:${userId}`),
                cacheService.del(`profile:${userId}`),
                oldNorm ? cacheService.del(`user:username:${oldNorm}`) : Promise.resolve(),
                normNewUsername ? cacheService.del(`user:username:${normNewUsername}`) : Promise.resolve()
            ]);
        } catch (cacheErr) {
            logger.warn('Cache invalidation warning on profile update: ' + (cacheErr?.message || cacheErr));
        }

        // --- Bio @mention notification dispatch (only on successful save) ---
        if (req.body.bio !== undefined && req.body.bio !== oldBio) {
            try {
                const newBio = req.body.bio || '';
                const mentionRegex = /@([a-zA-Z0-9._]+)/g;
                const oldMentions = new Set([...oldBio.matchAll(mentionRegex)].map(m => m[1].toLowerCase()));
                const newMentionsArr = [...newBio.matchAll(mentionRegex)].map(m => m[1].toLowerCase());
                const newMentions = newMentionsArr.filter(u => !oldMentions.has(u) && u !== (currentUser.username || '').toLowerCase());
                for (const mentionedUsername of newMentions) {
                    const mentionedUser = await User.findByUsername(mentionedUsername);
                    if (mentionedUser && mentionedUser.user_id !== userId) {
                        await notificationController.createNotification({
                            user_id: mentionedUser.user_id,
                            actor_id: userId,
                            type: 'mention',
                            title: 'Mentioned in Bio',
                            content: `${currentUser.name || currentUser.username} mentioned you in their bio`
                        });
                    }
                }
            } catch (mentionErr) {
                logger.warn('Bio mention dispatch error: ' + (mentionErr?.message || mentionErr));
            }
        }

        // Return updated user for immediate store reconciliation
        const updatedUser = await User.findById(userId);

        // Broadcast profile update via socket to followers and user's devices
        try {
            const { getIO } = require('../socket');
            const io = getIO();
            if (io) {
                const pool = require('../config/database');
                const [followers] = await pool.query(
                    'SELECT follower_id FROM follows WHERE following_id = ?',
                    [userId]
                );
                const rooms = followers.map(f => `user:${f.follower_id}`);
                rooms.push(`user:${userId}`);
                const publicProfile = {
                    user_id: updatedUser.user_id,
                    name: updatedUser.name,
                    username: updatedUser.username,
                    avatar_url: updatedUser.avatar_url,
                    bio: updatedUser.bio,
                    headline: updatedUser.headline,
                    campus: updatedUser.campus,
                    major: updatedUser.major,
                    is_verified: updatedUser.is_verified,
                    name_updated_at: updatedUser.name_updated_at,
                    username_updated_at: updatedUser.username_updated_at
                };
                io.to(rooms).emit('profile_updated', publicProfile);
            }
        } catch (socketErr) {
            logger.warn('Failed to emit profile_updated: ' + (socketErr?.message || socketErr));
        }

        res.json({ message: 'Profile updated successfully', user: updatedUser });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
            let suggestions = [];
            if (req.body.username) {
                const { normalizeUsername } = require('../utils/validation/username');
                const authService = require('../services/auth.service');
                suggestions = await authService.generateAvailableUsernames(normalizeUsername(req.body.username));
            }
            return res.status(409).json({
                code: 'USERNAME_TAKEN',
                error: 'Username already taken',
                message: 'This username is already taken. Please choose another.',
                suggestions
            });
        }
        const errorMsg = error?.message || String(error).slice(0, 200);
        logger.error('Update profile error: ' + errorMsg);
        res.status(500).json({ error: 'Failed to update profile' });
    }
};

const updateSettings = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const updates = {};

        // whitelist allowed settings (this list drives what may be written to DB)
        const allowedSettings = [
            'anonymous_enabled',
            'dark_mode_enabled',
            'email_notifications',
            'push_notifications',
            'profile_visibility',
            'theme',
            'font_size',
            'font_scale',
            'language',
            'last_seen_privacy',
            'message_privacy',
            'dnd_start',
            'dnd_end',
            'activity_status_enabled',
            'sensitive_content_level',
            'ai_content_opt_out',
            'recommendation_personalization',
            'search_indexing_enabled',
            'profile_discoverability',
            'reduced_motion',
            'auto_download_media',
            'link_previews_enabled',
            'haptic_intensity',
            'media_quality',
            'chat_pin',
            'chat_theme',
            'default_read_receipts',
            'default_typing_indicator',
            'default_allow_media_download',
            'default_allow_copy_text',
            'default_allow_reactions',
            'default_allow_forwarding',
            'default_screenshot_notification',
            'default_disappearing_mode',
            'blur_screen_recording'
        ];

        for (const key of Object.keys(req.body)) {
            if (allowedSettings.includes(key)) {
                updates[key] = req.body[key];
            }
        }

        if (Object.keys(updates).length > 0) {
            await User.updateSettings(userId, updates);

            const globalPrivacyKeys = [
                'default_read_receipts',
                'default_typing_indicator',
                'default_allow_forwarding',
                'default_allow_copy_text',
                'default_screenshot_notification'
            ];
            const hasPrivacyUpdate = Object.keys(updates).some(k => globalPrivacyKeys.includes(k));
            if (hasPrivacyUpdate) {
                try {
                    const { getIO } = require('../socket');
                    const io = getIO();
                    io.to(`user:${userId}`).emit('global_privacy_updated', {
                        userId,
                        updates,
                        timestamp: new Date().toISOString()
                    });
                } catch (socketErr) {
                    logger.warn('Failed to emit global_privacy_updated: ' + (socketErr?.message || socketErr));
                }
            }
        }

        res.json({ message: 'Settings updated successfully', updates });
    } catch (error) {
        const errorMsg = error?.message || String(error).slice(0, 200);
        logger.error('Update settings error: ' + errorMsg);
        res.status(500).json({ error: 'Failed to update settings' });
    }
};

const getAdvancedSettings = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            success: true,
            settings: {
                sensitive_content_level: user.sensitive_content_level || 'standard',
                ai_content_opt_out: !!user.ai_content_opt_out,
                recommendation_personalization: user.recommendation_personalization !== 0,
                search_indexing_enabled: user.search_indexing_enabled !== 0,
                profile_discoverability: user.profile_discoverability || 'everyone',
                reduced_motion: !!user.reduced_motion,
                font_scale: user.font_scale || 'medium',
                auto_download_media: user.auto_download_media || 'wifi',
                link_previews_enabled: user.link_previews_enabled !== 0,
                haptic_intensity: user.haptic_intensity || 'medium',
                media_quality: user.media_quality || 'standard',
                anonymous_enabled: !!user.anonymous_enabled,
                dark_mode_enabled: !!user.dark_mode_enabled,
                email_notifications: user.email_notifications !== 0,
                push_notifications: user.push_notifications !== 0,
                theme: user.theme || 'soft_pink',
                chat_pin: user.chat_pin || null,
                chat_theme: user.chat_theme || 'default',
                default_read_receipts: user.default_read_receipts !== 0,
                default_typing_indicator: user.default_typing_indicator !== 0,
                default_allow_media_download: user.default_allow_media_download !== 0,
                default_allow_copy_text: user.default_allow_copy_text !== 0,
                default_allow_reactions: user.default_allow_reactions !== 0,
                default_allow_forwarding: user.default_allow_forwarding !== 0,
                default_screenshot_notification: user.default_screenshot_notification !== 0,
                default_disappearing_mode: user.default_disappearing_mode || 'off',
                blur_screen_recording: user.blur_screen_recording !== undefined ? user.blur_screen_recording !== 0 : true
            }
        });
    } catch (error) {
        logger.error('Get advanced settings error: ' + (error?.message || error));
        res.status(500).json({ error: 'Failed to fetch advanced settings' });
    }
};

const uploadAvatar = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;

        // req.file.path contains the URL when using multer (or path if local)
        let avatarUrl = req.file ? (req.file.path || req.file.filename) : req.body.avatar_url;

        if (!avatarUrl && !req.file) {
            avatarUrl = '/uploads/avatars/default.png';
        }

        // If it's an external URL, download it locally
        if (avatarUrl && avatarUrl.startsWith('http') && !req.file) {
            try {
                const localPath = await downloadExternalImage(avatarUrl, 'avatars');
                if (localPath) avatarUrl = localPath;
            } catch (dlError) {
                logger.error('Failed to download external avatar:', dlError);
                // Fallback to default if download fails and it was a CDN link known to be problematic
                if (avatarUrl.includes('fbcdn.net') || avatarUrl.includes('fbsbx.com')) {
                    avatarUrl = '/uploads/avatars/default.png';
                }
            }
        }

        if (req.file) {
            const inputPath = req.file.path;
            const filename = `processed_${req.file.filename || path.basename(inputPath)}`;
            const relativePath = `uploads/avatars/${filename}`;
            const outputPath = path.join(__dirname, '..', 'public', relativePath);

            const success = await processImage(inputPath, outputPath, { width: 400, quality: 80 });
            if (success) {
                avatarUrl = `/${relativePath}`;
            }
        }

        await User.update(userId, { avatar_url: avatarUrl });
        const updatedUser = await User.findById(userId);

        // Broadcast avatar update via socket
        try {
            const { getIO } = require('../socket');
            const io = getIO();
            if (io) {
                const pool = require('../config/database');
                const [followers] = await pool.query(
                    'SELECT follower_id FROM follows WHERE following_id = ?',
                    [userId]
                );
                const rooms = followers.map(f => `user:${f.follower_id}`);
                rooms.push(`user:${userId}`);
                io.to(rooms).emit('profile_updated', {
                    user_id: updatedUser.user_id,
                    name: updatedUser.name,
                    username: updatedUser.username,
                    avatar_url: avatarUrl,
                    bio: updatedUser.bio,
                    headline: updatedUser.headline,
                    campus: updatedUser.campus,
                    major: updatedUser.major,
                    is_verified: updatedUser.is_verified
                });
            }
        } catch (socketErr) {
            logger.warn('Failed to emit avatar profile_updated: ' + (socketErr?.message || socketErr));
        }

        res.json({
            message: 'Avatar updated successfully',
            avatar_url: avatarUrl,
            user: updatedUser
        });

    } catch (error) {
        const errorMsg = error?.message || String(error).slice(0, 200);
        logger.error('Upload avatar error: ' + errorMsg);
        res.status(500).json({ error: 'Failed to update avatar' });
    }
};

const updatePassword = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { currentPassword, newPassword } = req.body;

        // Verify current password
        const user = await User.findById(userId);
        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Update password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await User.updatePassword(userId, hashedPassword);

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        const errorMsg = error?.message || String(error).slice(0, 200);
        logger.error('Update password error: ' + errorMsg);
        res.status(500).json({ error: 'Failed to update password' });
    }
};

const deleteAccount = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { password, reason, requestDataExport } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'Password required to delete account' });
        }

        const user = await User.findById(userId);
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        // Log reason if provided
        if (reason) {
            logger.info(`User ${userId} deleting account. Reason: ${reason}`);
        }

        // If data export requested, trigger email before deleting
        if (requestDataExport) {
            try {
                const emailService = require('../services/email.service');
                // Fire-and-forget — don't block deletion
                emailService.sendDataExportEmail && emailService.sendDataExportEmail(user).catch(() => {});
            } catch (_) {}
        }

        await User.delete(userId);

        res.clearCookie('sparkleToken');
        res.json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
        const errorMsg = error?.message || String(error).slice(0, 200);
        logger.error('Delete account error: ' + errorMsg);
        res.status(500).json({ error: 'Failed to delete account' });
    }
};

// Terminate account — sets account_status = 'terminated', logs out all devices
// Reversible by contacting support. Profile hidden from all users.
const terminateAccount = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { password, reason } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'Password required to terminate account' });
        }

        const user = await User.findById(userId);
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        logger.info(`User ${userId} terminating account. Reason: ${reason || 'none'}`);

        // Mark account as terminated (keeps data, but hides from all)
        await User.pool.query(
            `UPDATE users SET account_status = 'terminated', is_online = 0, last_seen_at = NOW() WHERE user_id = ?`,
            [userId]
        );

        // Revoke all sessions
        await User.pool.query('DELETE FROM user_sessions WHERE user_id = ?', [userId]);
        await User.pool.query('UPDATE users SET token_version = token_version + 1 WHERE user_id = ?', [userId]);

        res.clearCookie('sparkleToken');
        res.json({ success: true, message: 'Account terminated. Contact support to reactivate.' });
    } catch (error) {
        const errorMsg = error?.message || String(error).slice(0, 200);
        logger.error('Terminate account error: ' + errorMsg);
        res.status(500).json({ error: 'Failed to terminate account' });
    }
};

// Hide from users — toggles is_hidden flag (ghost mode)
// Account stays active but profile/posts won't appear in discover/search
const setHideFromUsers = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { hidden } = req.body; // boolean

        if (typeof hidden !== 'boolean') {
            return res.status(400).json({ error: 'hidden must be a boolean' });
        }

        await User.pool.query(
            'UPDATE users SET is_hidden = ? WHERE user_id = ?',
            [hidden ? 1 : 0, userId]
        );

        res.json({
            success: true,
            is_hidden: hidden,
            message: hidden
                ? 'Your profile is now hidden from discover and search.'
                : 'Your profile is now visible to other users.'
        });
    } catch (error) {
        const errorMsg = error?.message || String(error).slice(0, 200);
        logger.error('Set hide from users error: ' + errorMsg);
        res.status(500).json({ error: 'Failed to update visibility' });
    }
};

const getActiveSessions = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const [sessions] = await User.pool.query(
            'SELECT session_id, device_name, ip_address, last_active, created_at FROM user_sessions WHERE user_id = ? ORDER BY last_active DESC',
            [userId]
        );
        res.json(sessions);
    } catch (error) {
        const errorMsg = error?.message || String(error).slice(0, 200);
        logger.error('Get active sessions error: ' + errorMsg);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
};

const revokeSession = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { sessionId } = req.params;
        await User.pool.query(
            'DELETE FROM user_sessions WHERE session_id = ? AND user_id = ?',
            [sessionId, userId]
        );
        res.json({ success: true, message: 'Session revoked' });
    } catch (error) {
        const errorMsg = error?.message || String(error).slice(0, 200);
        logger.error('Revoke session error: ' + errorMsg);
        res.status(500).json({ error: 'Failed to revoke session' });
    }
};

const logoutAllDevices = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        
        // 1. Invalidate current JWTs by incrementing version
        await User.pool.query('UPDATE users SET token_version = token_version + 1 WHERE user_id = ?', [userId]);
        
        // 2. Clear known sessions
        await User.pool.query('DELETE FROM user_sessions WHERE user_id = ?', [userId]);
        
        res.clearCookie('sparkleToken');
        res.json({ success: true, message: 'Logged out from all devices' });
    } catch (error) {
        const errorMsg = error?.message || String(error).slice(0, 200);
        logger.error('Logout all devices error: ' + errorMsg);
        res.status(500).json({ error: 'Failed to logout from all devices' });
    }
};

const exportUserData = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const [
            user,
            posts,
            messages,
            listings,
            confessions
        ] = await Promise.all([
            User.findById(userId),
            Post.getUserPosts(userId, userId), // Exporting own data, can see all
            User.pool.query('SELECT * FROM messages WHERE sender_id = ?', [userId]),
            User.pool.query('SELECT * FROM marketplace_listings WHERE seller_id = ?', [userId]),
            User.pool.query('SELECT * FROM confessions WHERE campus = (SELECT campus FROM users WHERE user_id = ?)', [userId]) // Confessions aren't tied to user IDs usually, but maybe they were saved?
        ]);

        const dataExport = {
            profile: user,
            posts: posts,
            messages: messages[0],
            listings: listings[0],
            timestamp: new Date().toISOString()
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=sparkle_data_${userId}.json`);
        res.send(JSON.stringify(dataExport, null, 2));
    } catch (error) {
        const errorMsg = error?.message || String(error).slice(0, 200);
        logger.error('Export user data error: ' + errorMsg);
        res.status(500).json({ error: 'Failed to export your data' });
    }
};

const generate2FASecret = async (req, res) => {
    try {
        const secret = speakeasy.generateSecret({
            name: `Sparkle:${req.user.username}`
        });

        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

        res.json({
            status: 'success',
            secret: secret.base32,
            qrCode: qrCodeUrl
        });
    } catch (err) {
        logger.error('2FA Secret Generation Error:', err);
        res.status(500).json({ status: 'error', message: 'Failed to generate 2FA secret' });
    }
};

const enableTwoFactor = async (req, res) => {
    try {
        const { secret, token } = req.body;
        const userId = req.user.userId || req.user.user_id;

        const verified = speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: token
        });

        if (!verified) {
            return res.status(400).json({ status: 'error', message: 'Invalid verification token' });
        }

        // Generate backup codes (Algorithm 42.10)
        const backupCodes = [];
        for (let i = 0; i < 8; i++) {
            backupCodes.push(crypto.randomBytes(4).toString('hex'));
        }

        await User.update(userId, {
            two_factor_enabled: 1,
            two_factor_secret: secret,
            two_factor_backup_codes: JSON.stringify(backupCodes)
        });

        res.json({
            status: 'success',
            message: 'Two-factor authentication enabled',
            backupCodes: backupCodes
        });
    } catch (err) {
        logger.error('2FA Enable Error:', err);
        res.status(500).json({ status: 'error', message: 'Failed to enable 2FA' });
    }
};

const disableTwoFactor = async (req, res) => {
    try {
        const { password } = req.body;
        const userId = req.user.userId || req.user.user_id;

        const user = await User.findById(userId);
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ status: 'error', message: 'Incorrect password' });
        }

        await User.update(userId, {
            two_factor_enabled: 0,
            two_factor_secret: null,
            two_factor_backup_codes: null
        });

        res.json({ status: 'success', message: 'Two-factor authentication disabled' });
    } catch (err) {
        logger.error('2FA Disable Error:', err);
        res.status(500).json({ status: 'error', message: 'Failed to disable 2FA' });
    }
};


const generateSecurityToken = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const token = require('crypto').randomBytes(32).toString('hex');
        await User.updateSettings(userId, { security_token: token });
        res.json({ success: true, token });
    } catch (error) {
        logger.error('Generate security token error:', error);
        res.status(500).json({ error: 'Failed to generate token' });
    }
};

const followUser = async (req, res) => {
    try {
        const followerId = req.user.userId || req.user.user_id;
        const followingId = req.params.id;
        const SYSTEM_USER_ID = 'd75fe3b5-7a45-4581-ab13-91934d8b54de';

        if (followingId === SYSTEM_USER_ID) {
            return res.status(403).json({ error: 'Cannot follow the Sparkle official account' });
        }

        // Check if already following
        const [existing] = await User.pool.query(
            'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?',
            [followerId, followingId]
        );

        // Toggle off (unfollow)
        if (existing.length > 0) {
            await User.unfollow(followerId, followingId);
            return res.json({ 
                success: true, 
                status: 'unfollowed', 
                is_following: false,
                message: 'User unfollowed' 
            });
        }

        // Toggle on (follow)
        const result = await User.follow(followerId, followingId);

        res.json({ 
            success: true, 
            status: result.status, 
            is_following: result.status === 'following',
            message: result.status === 'requested' ? 'Follow request sent' : 'User followed' 
        });
    } catch (error) {
        logger.error('Follow user error:', error);
        res.status(500).json({ error: error.message || 'Failed to follow user' });
    }
};

const unfollowUser = async (req, res) => {
    try {
        const followerId = req.user.userId || req.user.user_id;
        const followingId = req.params.id;
        const SYSTEM_USER_ID = 'd75fe3b5-7a45-4581-ab13-91934d8b54de';

        if (followingId === SYSTEM_USER_ID) {
            return res.status(403).json({ error: 'Cannot unfollow the Sparkle official account' });
        }

        await User.unfollow(followerId, followingId);
        res.json({ 
            success: true, 
            status: 'unfollowed', 
            is_following: false,
            message: 'User unfollowed' 
        });
    } catch (error) {
        logger.error('Unfollow user error:', error);
        res.status(500).json({ error: 'Failed to unfollow user' });
    }
};

const getFollowers = async (req, res) => {
    try {
        const userId = req.params.id;
        const currentUserId = req.user.userId || req.user.user_id;
        const followers = await User.getFollowersDetailed(userId, currentUserId);
        
        const mappedFollowers = followers.map(f => ({
            ...f,
            id: f.user_id,
            profile_picture: f.avatar_url || '/uploads/avatars/default.png',
            is_followed_by_me: !!f.is_followed_by_me
        }));

        res.json(mappedFollowers);
    } catch (error) {
        logger.error('Get followers error:', error);
        res.status(500).json({ error: 'Failed to get followers' });
    }
};

const getMyFollowers = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const followers = await User.getFollowersDetailed(userId, userId);
        
        const mappedFollowers = followers.map(f => ({
            ...f,
            id: f.user_id,
            profile_picture: f.avatar_url || '/uploads/avatars/default.png',
            is_followed_by_me: !!f.is_followed_by_me
        }));

        res.json(mappedFollowers);
    } catch (error) {
        logger.error('Get my followers error:', error);
        res.status(500).json({ error: 'Failed to get followers' });
    }
};

const getFollowing = async (req, res) => {
    try {
        const userId = req.params.id;
        const currentUserId = req.user.userId || req.user.user_id;
        const following = await User.getFollowingDetailed(userId, currentUserId);

        const mappedFollowing = following.map(f => ({
            ...f,
            id: f.user_id,
            profile_picture: f.avatar_url || '/uploads/avatars/default.png',
            is_followed_by_me: !!f.is_followed_by_me
        }));

        res.json(mappedFollowing);
    } catch (error) {
        logger.error('Get following error:', error);
        res.status(500).json({ error: 'Failed to get following' });
    }
};

const getUserProfile = async (req, res) => {
    try {
        const identifier = req.params.id; // Could be ID or Username
        const currentUserId = req.user.userId || req.user.user_id;

        // --- ✨ VIRTUAL PROFILE HANDLER ✨ ---
        if (identifier === 'sparkle_team') {
            return res.json({
                id: 'mock-1',
                username: 'sparkle_team',
                name: 'Sparkle Team',
                profile_picture: '/uploads/avatars/default.png',
                avatar: '/uploads/avatars/default.png',
                bio: 'The creators of Sparkle. We are here to help you discover the magic! ✨',
                is_verified: 1,
                followers: 1000000,
                following: 1,
                posts: 42,
                campus: 'Global',
                major: 'Engineering',
                is_followed_by_me: true
            });
        }
        const user = await User.getProfileWithStats(identifier, currentUserId);
        
        if (user && user.user_id !== currentUserId) {
            // Increment profile views
            const pool = require('../config/database');
            pool.query('UPDATE users SET profile_views = profile_views + 1 WHERE user_id = ?', [user.user_id])
                .catch(err => logger.error('Failed to increment profile views:', err));
        }

        if (!user) return res.status(404).json({ error: 'User not found' });

        // Check if blocked
        const [blockCheck] = await User.pool.query(
            'SELECT 1 FROM user_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
            [currentUserId, user.user_id, user.user_id, currentUserId]
        );

        if (blockCheck.length > 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Map stats for frontend compatibility
        const profile = {
            id: user.user_id,
            username: user.username,
            name: user.name,
            profile_picture: user.avatar_url || '/uploads/avatars/default.png',
            avatar: user.avatar_url || '/uploads/avatars/default.png',
            bio: user.bio || '',
            followers_count: user.followers_count || 0,
            following_count: user.following_count || 0,
            posts_count: user.posts_count || 0,
            followers: user.followers_count || 0, // compatibility
            following: user.following_count || 0, // compatibility
            posts: user.posts_count || 0, // compatibility
            campus: user.campus,
            major: user.major,
            affiliation: user.affiliation || user.campus,
            interests: user.interests || user.major,
            experience_level: user.experience_level || user.year_of_study,
            userType: user.userType,
            is_followed_by_me: !!user.is_followed_by_me,
            is_requested_by_me: !!user.is_requested_by_me,
            note: user.note || '',
            has_story: !!user.has_story,
            avatar_url: user.avatar_url || '/uploads/avatars/default.png',
            reputation: user.reputation
        };

        res.json(profile);
    } catch (error) {
        logger.error('Get user profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
};

const getUserPosts = async (req, res) => {
    try {
        const userId = req.params.id;
        const currentUserId = req.user.userId || req.user.user_id;

        // --- ✨ VIRTUAL POSTS HANDLER ✨ ---
        if (userId === 'sparkle_team' || userId === 'mock-1') {
            return res.json([{
                id: 'p-mock-1',
                post_id: 'p-mock-1',
                content: 'Welcome to Sparkle! This is where discovery happens. ✨',
                username: 'sparkle_team',
                user_name: 'Sparkle Team',
                avatar_url: '/uploads/avatars/default.png',
                sparks: 9999,
                comments: 123,
                created_at: new Date()
            }]);
        }

        const posts = await Post.getUserPosts(userId, currentUserId);
        
        const mappedPosts = posts.map(post => ({
            ...post,
            id: post.post_id,
            likes_count: post.sparks || 0,
            comments_count: post.comments || 0,
            media_url: post.media_url,
            content: post.content,
            created_at: post.created_at
        }));

        res.json(mappedPosts);
    } catch (error) {
        logger.error('Get user posts error:', error);
        res.status(500).json({ error: 'Failed to get posts' });
    }
};

// return a small batch of users that the current user might want to follow
const getSuggestions = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const currentUserId = req.user.userId || req.user.user_id;
        const { tab = 'suggested', filter = null, q = null, force, seed: clientSeed = '' } = req.query;
        
        // --- BATCH 3: Suggestions Caching (10 min TTL) ---
        const redisService = require('../services/redis.service');
        const cacheKey = `suggestions:${currentUserId}:${tab}:${filter || 'none'}:${q || 'none'}:${offset}:${limit}:${clientSeed}`;
        
        if (force !== 'true') {
            const cached = await redisService.get(cacheKey);
            if (cached) return res.json(cached);
        }

        // Device/User specific seed for variety on refresh (Part 1 & 4)
        const hourlySeed = Math.floor(Date.now() / (1000 * 60 * 60));
        const seed = String(currentUserId).split('-')[0] + clientSeed;

        const suggestions = await User.getSuggestions(currentUserId, {
            limit,
            offset,
            seed: seed + hourlySeed,
            tab: tab.toLowerCase(),
            filter: filter ? filter.toLowerCase() : null,
            query: q
        });
        
        const sanitizedSuggestions = suggestions.map(u => ({
            ...u,
            id: u.user_id,
            avatar: u.avatar_url || '/uploads/avatars/default.png',
            profile_picture: u.avatar_url || '/uploads/avatars/default.png',
            affiliation: u.affiliation || u.campus,
            interests: u.interests || u.major,
            experience_level: u.experience_level || u.year_of_study
        }));

        const result = { suggestions: sanitizedSuggestions };
        await redisService.set(cacheKey, result, 600); // 10 minutes

        res.json(result);
    } catch (error) {
        console.error('[User Controller] getSuggestions error:', error.message, error.stack);
        res.status(500).json({ 
            error: 'Failed to get suggestions',
            debug: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const updateNote = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { note } = req.body;

        if (note !== undefined && note !== null && note.length > 60) {
            return res.status(400).json({ error: 'Note too long (max 60 characters)' });
        }

        await User.update(userId, { note: note || null });

        // Broadcast note update via socket
        try {
            const { getIO } = require('../socket');
            const io = getIO();
            if (io) {
                const pool = require('../config/database');
                const [followers] = await pool.query(
                    'SELECT follower_id FROM follows WHERE following_id = ?',
                    [userId]
                );
                const rooms = followers.map(f => `user:${f.follower_id}`);
                rooms.push(`user:${userId}`); // Emit to self for multi-device sync
                
                if (rooms.length > 0) {
                    io.to(rooms).emit('user-note-update', {
                        userId,
                        note: note || null
                    });
                }
            }
        } catch (socketErr) {
            logger.error('Failed to broadcast note update:', socketErr);
        }

        res.json({ success: true, message: 'Note updated', note: note || null });
    } catch (error) {
        logger.error('Update note error:', error);
        res.status(500).json({ error: 'Failed to update note' });
    }
};

const getActiveFriends = async (req, res) => {
    try {
        const currentUserId = req.user.userId || req.user.user_id;
        const friends = await User.getActiveFriends(currentUserId, 20);
        res.json(friends.map(u => ({
            id: u.user_id,
            user_id: u.user_id, // for compatibility
            username: u.username,
            name: u.name,
            avatar_url: u.avatar_url || '/uploads/avatars/default.png',
            campus: u.campus,
            affiliation: u.affiliation || u.campus,
            is_online: u.is_online,
            note: u.note
        })));
    } catch (error) {
        logger.error('Get active friends error:', error);
        res.status(500).json({ error: 'Failed to get active friends' });
    }
};

const getMutualFollowers = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const mutualList = await User.getMutualFollowersList(userId);
        res.json({ success: true, mutual: mutualList });
    } catch (error) {
        logger.error('Get mutual followers error:', error);
        res.status(500).json({ success: false, error: 'Failed to get mutual connections' });
    }
};

const matchContacts = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { queries } = req.body;
        const matches = await User.matchContactsList(userId, Array.isArray(queries) ? queries : []);
        res.json({ success: true, matches });
    } catch (error) {
        logger.error('Match contacts error:', error);
        res.status(500).json({ success: false, error: 'Failed to match contacts' });
    }
};

const getUsernameSuggestions = async (req, res) => {
    try {
        const username = req.query.username || req.query.q || '';
        if (!username) {
            return res.status(400).json({ success: false, error: 'Username parameter is required', suggestions: [] });
        }
        const authService = require('../services/auth.service');
        const suggestions = await authService.generateAvailableUsernames(username);
        res.json({ success: true, suggestions });
    } catch (error) {
        logger.error('Get username suggestions error:', error);
        res.status(500).json({ success: false, error: 'Failed to generate suggestions', suggestions: [] });
    }
};

module.exports = {
    getCurrentUser,
    searchUsers,
    searchFollowingUsers,
    updateProfile,
    uploadAvatar,
    updatePassword,
    deleteAccount,
    terminateAccount,
    setHideFromUsers,
    followUser,
    unfollowUser,
    getFollowers,
    getFollowing,
    getUserProfile,
    getUserPosts,
    getSuggestions,
    getUsernameSuggestions,
    updateSettings,
    getAdvancedSettings,
    exportUserData,
    disableTwoFactor,
    enableTwoFactor,
    generate2FASecret,

    getActiveFriends,
    getActiveSessions,
    revokeSession,
    logoutAllDevices,
    generateSecurityToken,
    updateNote,
    getMyFollowers,
    getMutualFollowers,
    matchContacts
};
