const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/database');
const logger = require('../utils/logger');

let io;

const initializeSocket = (server) => {
    io = socketIO(server, {
        cors: {
            origin: process.env.NODE_ENV === 'production'
                ? process.env.API_URL
                : 'http://localhost:3000',
            credentials: true
        }
    });

    // Authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token ||
                socket.handshake.headers.cookie?.split('sparkleToken=')[1]?.split(';')[0];

            if (!token) {
                return next(new Error('Authentication required'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const [users] = await pool.query(
                'SELECT user_id, username, name, avatar_url, is_online FROM users WHERE user_id = ?',
                [decoded.userId]
            );

            if (!users[0]) {
                return next(new Error('User not found'));
            }

            socket.user = users[0];
            socket.userId = users[0].user_id;

            // Update user online status
            await pool.query(
                'UPDATE users SET is_online = true, last_seen_at = CURRENT_TIMESTAMP WHERE user_id = ?',
                [socket.userId]
            );

            next();
        } catch (error) {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        logger.info(`User connected: ${socket.userId} (${socket.user.username})`);

        // Join user to their personal room
        socket.join(`user:${socket.userId}`);

        // Join all chat rooms they're part of
        joinUserChatRooms(socket);

        // Broadcast online status to followers
        broadcastOnlineStatus(socket, true);

        // Handle joining a chat room
        socket.on('join-chat', async (chatId) => {
            try {
                const [chats] = await pool.query(
                    `SELECT chat_id FROM personal_chats 
                     WHERE chat_id = ? AND (participant1_id = ? OR participant2_id = ?)`,
                    [chatId, socket.userId, socket.userId]
                );

                if (chats[0]) {
                    socket.join(`chat:${chatId}`);
                    socket.emit('chat-joined', { chatId, success: true });
                }
            } catch (error) {
                logger.error('Join chat error:', error);
            }
        });

        // Handle sending message
        socket.on('send-message', async (data) => {
            try {
                const { chatId, content, type = 'text' } = data;

                // Verify user is participant
                const [chats] = await pool.query(
                    `SELECT * FROM personal_chats 
                     WHERE chat_id = ? AND (participant1_id = ? OR participant2_id = ?)`,
                    [chatId, socket.userId, socket.userId]
                );

                if (!chats[0]) {
                    return socket.emit('message-error', { error: 'Not authorized' });
                }

                const chat = chats[0];
                const recipientId = chat.participant1_id === socket.userId
                    ? chat.participant2_id
                    : chat.participant1_id;

                // Save message to database
                const messageId = crypto.randomUUID();
                await pool.query(
                    `INSERT INTO messages (message_id, personal_chat_id, sender_id, type, content, is_read, created_at)
                     VALUES (?, ?, ?, ?, ?, false, NOW())`,
                    [messageId, chatId, socket.userId, type, content]
                );

                const message = {
                    message_id: messageId,
                    personal_chat_id: chatId,
                    sender_id: socket.userId,
                    sender: {
                        user_id: socket.userId,
                        username: socket.user.username,
                        name: socket.user.name,
                        avatar_url: socket.user.avatar_url
                    },
                    type,
                    content,
                    is_read: false,
                    created_at: new Date().toISOString()
                };

                // Emit to sender for confirmation
                socket.emit('message-sent', message);

                // Emit to recipient if online
                socket.to(`user:${recipientId}`).emit('new-message', message);

                // Send push notification if recipient offline
                const [recipients] = await pool.query(
                    'SELECT is_online FROM users WHERE user_id = ?',
                    [recipientId]
                );

                if (recipients[0] && !recipients[0].is_online) {
                    await queuePushNotification(recipientId, {
                        type: 'message',
                        title: socket.user.name,
                        body: content,
                        data: { chatId, messageId }
                    });
                }

                // Update chat's last_message
                await pool.query(
                    `UPDATE personal_chats 
                     SET last_message = ?, last_message_at = NOW() 
                     WHERE chat_id = ?`,
                    [content, chatId]
                );

            } catch (error) {
                logger.error('Send message error:', error);
                socket.emit('message-error', { error: 'Failed to send message' });
            }
        });

        // Handle typing indicator
        socket.on('typing', (data) => {
            const { chatId, isTyping } = data;
            socket.to(`chat:${chatId}`).emit('user-typing', {
                userId: socket.userId,
                username: socket.user.username,
                isTyping
            });
        });

        // Handle read receipts
        socket.on('mark-read', async (data) => {
            try {
                const { chatId, messageIds } = data;

                await pool.query(
                    `UPDATE messages SET is_read = true 
                     WHERE personal_chat_id = ? AND sender_id != ? AND message_id IN (?)`,
                    [chatId, socket.userId, messageIds]
                );

                socket.to(`chat:${chatId}`).emit('messages-read', {
                    userId: socket.userId,
                    messageIds
                });
            } catch (error) {
                logger.error('Mark read error:', error);
            }
        });

        // Handle disconnection
        socket.on('disconnect', async () => {
            try {
                logger.info(`User disconnected: ${socket.userId}`);

                await pool.query(
                    'UPDATE users SET is_online = false, last_seen_at = NOW() WHERE user_id = ?',
                    [socket.userId]
                );

                broadcastOnlineStatus(socket, false);
            } catch (error) {
                logger.error('Disconnect error:', error);
            }
        });
    });

    return io;
};

// Helper: Join user's chat rooms
const joinUserChatRooms = async (socket) => {
    try {
        const [chats] = await pool.query(
            `SELECT chat_id FROM personal_chats 
             WHERE participant1_id = ? OR participant2_id = ?`,
            [socket.userId, socket.userId]
        );

        chats.forEach(chat => {
            socket.join(`chat:${chat.chat_id}`);
        });
    } catch (error) {
        logger.error('Join chat rooms error:', error);
    }
};

// Helper: Broadcast online status to followers
const broadcastOnlineStatus = async (socket, isOnline) => {
    try {
        const [followers] = await pool.query(
            'SELECT follower_id FROM follows WHERE following_id = ?',
            [socket.userId]
        );

        followers.forEach(follower => {
            socket.to(`user:${follower.follower_id}`).emit('user-status', {
                userId: socket.userId,
                username: socket.user.username,
                isOnline,
                lastSeen: isOnline ? null : new Date().toISOString()
            });
        });
    } catch (error) {
        logger.error('Broadcast status error:', error);
    }
};

// Helper: Queue push notification for offline users
const queuePushNotification = async (userId, notification) => {
    try {
        const notificationId = crypto.randomUUID();
        await pool.query(
            `INSERT INTO push_notifications (notification_id, user_id, type, title, body, data, created_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [notificationId, userId, notification.type, notification.title,
                notification.body, JSON.stringify(notification.data)]
        );
    } catch (error) {
        logger.error('Queue push notification error:', error);
    }
};

// Helper to get io instance
const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
};

module.exports = { initializeSocket, getIO };
