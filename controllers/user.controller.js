const User = require('../models/User');
const Post = require('../models/Post');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');
const { downloadExternalImage } = require('../utils/media.utils');
const notificationController = require('./notification.controller');

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
        const { campus, major, year } = req.query;

        // Use more detailed search if filters are provided
        let users;
        if (campus || major || year) {
            // We can use a custom query here or update User.search
            // For now let's just use User.search but we might want to extend it
            users = await User.search(query, currentUserId, 20);
        } else {
            users = await User.search(query, currentUserId);
        }

        const sanitizedUsers = users.map(u => ({
            ...u,
            id: u.user_id,
            avatar: u.avatar_url || '/uploads/avatars/default.png'
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
        const updates = {
            name: req.body.name,
            bio: req.body.bio,
            major: req.body.major,
            campus: req.body.campus
        };

        await User.update(userId, updates);
        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
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
            // privacy / visibility
            'is_private',
            'anonymous_enabled',
            'profile_visibility',
            'is_online',
            'last_seen_privacy',
            'message_privacy',

            // notifications
            'push_notifications',
            'email_notifications',
            'dnd_start',
            'dnd_end',

            // appearance / localization
            'dark_mode_enabled',
            'theme',
            'font_size',
            'language',

            // account
            // note: account_status is intentionally not exposed here; admin-only
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
        // In a real app, we might check for sub-items or soft-delete
        await User.delete(userId);
        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        logger.error('Delete account error:', error);
        res.status(500).json({ error: 'Failed to delete account' });
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
            Post.getUserPosts(userId),
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

const toggleTwoFactor = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { enabled } = req.body;

        // Foundation for 2FA: in a real app, generate secret/QR here
        // For now, we update a flag in the settings
        await User.updateSettings(userId, { two_factor_enabled: enabled ? 1 : 0 });

        res.json({
            success: true,
            message: `Two-factor authentication ${enabled ? 'enabled' : 'disabled'} successfully.`,
            two_factor_enabled: enabled
        });
    } catch (error) {
        logger.error('Toggle 2FA error:', error);
        res.status(500).json({ error: 'Failed to update 2FA settings' });
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

        if (existing.length > 0) {
            // Toggle off (unfollow)
            await User.unfollow(followerId, followingId);
            return res.json({ success: true, status: 'unfollowed', message: 'User unfollowed' });
        }

        // Toggle on (follow)
        const result = await User.follow(followerId, followingId);

        res.json({ success: true, status: result.status, message: result.status === 'requested' ? 'Follow request sent' : 'User followed' });
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
        res.json({ success: true, message: 'User unfollowed' });
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

        let user;
        // Basic check if it's a UUID (very loose but enough for Sparkle's UUIDs)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

        if (isUuid) {
            user = await User.findById(identifier);
        } else {
            user = await User.getProfileWithStats(identifier, currentUserId);
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
        const posts = await Post.getUserPosts(userId);
        
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
        const limit = parseInt(req.query.limit) || 5;
        const currentUserId = req.user.userId || req.user.user_id;
        const suggestions = await User.getSuggestions(currentUserId, limit);
        res.json(suggestions);
    } catch (error) {
        logger.error('Get suggestions error:', error);
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
    toggleTwoFactor,
    getActiveFriends
};
