const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const notificationController = {
    // Get user's notifications
    getNotifications: async (req, res) => {
        try {
            const userId = req.user.userId || req.user.user_id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;

            // optionally filter for unread only (used by polling)
            const unreadOnly = req.query.unreadOnly === 'true' || req.query.unreadOnly === '1';
            let baseSql = `
                SELECT n.*, u.username as actor_username, u.name as actor_name, u.avatar_url as actor_avatar
                FROM notifications n
                LEFT JOIN users u ON n.actor_id = u.user_id
                WHERE n.user_id = ?`;
            const params = [userId];
            if (unreadOnly) {
                baseSql += ` AND n.is_read = 0`;
            }
            baseSql += ` ORDER BY n.created_at DESC LIMIT ? OFFSET ?`;
            params.push(limit, offset);

            const [notifications] = await pool.query(baseSql, params);

            // Get total count for pagination
            const [[{ total }]] = await pool.query(`
                SELECT COUNT(*) as total FROM notifications WHERE user_id = ?
            `, [userId]);

            res.json({
                notifications,
                pagination: {
                    total,
                    page,
                    totalPages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            console.error('Error fetching notifications:', error);
            res.status(500).json({ error: 'Failed to fetch notifications' });
        }
    },

    // Get unread count
    getUnreadCount: async (req, res) => {
        try {
            const userId = req.user.userId || req.user.user_id;
            
            const [[{ unread_count }]] = await pool.query(`
                SELECT COUNT(*) as unread_count 
                FROM notifications 
                WHERE user_id = ? AND is_read = 0
            `, [userId]);

            res.json({ unreadCount: unread_count });
        } catch (error) {
            console.error('Error fetching unread count:', error);
            res.status(500).json({ error: 'Failed to fetch unread count' });
        }
    },

    // Mark a specific notification as read
    markAsRead: async (req, res) => {
        try {
            const userId = req.user.userId || req.user.user_id;
            const { notificationId } = req.params;

            const [result] = await pool.query(`
                UPDATE notifications 
                SET is_read = 1, read_at = CURRENT_TIMESTAMP 
                WHERE notification_id = ? AND user_id = ?
            `, [notificationId, userId]);

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Notification not found' });
            }

            res.json({ message: 'Notification marked as read' });
        } catch (error) {
            console.error('Error marking notification as read:', error);
            res.status(500).json({ error: 'Failed to mark notification as read' });
        }
    },

    // Mark all notifications as read
    markAllAsRead: async (req, res) => {
        try {
            const userId = req.user.userId || req.user.user_id;

            await pool.query(`
                UPDATE notifications 
                SET is_read = 1, read_at = CURRENT_TIMESTAMP 
                WHERE user_id = ? AND is_read = 0
            `, [userId]);

            res.json({ message: 'All notifications marked as read' });
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            res.status(500).json({ error: 'Failed to mark all notifications as read' });
        }
    },

    // Helper function to create a notification (intended for internal use by other controllers)
    createNotification: async (data, connection = pool) => {
        try {
            // Don't notify users about their own actions
            if (data.user_id === data.actor_id) return null;

            const notificationId = uuidv4();
            await connection.query(`
                INSERT INTO notifications (
                    notification_id, user_id, type, title, content, 
                    related_id, related_type, actor_id, action_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                notificationId,
                data.user_id,
                data.type,
                data.title,
                data.content,
                data.related_id || null,
                data.related_type || null,
                data.actor_id || null,
                data.action_url || null
            ]);
            
            return notificationId;
        } catch (error) {
            console.error('Error creating notification via helper:', error);
            // Non-blocking error
            return null;
        }
    }
};

module.exports = notificationController;
