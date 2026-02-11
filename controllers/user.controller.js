const User = require('../models/User');
const Post = require('../models/Post');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');

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

        const users = await User.search(query, currentUserId);
        res.json(users);
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

        // whitelist allowed settings
        const allowedSettings = [
            'anonymous_enabled',
            'profile_visibility',
            'push_notifications',
            'email_notifications',
            'is_online' // activity status
        ];

        for (const key of Object.keys(req.body)) {
            if (allowedSettings.includes(key)) {
                updates[key] = req.body[key];
            }
        }

        if (Object.keys(updates).length > 0) {
            await User.update(userId, updates);
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

        // req.file.path contains the Cloudinary URL when using multer-storage-cloudinary
        const avatarUrl = req.file ? req.file.path : (req.body.avatar_url || '/uploads/avatars/default.png');

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
        await User.delete(userId);
        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        logger.error('Delete account error:', error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
};

const followUser = async (req, res) => {
    try {
        const followerId = req.user.userId || req.user.user_id;
        const followingId = req.params.id;
        await User.follow(followerId, followingId);
        res.json({ success: true, message: 'User followed' });
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
        const followers = await User.getFollowers(userId);
        res.json(followers);
    } catch (error) {
        logger.error('Get followers error:', error);
        res.status(500).json({ error: 'Failed to get followers' });
    }
};

const getFollowing = async (req, res) => {
    try {
        const userId = req.params.id;
        const following = await User.getFollowing(userId);
        res.json(following);
    } catch (error) {
        logger.error('Get following error:', error);
        res.status(500).json({ error: 'Failed to get following' });
    }
};

const getUserProfile = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (error) {
        logger.error('Get user profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
};

const getUserPosts = async (req, res) => {
    try {
        const userId = req.params.id;
        const posts = await Post.getUserPosts(userId);
        res.json(posts);
    } catch (error) {
        logger.error('Get user posts error:', error);
        res.status(500).json({ error: 'Failed to get posts' });
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
    getUserProfile,
    getUserPosts,
    updateSettings
};
