const pool = require('../config/database');
const { getIO } = require('../socket');
const logger = require('../utils/logger');

// Get online friends
const getOnlineFriends = async (req, res) => {
    try {
        const [onlineUsers] = await pool.query(
            `SELECT u.user_id, u.username, u.name, u.avatar_url, u.is_online, u.last_seen_at
             FROM users u
             INNER JOIN follows f ON (f.following_id = u.user_id)
             WHERE f.follower_id = ? AND u.is_online = true
             ORDER BY u.last_seen_at DESC`,
            [req.user.userId || req.user.user_id]
        );

        res.json({ status: 'success', data: onlineUsers });
    } catch (error) {
        logger.error('Get online friends error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get user presence info
const getUserPresence = async (req, res) => {
    try {
        const { userId } = req.params;

        const [users] = await pool.query(
            'SELECT is_online, last_seen_at FROM users WHERE user_id = ?',
            [userId]
        );

        if (!users[0]) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            status: 'success',
            data: {
                is_online: users[0].is_online,
                last_seen_at: users[0].last_seen_at
            }
        });
    } catch (error) {
        logger.error('Get user presence error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get chat history with pagination
const getChatHistory = async (req, res) => {
    try {
        const { chatId } = req.params;
        const { limit = 50, before } = req.query;
        const userId = req.user.userId || req.user.user_id;

        // Verify user is participant
        const [chats] = await pool.query(
            `SELECT * FROM personal_chats 
             WHERE chat_id = ? AND (participant1_id = ? OR participant2_id = ?)`,
            [chatId, userId, userId]
        );

        if (!chats[0]) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        let query = `
            SELECT m.*, 
                   u.username as sender_username,
                   u.name as sender_name,
                   u.avatar_url as sender_avatar
            FROM messages m
            JOIN users u ON m.sender_id = u.user_id
            WHERE m.personal_chat_id = ?
        `;
        const params = [chatId];

        if (before) {
            query += ' AND m.created_at < ?';
            params.push(before);
        }

        query += ' ORDER BY m.created_at DESC LIMIT ?';
        params.push(parseInt(limit));

        const [messages] = await pool.query(query, params);

        res.json({
            status: 'success',
            data: messages.reverse() // Return in chronological order
        });
    } catch (error) {
        logger.error('Get chat history error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Mark all messages as read
const markAllAsRead = async (req, res) => {
    try {
        const { chatId } = req.params;
        const userId = req.user.userId || req.user.user_id;

        await pool.query(
            `UPDATE messages 
             SET is_read = true 
             WHERE personal_chat_id = ? AND sender_id != ? AND is_read = false`,
            [chatId, userId]
        );

        // Broadcast to other participants
        try {
            const io = getIO();
            io.to(`chat:${chatId}`).emit('all-messages-read', {
                userId,
                chatId
            });
        } catch (e) {
            // Socket may not be initialized in some contexts
        }

        res.json({ status: 'success', message: 'All messages marked as read' });
    } catch (error) {
        logger.error('Mark all as read error:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getOnlineFriends,
    getUserPresence,
    getChatHistory,
    markAllAsRead
};
