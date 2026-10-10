const ModerationService = require('../services/moderation.service');
const logger = require('../utils/logger');

exports.reportPost = async (req, res) => {
    try {
        const { post_id, reason } = req.body;
        const reporter_id = req.user.user_id;

        if (!post_id || !reason) {
            return res.status(400).json({ success: false, message: 'post_id and reason are required' });
        }

        const result = await ModerationService.createReport(post_id, reporter_id, reason);
        res.status(201).json(result);
    } catch (err) {
        logger.error('Report Post Error:', err);
        if (err.message === 'You have already reported this post.') {
            return res.status(400).json({ success: false, message: err.message });
        }
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

exports.appealPost = async (req, res) => {
    try {
        const { post_id, reason } = req.body;
        const user_id = req.user.user_id;

        if (!post_id || !reason) {
            return res.status(400).json({ success: false, message: 'post_id and reason are required' });
        }

        const result = await ModerationService.submitAppeal(post_id, user_id, reason);
        res.status(201).json(result);
    } catch (err) {
        logger.error('Appeal Post Error:', err);
        if (['Post not found', 'You can only appeal your own posts', 'This post is already active', 'An appeal is already pending for this post'].includes(err.message)) {
            return res.status(400).json({ success: false, message: err.message });
        }
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Admin/Moderator Only Endpoint
exports.reviewAppeal = async (req, res) => {
    try {
        const { appeal_id } = req.params;
        const { decision } = req.body; // 'approve' or 'reject'

        if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
            return res.status(403).json({ success: false, message: 'Unauthorized. Admins and moderators only.' });
        }

        if (!['approve', 'reject'].includes(decision)) {
            return res.status(400).json({ success: false, message: "Decision must be 'approve' or 'reject'" });
        }

        const result = await ModerationService.reviewAppeal(appeal_id, decision);
        res.status(200).json(result);
    } catch (err) {
        logger.error('Review Appeal Error:', err);
        if (['Appeal not found', 'Appeal already reviewed'].includes(err.message)) {
            return res.status(400).json({ success: false, message: err.message });
        }
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
