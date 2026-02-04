const User = require('../models/User');
const Post = require('../models/Post');
const logger = require('../utils/logger');

// Helper to sanitize avatars - prioritizes internal uploads and whitelisted CDNs
const getSafeAvatarUrl = (url) => {
    if (!url) return '/uploads/avatars/default.png';
    if (url.startsWith('/uploads/')) return url;
    if (url.includes('res.cloudinary.com')) return url;

    // Filter out known broken/unauthorized external URLs (like expired FB links)
    if (url.includes('fbcdn.net') || url.includes('fbsbx.com')) {
        return '/uploads/avatars/default.png';
    }

    // Default fallback if we're not sure
    return url;
};

// Helper for post media - prioritizes internal uploads, fallbacks for broken external
const getSafeMediaUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('/uploads/')) return url;
    if (url.includes('res.cloudinary.com')) return url;

    if (url.includes('fbcdn.net') || url.includes('fbsbx.com')) {
        // Return a high-quality placeholder for broken media
        return 'https://images.unsplash.com/photo-1543269865-cbf427effbad?q=60&w=800';
    }
    return url;
};

const renderProfile = async (req, res) => {
    try {
        const { username } = req.params;
        const currentUserId = req.user.userId || req.user.user_id;

        let userProfile;
        let isOwnProfile = false;

        if (!username) {
            userProfile = await User.findById(currentUserId);
            if (!userProfile) return res.status(404).render('error', { error: 'User not found' });
            isOwnProfile = true;
        } else {
            userProfile = await User.getProfileWithStats(username, currentUserId);
            if (!userProfile) return res.status(404).render('error', { error: 'User not found' });
            isOwnProfile = (currentUserId === userProfile.user_id);
        }

        userProfile.avatar_url = getSafeAvatarUrl(userProfile.avatar_url);

        const posts = await Post.getUserPosts(userProfile.user_id);
        const sanitizedPosts = posts.map(p => ({ ...p, media_url: getSafeMediaUrl(p.media_url) }));

        res.render('profile', {
            title: isOwnProfile ? 'My Profile' : `${userProfile.name}'s Profile`,
            profile: userProfile,
            posts: sanitizedPosts || [],
            mutualConnections: [],
            isOwnProfile
        });
    } catch (error) {
        logger.error('Profile View Error:', error);
        res.status(500).render('error', { error: 'Failed to load profile' });
    }
};

const renderSettings = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const user = await User.findById(userId);
        if (!user) return res.redirect('/login');

        res.render('settings', { title: 'Settings', user });
    } catch (error) {
        logger.error('Settings View Error:', error);
        res.status(500).render('error', { message: 'Failed to load settings' });
    }
};

const getSavedPosts = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const posts = await Post.getSavedPosts(userId);
        const sanitizedPosts = posts.map(p => ({
            ...p,
            media_url: getSafeMediaUrl(p.media_url),
            avatar_url: getSafeAvatarUrl(p.avatar_url)
        }));
        res.json(sanitizedPosts);
    } catch (error) {
        logger.error('Get Saved Posts Error:', error);
        res.status(500).json({ error: 'Failed to fetch saved posts' });
    }
};

module.exports = { renderProfile, renderSettings, getSavedPosts };
