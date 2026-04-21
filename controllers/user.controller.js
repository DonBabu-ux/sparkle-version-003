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
        logger.error('Get current user error:', error);
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
        logger.error('Search users error:', error);
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
        logger.error('Search following users error:', error);
        res.status(500).json({ error: 'Failed to search following users' });
    }
};

const updateProfile = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;

        // check if username is being changed and if it is taken
        if (req.body.username) {
            const existingUser = await User.findByUsername(req.body.username);
            if (existingUser && existingUser.user_id !== userId) {
                return res.status(409).json({ error: 'Username already taken' });
            }
        }

        const updates = {
            name: req.body.name,
            username: req.body.username,
            bio: req.body.bio,
            major: req.body.major,
            campus: req.body.campus,
            headline: req.body.headline,
            website: req.body.website,
            birthday: req.body.birthday || null,
            phone_number: req.body.phone_number
        };

        await User.update(userId, updates);
        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Username or email already taken' });
        }
        logger.error('Update profile error:', error);
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
            'language',
            'last_seen_privacy',
            'message_privacy',
            'dnd_start',
            'dnd_end',
            'activity_status_enabled' // if added later
        ];

        for (const key of Object.keys(req.body)) {
            if (allowedSettings.includes(key)) {
                updates[key] = req.body[key];
            }
        }

        if (Object.keys(updates).length > 0) {
            await User.updateSettings(userId, updates);
        }

        res.json({ message: 'Settings updated successfully', updates });
    } catch (error) {
        logger.error('Update settings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
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
        res.json({
            message: 'Avatar updated successfully',
            avatar_url: avatarUrl
        });

    } catch (error) {
        logger.error('Upload avatar error:', error);
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
        logger.error('Update password error:', error);
        res.status(500).json({ error: 'Failed to update password' });
    }
};

const deleteAccount = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'Password required to delete account' });
        }

        const user = await User.findById(userId);
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        await User.delete(userId);
        
        res.clearCookie('sparkleToken');
        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        logger.error('Delete account error:', error);
        res.status(500).json({ error: 'Failed to delete account' });
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
        logger.error('Get active sessions error:', error);
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
        logger.error('Revoke session error:', error);
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
        logger.error('Logout all devices error:', error);
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
        logger.error('Export user data error:', error);
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
            is_requested_by_me: !!user.is_requested_by_me
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
        const currentUserId = req.user.userId || req.user.user_id;
        const { tab = 'suggested', filter = null, q = null } = req.query;
        
        // Device/User specific seed for variety on refresh (Part 1 & 4)
        const hourlySeed = Math.floor(Date.now() / (1000 * 60 * 60));
        const seed = String(currentUserId).split('-')[0]; // Use first part of ID as deterministic seed

        const suggestions = await User.getSuggestions(currentUserId, {
            limit,
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

        res.json({ suggestions: sanitizedSuggestions });
    } catch (error) {
        logger.error('Get Probabilistic Suggestions Error:', error);
        res.status(500).json({ error: 'Failed to get suggestions' });
    }
};

const getActiveFriends = async (req, res) => {
    try {
        const currentUserId = req.user.userId || req.user.user_id;
        const friends = await User.getActiveFriends(currentUserId, 20);
        res.json(friends.map(u => ({
            id: u.user_id,
            username: u.username,
            name: u.name,
            avatar_url: u.avatar_url || '/uploads/avatars/default.png',
            campus: u.campus,
            affiliation: u.affiliation || u.campus,
            is_online: u.is_online
        })));
    } catch (error) {
        logger.error('Get active friends error:', error);
        res.status(500).json({ error: 'Failed to get active friends' });
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
    followUser,
    unfollowUser,
    getFollowers,
    getFollowing,
    getUserProfile,
    getUserPosts,
    getSuggestions,
    updateSettings,
    exportUserData,
    disableTwoFactor,
    enableTwoFactor,
    generate2FASecret,

    getActiveFriends,
    getActiveSessions,
    revokeSession,
    logoutAllDevices,
    generateSecurityToken
};
