const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/database');
const logger = require('../utils/logger');
const Message = require('../models/Message');
const User = require('../models/User');

let io;

const initializeSocket = (server) => {
    io = socketIO(server, {
        cors: {
            origin: process.env.NODE_ENV === 'production'
                ? process.env.API_URL
                : ['http://localhost:3000', 'http://127.0.0.1:3000'],
            credentials: true
        },
        pingTimeout: 60000,
        pingInterval: 25000
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
            const user = await User.findById(decoded.userId);

            if (!user) {
                return next(new Error('User not found'));
            }

            socket.user = user;
            socket.userId = user.user_id;
            next();
        } catch (error) {
            logger.error('Socket Auth Error:', error.message);
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', async (socket) => {
        logger.info(`🔌 User connected: ${socket.userId} (${socket.user.username})`);

        // Update user online status
        await User.setOnlineStatus(socket.userId, true);

        // Join user to their personal room
        socket.join(`user:${socket.userId}`);

        // Join all chat rooms (personal and group) they're part of
        await joinUserChatRooms(socket);

        // Broadcast online status to followers
        broadcastOnlineStatus(socket, true);

        // --- CHAT EVENTS ---

        // Join a specific chat (e.g., when opening a chat window)
        socket.on('join-chat', async (chatId) => {
            socket.join(`chat:${chatId}`);
            // Mark messages in this chat as delivered if they were sent to this user
            await Message.updateStatus(chatId, socket.userId, 'delivered');
            socket.to(`chat:${chatId}`).emit('messages-delivered', { chatId, userId: socket.userId });
        });

        // Typing indicator
        socket.on('typing', (data) => {
            const { chatId, isTyping } = data;
            socket.to(`chat:${chatId}`).emit('user-typing', {
                chatId,
                userId: socket.userId,
                username: socket.user.username,
                isTyping
            });
        });

        // Send Message
        socket.on('send-message', async (data) => {
            try {
                const { chatId, recipientId, content, type = 'text', mediaUrl, storyId, replyToId, marketplaceListingId } = data;

                // 1. Save to DB
                const messageId = await Message.sendMessage({
                    chatId,
                    recipientId,
                    senderId: socket.userId,
                    content,
                    type,
                    mediaUrl,
                    storyId,
                    replyToId,
                    marketplaceListingId
                });

                // Get the saved message with sender info and reply info
                const [fullMessage] = await pool.query(`
                    SELECT m.*, 
                           u.name as sender_name, u.username as sender_username, u.avatar_url as sender_avatar,
                           rm.content as reply_content, rm.type as reply_type
                    FROM messages m
                    JOIN users u ON m.sender_id = u.user_id
                    LEFT JOIN messages rm ON m.reply_to_message_id = rm.message_id
                    WHERE m.message_id = ?
                `, [messageId]);

                const message = fullMessage[0];
                const finalChatId = message.conversation_id || message.chat_id;

                // 2. Emit to sender for confirmation
                socket.emit('message-sent', message);

                // 3. Emit to all in the chat room (delivered status)
                socket.to(`chat:${finalChatId}`).emit('new-message', message);

                // 4. Handle notifications if it's a personal chat and recipient is offline
                if (recipientId) {
                     const presence = await User.getUserPresence(recipientId);
                     if (presence && !presence.is_online) {
                         await queuePushNotification(recipientId, {
                             type: 'message',
                             title: socket.user.name,
                             body: type === 'text' ? content : `Sent a ${type}`,
                             data: { chatId: finalChatId, messageId }
                         });
                     }
                }
            } catch (error) {
                logger.error('Send message error:', error);
                socket.emit('message-error', { error: 'Failed to send message' });
            }
        });

        // Mark messages as read
        socket.on('mark-read', async (chatId) => {
            try {
                await Message.updateStatus(chatId, socket.userId, 'read');
                socket.to(`chat:${chatId}`).emit('messages-read', {
                    chatId,
                    userId: socket.userId,
                    readAt: new Date().toISOString()
                });
            } catch (error) {
                logger.error('Mark read error:', error);
            }
        });

        // Add Reaction
        socket.on('add-reaction', async (data) => {
            const { messageId, chatId, emoji } = data;
            try {
                await Message.addReaction(messageId, socket.userId, emoji);
                io.to(`chat:${chatId}`).emit('new-reaction', {
                    messageId,
                    chatId,
                    userId: socket.userId,
                    emoji
                });
            } catch (error) {
                 logger.error('Add reaction error:', error);
            }
        });

        // Remove Reaction
        socket.on('remove-reaction', async (data) => {
            const { messageId, chatId, emoji } = data;
            try {
                await Message.removeReaction(messageId, socket.userId, emoji);
                io.to(`chat:${chatId}`).emit('reaction-removed', {
                    messageId,
                    chatId,
                    userId: socket.userId,
                    emoji
                });
            } catch (error) {
                 logger.error('Remove reaction error:', error);
            }
        });

        // Delete message for everyone
        socket.on('delete-for-everyone', async (data) => {
            const { messageId, chatId } = data;
            try {
                const success = await Message.deleteForEveryone(messageId, socket.userId);
                if (success) {
                    io.to(`chat:${chatId}`).emit('message-deleted-everyone', { messageId, chatId });
                }
            } catch (error) {
                logger.error('Delete for everyone error:', error);
            }
        });

        // Handle disconnection
        socket.on('disconnect', async () => {
            try {
                logger.info(`🔌 User disconnected: ${socket.userId}`);
                await User.setOnlineStatus(socket.userId, false);
                broadcastOnlineStatus(socket, false);
            } catch (error) {
                logger.error('Disconnect error:', error);
            }
        });
    });

    return io;
};

// Helper: Join user's chat rooms (Personal + Group)
const joinUserChatRooms = async (socket) => {
    try {
        const conversations = await Message.getUserConversations(socket.userId);
        conversations.forEach(conv => {
            socket.join(`chat:${conv.chat_id}`);
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
        // Fallback: search for existing notification mechanism
        logger.warn('Push notification table might not exist, using standard notifications...');
        try {
             await pool.query(`
                INSERT INTO notifications (notification_id, user_id, type, title, content, created_at)
                VALUES (UUID(), ?, ?, ?, ?, NOW())
            `, [userId, notification.type, notification.title, notification.body]);
        } catch (innerErr) {
             logger.error('Failed to queue fallback notification:', innerErr.message);
        }
    }
};

const getIO = () => {
    if (!io) throw new Error('Socket.io not initialized');
    return io;
};

const emitNotification = (userId, notificationData) => {
    try {
        if (io) {
            io.to(`user:${userId}`).emit('new-notification', notificationData);
        }
    } catch (error) {
        logger.error('emitNotification error:', error);
    }
};

/**
 * Notify participants about order updates
 */
const notifyOrderUpdate = (orderData) => {
    try {
        if (!io) return;
        const { order_id, buyer_id, seller_id, status } = orderData;
        
        // Notify both parties
        io.to(`user:${buyer_id}`).emit('marketplace:order_update', { orderId: order_id, status });
        io.to(`user:${seller_id}`).emit('marketplace:order_update', { orderId: order_id, status });
        
        logger.info(`📡 Order update broadcasted: ${order_id} -> ${status}`);
    } catch (error) {
        logger.error('notifyOrderUpdate error:', error);
    }
};

module.exports = { initializeSocket, getIO, emitNotification, notifyOrderUpdate };
