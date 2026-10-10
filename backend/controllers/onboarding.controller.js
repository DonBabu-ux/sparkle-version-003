// controllers/onboarding.controller.js
const { query } = require('../utils/database/query');
const logger = require('../utils/logger');
const recommendationService = require('../services/recommendation.service');

const getStatus = async (req, res) => {
    try {
        const currentUserId = req.user?.userId || req.user?.user_id;
        if (!currentUserId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const userRows = await query('SELECT onboarding_step FROM users WHERE user_id = ? LIMIT 1', [currentUserId]);
        if (userRows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            data: {
                onboarding_step: userRows[0].onboarding_step
            }
        });
    } catch (error) {
        logger.error('Onboarding Status Error:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve onboarding status' });
    }
};

const getPopularUsers = async (req, res) => {
    try {
        const currentUserId = req.user?.userId || req.user?.user_id;
        const creators = await recommendationService.getPopularCreators(10, currentUserId);
        res.json({
            success: true,
            data: { creators }
        });
    } catch (error) {
        logger.error('Onboarding Popular Users Error:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve popular users' });
    }
};

const getRecommendations = async (req, res) => {
    try {
        const currentUserId = req.user?.userId || req.user?.user_id;
        const { category, page = 1, limit = 10 } = req.query;

        let creators;
        if (category) {
            creators = await recommendationService.getCreatorsByCategory(category, page, limit, currentUserId);
        } else {
            creators = await recommendationService.getPopularCreators(limit, currentUserId);
        }

        res.json({
            success: true,
            data: { creators }
        });
    } catch (error) {
        logger.error('Onboarding Recommendations Error:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve recommendations' });
    }
};

const followCreators = async (req, res) => {
    try {
        const currentUserId = req.user?.userId || req.user?.user_id;
        const { userIds } = req.body;

        if (!currentUserId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ success: false, message: 'userIds array is required' });
        }

        const { transaction } = require('../utils/database/transaction');
        const crypto = require('crypto');

        await transaction(async (conn) => {
            for (const targetId of userIds) {
                // Insert follow, using INSERT IGNORE to prevent error if already followed
                await conn.execute(
                    'INSERT IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)',
                    [currentUserId, targetId]
                );

                // Create follow notification if not exists
                const [notifExists] = await conn.execute(
                    'SELECT 1 FROM notifications WHERE user_id = ? AND actor_id = ? AND type = "follow" LIMIT 1',
                    [targetId, currentUserId]
                );

                if (notifExists.length === 0) {
                    await conn.execute(
                        `INSERT INTO notifications 
                        (notification_id, user_id, type, title, content, related_id, related_type, actor_id, action_url) 
                        VALUES (?, ?, 'follow', 'New Follower', 'Someone started following you.', ?, 'user', ?, '/connect')`,
                        [crypto.randomUUID(), targetId, currentUserId, currentUserId]
                    );
                }
            }

            // Move onboarding step forward (step 2 for following creators)
            await conn.execute(
                'UPDATE users SET onboarding_step = GREATEST(onboarding_step, 2) WHERE user_id = ?',
                [currentUserId]
            );
        });

        res.json({ success: true, message: `Successfully followed ${userIds.length} creators.` });
    } catch (error) {
        logger.error('Onboarding Follow Error:', error);
        res.status(500).json({ success: false, message: 'Failed to follow creators.' });
    }
};

const saveInterests = async (req, res) => {
    try {
        const currentUserId = req.user?.userId || req.user?.user_id;
        const { interests } = req.body;

        if (!currentUserId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        if (!Array.isArray(interests) || interests.length === 0) {
            return res.status(400).json({ success: false, message: 'interests array is required' });
        }

        const { transaction } = require('../utils/database/transaction');

        await transaction(async (conn) => {
            // First delete existing interests for this user
            await conn.execute('DELETE FROM user_interests WHERE user_id = ?', [currentUserId]);

            // Insert new interests
            for (const slug of interests) {
                const cleanSlug = String(slug).trim().toLowerCase().substring(0, 64);
                if (cleanSlug) {
                    await conn.execute(
                        'INSERT INTO user_interests (user_id, interest_slug) VALUES (?, ?)',
                        [currentUserId, cleanSlug]
                    );
                }
            }

            // Move onboarding step forward (step 1 for interests selection)
            await conn.execute(
                'UPDATE users SET onboarding_step = GREATEST(onboarding_step, 1) WHERE user_id = ?',
                [currentUserId]
            );
        });

        res.json({ success: true, message: 'Interests saved successfully.' });
    } catch (error) {
        logger.error('Onboarding Interests Error:', error);
        res.status(500).json({ success: false, message: 'Failed to save interests.' });
    }
};

const completeOnboarding = async (req, res) => {
    try {
        const currentUserId = req.user?.userId || req.user?.user_id;
        if (!currentUserId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { safeQuery } = require('../config/database');
        const { logEvent } = require('../utils/analytics');

        await safeQuery('UPDATE users SET onboarding_step = 6 WHERE user_id = ?', [currentUserId]);
        await logEvent('onboarding_completed', currentUserId, { completedAt: new Date().toISOString() });

        res.json({ 
            success: true, 
            message: 'Onboarding completed successfully.',
            next: {
                route: '/dashboard',
                reason: 'READY'
            }
        });
    } catch (error) {
        logger.error('Onboarding Complete Error:', error);
        res.status(500).json({ success: false, message: 'Failed to complete onboarding.' });
    }
};

module.exports = {
    getStatus,
    getPopularUsers,
    getRecommendations,
    followCreators,
    saveInterests,
    completeOnboarding
};
