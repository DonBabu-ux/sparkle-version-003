const User = require('../models/User');
const pool = require('../config/database');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Profile logic helper
const getSafeAvatarUrl = (url) => {
    if (!url) return '/uploads/avatars/default.png';
    if (url.startsWith('http')) return url;
    return url.startsWith('/') ? url : '/' + url;
};

/**
 * 🚀 PRODUCTION RECOMMENDATION ALGORITHM
 * Implements a 3-stage pipeline: Candidate Generation -> Scoring Engine -> Exploration.
 */

module.exports = {
    blockUser: async (req, res) => {
        try {
            const currentUserId = req.user?.user_id || req.user?.userId;
            const targetId = req.params.id;
            const { isSystemAccountId } = require('../helpers/systemAccount.helper');

            if (isSystemAccountId(targetId)) {
                return res.status(403).json({ error: 'Cannot block the Sparkle official account' });
            }
            
            if (!currentUserId || !targetId) {
                return res.status(400).json({ error: 'Missing user ID' });
            }

            console.log(`[Social] Block request: ${currentUserId} -> ${targetId}`);
            await User.blockUser(currentUserId, targetId);

            // 🔥 MARKETPLACE AUTO-ARCHIVE
            try {
                await pool.query(
                    `UPDATE marketplace_conversations SET is_archived = 1 WHERE (buyer_id = ? AND seller_id = ?) OR (buyer_id = ? AND seller_id = ?)`,
                    [currentUserId, targetId, targetId, currentUserId]
                );
            } catch (archiveErr) {
                console.error('[Social] Marketplace archive failed during block:', archiveErr.message);
                // We don't fail the whole block if only marketplace archiving fails
            }

            // Real-time Socket.IO notification to both users
            try {
                const { getIO } = require('../socket');
                const io = getIO();
                if (io) {
                    io.to(`user:${currentUserId}`).emit('conversation_blocked', {
                        partnerId: targetId,
                        conversationStatus: 'blocked',
                        isBlockedByMe: true,
                        amIBlocked: false,
                        canSendMessages: false
                    });
                    io.to(`user:${targetId}`).emit('conversation_blocked', {
                        partnerId: currentUserId,
                        conversationStatus: 'blocked',
                        isBlockedByMe: false,
                        amIBlocked: true,
                        canSendMessages: false
                    });
                }
            } catch (sErr) {
                console.error('[Social] Socket block emit warning:', sErr.message);
            }

            res.json({ success: true, message: 'User blocked' });
        } catch (error) {
            console.error('[Social] Block failed:', error);
            const status = error.message.includes('cannot block yourself') ? 400 : 500;
            res.status(status).json({ error: error.message || 'Block operation failed' });
        }
    },
    getBlockStatus: async (req, res) => {
        try {
            const currentUserId = req.user?.user_id || req.user?.userId;
            const targetId = req.params.id;
            
            const [blocks] = await pool.query(
                'SELECT blocker_id, blocked_id FROM user_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
                [currentUserId, targetId, targetId, currentUserId]
            );

            const isBlockedByMe = blocks.some(b => b.blocker_id === currentUserId && b.blocked_id === targetId);
            const amIBlocked = blocks.some(b => b.blocker_id === targetId && b.blocked_id === currentUserId);

            res.json({ isBlockedByMe, amIBlocked });
        } catch (error) {
            console.error('[Social] Get block status failed:', error);
            res.status(500).json({ error: error.message });
        }
    },
    unblockUser: async (req, res) => {
        try {
            const currentUserId = req.user?.user_id || req.user?.userId;
            const targetId = req.params.id;
            await User.unblockUser(currentUserId, targetId);

            // Real-time Socket.IO notification to both users
            try {
                const { getIO } = require('../socket');
                const io = getIO();
                if (io) {
                    io.to(`user:${currentUserId}`).emit('conversation_unblocked', {
                        partnerId: targetId,
                        conversationStatus: 'active',
                        isBlockedByMe: false,
                        amIBlocked: false,
                        canSendMessages: true
                    });
                    io.to(`user:${targetId}`).emit('conversation_unblocked', {
                        partnerId: currentUserId,
                        conversationStatus: 'active',
                        isBlockedByMe: false,
                        amIBlocked: false,
                        canSendMessages: true
                    });
                }
            } catch (sErr) {
                console.error('[Social] Socket unblock emit warning:', sErr.message);
            }

            res.json({ success: true, message: 'User unblocked' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
    getBlockedUsers: async (req, res) => {
        try {
            const currentUserId = req.user?.user_id || req.user?.userId;
            const blocks = await User.getBlockedUsers(currentUserId);
            res.json(blocks);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
    getFollowRequests: async (req, res) => {
        try {
            const currentUserId = req.user?.user_id || req.user?.userId;
            const requests = await User.getPendingFollowRequests(currentUserId);
            res.json(requests);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
    respondToFollowRequest: async (req, res) => {
        try {
            const currentUserId = req.user?.user_id || req.user?.userId;
            const { requestId, status } = req.body;
            if (status === 'accepted') {
                await User.acceptFollowRequest(requestId, currentUserId);
            } else {
                await User.rejectFollowRequest(requestId, currentUserId);
            }
            res.json({ success: true, status });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
    acceptRequest: async (req, res) => {
        try {
            const currentUserId = req.user?.user_id || req.user?.userId;
            const { requestId } = req.params;
            await User.acceptFollowRequest(requestId, currentUserId);
            res.json({ success: true, message: 'Request accepted' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
    rejectRequest: async (req, res) => {
        try {
            const currentUserId = req.user?.user_id || req.user?.userId;
            const { requestId } = req.params;
            await User.rejectFollowRequest(requestId, currentUserId);
            res.json({ success: true, message: 'Request rejected' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
    muteUser: async (req, res) => {
        const { isSystemAccount } = require('../helpers/systemAccount.helper');
        if (isSystemAccount(req.params.id)) {
            return res.status(403).json({ error: 'Cannot mute official Sparkle accounts' });
        }
        return res.json({ success: true, message: 'User muted (Placeholder)' });
    },
    unmuteUser: async (req, res) => res.json({ success: true, message: 'User unmuted (Placeholder)' }),
    reportUser: async (req, res) => {
        try {
            const reporterId = req.user?.user_id || req.user?.userId;
            const targetId = req.params.id;
            const { reason, description } = req.body;
            const { isSystemAccount } = require('../helpers/systemAccount.helper');

            if (isSystemAccount(targetId)) {
                return res.status(403).json({ error: 'Cannot report official Sparkle accounts' });
            }

            if (!reporterId || !targetId) {
                return res.status(400).json({ error: 'Missing user ID' });
            }

            // The system uses 'user_reports' table as defined in init.js
            const fullReason = description ? `${reason}: ${description}` : reason;
            
            await pool.query(
                `INSERT INTO user_reports (report_id, reporter_id, reported_id, reason, status) VALUES (?, ?, ?, ?, ?)`,
                [crypto.randomUUID(), reporterId, targetId, fullReason, 'pending']
            );

            console.log(`[Social] Report submitted: ${reporterId} -> ${targetId}`);
            res.json({ success: true, message: 'Report submitted successfully' });
        } catch (error) {
            console.error('[Social] Report failed:', error);
            res.status(500).json({ error: error.message || 'Report operation failed' });
        }
    },
    
    pokeUser: async (req, res) => {
        try {
            const currentUserId = req.user?.user_id || req.user?.userId;
            const targetId = req.params.id;
            
            if (currentUserId === targetId) {
                return res.status(400).json({ error: "You can't poke yourself!" });
            }

            const targetUser = await User.findById(targetId);
            if (!targetUser) {
                return res.status(404).json({ error: 'User not found' });
            }

            const currentUser = await User.findById(currentUserId);

            // Create notification
            const notificationController = require('./notification.controller');
            await notificationController.createNotification({
                user_id: targetId,
                actor_id: currentUserId,
                type: 'poke',
                title: 'You were poked!',
                content: `${currentUser.name} poked you! 👋`,
                action_url: `/profile/${currentUser.username}`
            });

            res.json({ success: true, message: `You poked ${targetUser.name}!` });
        } catch (error) {
            console.error('Poke Error:', error);
            res.status(500).json({ error: 'Failed to send poke' });
        }
    }
};
