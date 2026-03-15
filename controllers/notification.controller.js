const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const webpush = require('web-push');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        'mailto:sparkle@example.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}
let _emitNotification = null;
const getEmitter = () => {
    if (!_emitNotification) {
        try { _emitNotification = require('../socket').emitNotification; } catch (e) { /* not yet init */ }
    }
    return _emitNotification;
};

const notificationController = {
    subscribePush: async (req, res) => {
        try {
            const userId = req.user.userId || req.user.user_id;
            const subscription = req.body;
            
            if (!subscription || !subscription.endpoint) {
                return res.status(400).json({ error: 'Invalid subscription object' });
            }
            
            // Check if exists
            const [existing] = await pool.query('SELECT id FROM push_subscriptions WHERE user_id = ? AND endpoint = ?', [userId, subscription.endpoint]);
            if (existing.length === 0) {
                await pool.query('INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)', [
                    userId,
                    subscription.endpoint,
                    subscription.keys.p256dh,
                    subscription.keys.auth
                ]);
            }
            res.status(201).json({ message: 'Subscribed' });
        } catch (error) {
            console.error('Push subscribe error:', error);
            res.status(500).json({ error: 'Failed' });
        }
    },
    
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
                LEFT JOIN users u ON u.user_id = COALESCE(n.related_user_id, n.actor_id)
                WHERE n.user_id = ?`;
            const params = [userId];
            if (unreadOnly) {
                baseSql += ` AND n.is_read = 0`;
            }
            baseSql += ` ORDER BY n.created_at DESC LIMIT ? OFFSET ?`;
            params.push(limit, offset);

            const [rows] = await pool.query(baseSql, params);

            const notifications = rows.map(n => ({
                id: n.id || n.notification_id,
                message: n.message || n.content || n.title,
                type: n.type,
                is_read: !!n.is_read,
                created_at: n.created_at,
                related_user: n.actor_id || n.related_user_id ? {
                    id: n.related_user_id || n.actor_id,
                    username: n.actor_username,
                    name: n.actor_name,
                    avatar: n.actor_avatar
                } : null,
                related_post_id: n.related_post_id || n.related_id,
                
                // Backwards compatibility keys
                notification_id: n.notification_id,
                content: n.content,
                title: n.title,
                actor_id: n.actor_id,
                actor_name: n.actor_name,
                actor_username: n.actor_username,
                actor_avatar: n.actor_avatar,
                action_url: n.action_url
            }));

            res.json(notifications);
        } catch (error) {
            console.error('Error fetching notifications:', error);
            res.status(500).json({ error: 'Failed to fetch notifications' });
        }
    },

    clearNotifications: async (req, res) => {
        try {
            const userId = req.user.userId || req.user.user_id;
            await pool.query('DELETE FROM notifications WHERE user_id = ?', [userId]);
            res.json({ message: 'Notifications cleared' });
        } catch (error) {
            res.status(500).json({ error: 'Failed to clear notifications' });
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

            // Fetch actor info for the socket payload
            let actorInfo = { actor_name: data.actor_name || '', actor_avatar: '/uploads/avatars/default.png', actor_username: '' };
            if (data.actor_id) {
                try {
                    const [[actor]] = await pool.query(
                        'SELECT name as actor_name, username as actor_username, avatar_url as actor_avatar FROM users WHERE user_id = ?',
                        [data.actor_id]
                    );
                    if (actor) actorInfo = actor;
                } catch (_) { /* non-blocking */ }
            }

            // Emit real-time socket notification
            const emitter = getEmitter();
            if (emitter) {
                emitter(data.user_id, {
                    notification_id: notificationId,
                    id: notificationId,
                    type: data.type,
                    title: data.title,
                    content: data.content,
                    action_url: data.action_url || null,
                    actor_id: data.actor_id || null,
                    ...actorInfo,
                    is_read: false,
                    created_at: new Date().toISOString()
                });
            }
            
            // Send web push notification
            try {
                if (process.env.VAPID_PUBLIC_KEY) {
                    const [subs] = await connection.query('SELECT * FROM push_subscriptions WHERE user_id = ?', [data.user_id]);
                    const payload = JSON.stringify({
                        title: data.title || 'Sparkle Notification',
                        body: data.content,
                        icon: actorInfo.actor_avatar || '/images/logo.png',
                        url: data.action_url || '/'
                    });
                    
                    for (const sub of subs) {
                        try {
                            await webpush.sendNotification({
                                endpoint: sub.endpoint,
                                keys: { p256dh: sub.p256dh, auth: sub.auth }
                            }, payload);
                        } catch (err) {
                            if (err.statusCode === 410 || err.statusCode === 404) {
                                await connection.query('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
                            } else {
                                console.error('webpush error', err);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('Push notification system failed:', err);
            }
            return notificationId;
        } catch (error) {
            console.error('Error creating notification via helper:', error);
            // Non-blocking error
            return null;
        }
    }
};

module.exports = notificationController;
