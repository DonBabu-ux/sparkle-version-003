const User = require('../models/User');
const Post = require('../models/Post');
const pool = require('../config/database');
const logger = require('../utils/logger');
const { formatUserDisplay } = require('../helpers/userFormat.helper');

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
        return '/uploads/defaults/no-image.png';
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

            // Hard check for blocks (web view)
            const [blockCheck] = await pool.query(
                'SELECT 1 FROM user_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
                [currentUserId, userProfile.user_id, userProfile.user_id, currentUserId]
            );

            if (blockCheck.length > 0) {
                return res.status(404).render('error', { error: 'User not found' });
            }

            isOwnProfile = (Number(currentUserId) === Number(userProfile.user_id));
        }

        // Fetch partner info if relationship exists
        if (userProfile.partner_id) {
            const [partner] = await pool.query('SELECT name, username FROM users WHERE user_id = ?', [userProfile.partner_id]);
            if (partner.length > 0) {
                userProfile.partner_name = partner[0].name;
                userProfile.partner_username = partner[0].username;
            }
        }

        userProfile.avatar_url = getSafeAvatarUrl(userProfile.avatar_url);

        const posts = await Post.getUserPosts(userProfile.user_id, currentUserId);
        const sanitizedPosts = posts.map(p => ({ ...p, media_url: getSafeMediaUrl(p.media_url) }));

        // 1. Fetch active friends (mutual connections currently online/active)
        const activeFriends = await User.getActiveFriends(currentUserId, 15);

        // 2. Fetch following list for "Friends List" section
        let followingList = [];
        if (isOwnProfile) {
            followingList = await User.getFollowingDetailed(currentUserId, currentUserId);
        }

        // Fetch mutual connections if viewing someone else
        let mutualConnections = [];
        if (!isOwnProfile) {
            mutualConnections = await User.getMutualConnections(currentUserId, userProfile.user_id);
        }

        const displayProfile = formatUserDisplay(userProfile);

        res.render('profile', {
            title: isOwnProfile ? 'My Profile' : `${displayProfile.name}'s Profile`,
            user: req.user, // for nav
            profile: displayProfile,
            posts: sanitizedPosts || [],
            mutualConnections,
            activeFriends: activeFriends.map(u => ({ ...u, avatar_url: getSafeAvatarUrl(u.avatar_url) })),
            followingList: followingList.map(u => ({ ...u, avatar_url: getSafeAvatarUrl(u.avatar_url) })),
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

const getSimilarBirthdays = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const [me] = await pool.query('SELECT birthday FROM users WHERE user_id = ?', [userId]);
        
        if (!me[0] || !me[0].birthday) {
            return res.json([]);
        }

        const birthday = new Date(me[0].birthday);
        const month = birthday.getMonth() + 1;
        const day = birthday.getDate();

        const [users] = await pool.query(
            `SELECT user_id, username, name, avatar_url, campus, major
             FROM users 
             WHERE MONTH(birthday) = ? AND DAY(birthday) = ? AND user_id != ?
             LIMIT 50`,
            [month, day, userId]
        );

        res.json(users.map(u => ({
            ...u,
            avatar_url: getSafeAvatarUrl(u.avatar_url)
        })));
    } catch (error) {
        logger.error('Get Similar Birthdays Error:', error);
        res.status(500).json({ error: 'Failed to fetch similar birthdays' });
    }
};

module.exports = { renderProfile, renderSettings, getSavedPosts, getSimilarBirthdays };
