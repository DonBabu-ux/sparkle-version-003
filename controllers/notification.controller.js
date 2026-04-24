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
            baseSql += ` ORDER BY CASE WHEN n.type = 'system_welcome' AND n.is_read = 0 THEN 1 ELSE 0 END DESC, n.created_at DESC LIMIT ? OFFSET ?`;
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
                action_url: n.action_url,
                aggregation_count: n.aggregation_count
            }));

            res.json(notifications);
        } catch (error) {
            console.error('Error fetching notifications:', error);
            res.status(500).json({ error: 'Failed to fetch notifications' });
        }
    },

    renderNotifications: async (req, res) => {
        try {
            const userId = req.user.userId || req.user.user_id;
            
            // Mark all as read when opening the page
            await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [userId]);

            const [rows] = await pool.query(`
                SELECT n.*, u.username as actor_username, u.name as actor_name, u.avatar_url as actor_avatar
                FROM notifications n
                LEFT JOIN users u ON u.user_id = COALESCE(n.related_user_id, n.actor_id)
                WHERE n.user_id = ?
                ORDER BY n.created_at DESC
                LIMIT 50
            `, [userId]);

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
                action_url: n.action_url
            }));

            res.render('notifications', {
                title: 'Notifications',
                user: req.user,
                notifications
            });
        } catch (error) {
            console.error('Render Notifications Error:', error);
            res.status(500).render('error', { 
                title: 'Error',
                message: 'Failed to load notifications',
                error: error,
                user: req.user
             });
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

    // Delete a specific notification
    deleteNotification: async (req, res) => {
        try {
            const userId = req.user.userId || req.user.user_id;
            const { notificationId } = req.params;

            const [result] = await pool.query(
                'DELETE FROM notifications WHERE notification_id = ? AND user_id = ?',
                [notificationId, userId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Notification not found' });
            }

            res.json({ message: 'Notification deleted' });
        } catch (error) {
            console.error('Error deleting notification:', error);
            res.status(500).json({ error: 'Failed to delete notification' });
        }
    },

    // Helper function to create a notification (intended for internal use by other controllers)
    createNotification: async (data, connection = pool) => {
        try {
            // Don't notify users about their own actions
            if (data.user_id === data.actor_id) return null;

            // 0. Fetch user preferences (DND and type toggles)
            const [[userPrefs]] = await connection.query(
                `SELECT dnd_enabled, dnd_start_time, dnd_end_time, push_notifications_enabled,
                 notifications_likes, notifications_comments, notifications_follows, notifications_messages
                 FROM users WHERE user_id = ?`,
                [data.user_id]
            );

            if (userPrefs) {
                // Check Type Toggles (Total suppression if off)
                if ((data.type === 'spark' || data.type === 'like' || data.type === 'spark_post') && userPrefs.notifications_likes === 0) return null;
                if ((data.type === 'comment' || data.type === 'reply') && userPrefs.notifications_comments === 0) return null;
                if (data.type === 'follow' && userPrefs.notifications_follows === 0) return null;
                if (data.type === 'message' && userPrefs.notifications_messages === 0) return null;

                // Check DND (Total suppression)
                if (userPrefs.dnd_enabled === 1) {
                    const now = new Date();
                    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
                    const startRaw = (userPrefs.dnd_start_time || '22:00').toString();
                    const endRaw = (userPrefs.dnd_end_time || '07:00').toString();
                    const start = startRaw.length > 5 ? startRaw.substring(0, 5) : startRaw;
                    const end = endRaw.length > 5 ? endRaw.substring(0, 5) : endRaw;
                    
                    let isDndActive = false;
                    if (start <= end) {
                        isDndActive = currentTime >= start && currentTime <= end;
                    } else {
                        isDndActive = currentTime >= start || currentTime <= end;
                    }
                    if (isDndActive) return null;
                }
            }

            // --- AGGREGATION LOGIC ---
            // Only aggregate certain types (sparks/likes)
            if (data.type === 'spark' && data.related_id) {
                const [[existing]] = await connection.query(
                    `SELECT notification_id, aggregation_count FROM notifications 
                     WHERE user_id = ? AND related_id = ? AND type = ? AND is_read = 0 
                     LIMIT 1`,
                    [data.user_id, data.related_id, data.type]
                );

                if (existing) {
                    const newCount = existing.aggregation_count + 1;
                    const actorName = data.actor_name || 'Someone';
                    const newContent = `${actorName} and ${newCount - 1} others sparked your post`;
                    
                    await connection.query(
                        `UPDATE notifications 
                         SET aggregation_count = ?, 
                             content = ?, 
                             actor_id = ?, 
                             created_at = CURRENT_TIMESTAMP 
                         WHERE notification_id = ?`,
                        [newCount, newContent, data.actor_id, existing.notification_id]
                    );

                    // Re-fetch actor info for socket (same as standard flow)
                    let actorInfo = { actor_name: data.actor_name || '', actor_avatar: '/uploads/avatars/default.png', actor_username: '' };
                    if (data.actor_id) {
                        try {
                            const [[actor]] = await pool.query(
                                'SELECT name as actor_name, username as actor_username, avatar_url as actor_avatar FROM users WHERE user_id = ?',
                                [data.actor_id]
                            );
                            if (actor) actorInfo = actor;
                        } catch (_) {}
                    }

                    // Emit socket with updated info
                    const emitter = getEmitter();
                    if (emitter) {
                        emitter(data.user_id, {
                            notification_id: existing.notification_id,
                            id: existing.notification_id,
                            type: data.type,
                            title: data.title,
                            content: newContent,
                            action_url: data.action_url || null,
                            actor_id: data.actor_id || null,
                            ...actorInfo,
                            is_read: false,
                            created_at: new Date().toISOString()
                        });
                    }
                    return existing.notification_id;
                }
            }

            // --- STANDARD INSERT LOGIC (if no aggregation) ---
            const notificationId = uuidv4();
            await connection.query(`
                INSERT INTO notifications (
                    notification_id, user_id, type, title, content, 
                    related_id, related_type, actor_id, action_url, aggregation_count
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
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
                // Check if user has push enabled globally
                const [[pPrefs]] = await connection.query('SELECT push_notifications_enabled FROM users WHERE user_id = ?', [data.user_id]);
                const pushEnabled = pPrefs ? pPrefs.push_notifications_enabled !== 0 : true;

                if (process.env.VAPID_PUBLIC_KEY && pushEnabled) {
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
    },
    
    // Create an internal/system notification (for Batch 3 anonymous features)
    createInternalNotification: async (userId, type, category, message, actionUrl = null) => {
        try {
            const notificationId = uuidv4();
            await pool.query(`
                INSERT INTO notifications (
                    notification_id, user_id, type, title, content, 
                    related_type, action_url, is_read
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
            `, [
                notificationId,
                userId,
                type,
                category,
                message,
                'confession', // fixed related type for now
                actionUrl
            ]);

            // Emit real-time socket notification
            const emitter = getEmitter();
            if (emitter) {
                emitter(userId, {
                    notification_id: notificationId,
                    id: notificationId,
                    type: type,
                    title: category,
                    content: message,
                    action_url: actionUrl,
                    actor_id: null,
                    actor_name: 'Sparkle',
                    actor_avatar: '/uploads/avatars/default.png',
                    is_read: false,
                    created_at: new Date().toISOString()
                });
            }
            return notificationId;
        } catch (error) {
            console.error('Error creating internal notification:', error);
            return null;
        }
    }
};

module.exports = notificationController;
