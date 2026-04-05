const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/database');
const logger = require('../utils/logger');
const Message = require('../models/Message');
const User = require('../models/User');
const GroupMember = require('../models/GroupMember');

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

        // Periodic cleanup for disappearing messages (Runs once per connection to ensure it's active)
        if (!global._disappearingCleanupStarted) {
            global._disappearingCleanupStarted = true;
            setInterval(async () => {
                try {
                    // Find messages that have exceeded the disappearing duration of their chat
                    // duration is in hours, sent_at is UTC
                    await pool.query(`
                        DELETE messages FROM messages 
                        INNER JOIN personal_chats pc ON (messages.conversation_id = pc.chat_id OR messages.chat_id = pc.chat_id)
                        WHERE pc.disappearing_duration > 0 
                        AND messages.sent_at < DATE_SUB(NOW(), INTERVAL pc.disappearing_duration HOUR)
                    `);
                } catch (e) {
                    console.error('Cleanup error:', e);
                }
            }, 60000); // Check every minute
        }

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
                const { chatId, content, type = 'text', mediaUrl, storyId, replyToId, marketplaceListingId, viewPolicy = 'unlimited' } = data;
                const recipientId = data.recipientId || data.partnerId;
                let context = data.context || 'chat';

                // --- Moderation & Group Access Enforcement ---
                if (chatId) {
                    const [groups] = await pool.query('SELECT only_admins_send FROM group_chats WHERE chat_id = ?', [chatId]);
                    if (groups.length > 0) {
                        const isAdmin = await GroupMember.isAdmin(chatId, socket.userId);
                        if (groups[0].only_admins_send === 1 && !isAdmin) {
                            return socket.emit('message-error', { error: 'Only admins can send messages' });
                        }
                    }
                }

                // Auto-infer marketplace context
                if (context === 'chat' && (marketplaceListingId || data.listingId)) context = 'marketplace';

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
                    marketplaceListingId: marketplaceListingId || data.listingId,
                    viewPolicy,
                    context
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
                socket.emit('new-message', message);
                socket.emit('message-sent', message);

                // 3. Emit to all in the chat room
                socket.to(`chat:${finalChatId}`).emit('new-message', message);

                // 4. Mark as delivered if recipients are online
                const roomMembers = io.sockets.adapter.rooms.get(`chat:${finalChatId}`);
                if (roomMembers && roomMembers.size > 1) {
                    await pool.query("UPDATE messages SET status = 'delivered', delivered_at = NOW() WHERE message_id = ?", [messageId]);
                    io.to(`chat:${finalChatId}`).emit('messages-delivered', { chatId: finalChatId, messageId, status: 'delivered' });
                }

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

        // Open Message (View Logic for view_once/twice)
        socket.on('open_message', async ({ messageId }, callback) => {
            try {
                const messageData = await Message.getById(messageId);
                
                // Server enforcement check
                if (messageData && messageData.view_policy !== 'unlimited') {
                    if (messageData.views_used >= messageData.views_allowed) {
                        if (typeof callback === 'function') callback({ status: 'expired' });
                        io.to(`chat:${messageData.conversation_id || messageData.chat_id}`).emit('message_deleted', messageId);
                        return;
                    }
                }
                
                if (typeof callback === 'function') callback({ status: 'ok' });

                const result = await Message.processMessageView(messageId);
                if (result && result.action === 'deleted') {
                    io.to(`chat:${result.chatId}`).emit('message_deleted', messageId);
                } else if (result && result.action === 'updated') {
                    // Notify everyone in the room that views_used changed
                    io.to(`chat:${messageData.conversation_id || messageData.chat_id}`).emit('message_view_update', { 
                        messageId, 
                        viewsUsed: result.viewsUsed 
                    });
                }
            } catch (error) {
                logger.error('Open message error:', error);
                if (typeof callback === 'function') callback({ status: 'error' });
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

        // Mark messages as delivered (client emits when they receive a message)
        socket.on('mark-delivered', async (data) => {
            try {
                const { messageId, chatId } = data;
                if (!chatId) return;

                // Only mark delivered for messages NOT sent by this user
                await pool.query(
                    `UPDATE messages SET status = 'delivered'
                     WHERE (conversation_id = ? OR chat_id = ?)
                       AND sender_id != ?
                       AND status = 'sent'`,
                    [chatId, chatId, socket.userId]
                );

                // Notify the sender their message was delivered
                socket.to(`chat:${chatId}`).emit('messages-delivered', {
                    chatId,
                    messageId,
                    userId: socket.userId,
                    deliveredAt: new Date().toISOString()
                });
            } catch (error) {
                logger.error('Mark delivered error:', error);
            }
        });

        // Custom heartbeat ping-pong (supplements socket.io's built-in ping)
        socket.on('sparkle-ping', () => {
            socket.emit('sparkle-pong', { ts: Date.now() });
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
                const msg = await Message.getById(messageId);
                if (!msg) return;

                let success = false;
                if (msg.sender_id === socket.userId) {
                    success = await Message.deleteForEveryone(messageId, socket.userId);
                } else if (chatId) {
                    // Check if it's a group and user is admin
                    const isAdmin = await GroupMember.isAdmin(chatId, socket.userId);
                    if (isAdmin) {
                        success = await Message.deleteForEveryone(messageId, socket.userId, true, socket.user.username);
                    }
                }

                if (success) {
                    io.to(`chat:${chatId}`).emit('message-deleted-everyone', { messageId, chatId });
                }
            } catch (error) {
                logger.error('Delete for everyone error:', error);
            }
        });

        // Disappearing Messages toggle
        socket.on('disappearing_messages', async (data) => {
            const { chatId, duration } = data; // duration in hours
            try {
                // Update DB
                await pool.query(
                    'UPDATE personal_chats SET disappearing_duration = ? WHERE chat_id = ?',
                    [duration, chatId]
                );

                // Broadcast update to chat room
                io.to(`chat:${chatId}`).emit('disappearing_messages_update', { chatId, duration });

                // System message notice
                const systemMsg = duration > 0 
                  ? `Disappearing messages turned on (${duration === 24 ? '24 hours' : duration/24 + ' days'})`
                  : 'Disappearing messages turned off';
                
                await Message.sendMessage({
                    chatId,
                    senderId: socket.userId,
                    content: systemMsg,
                    type: 'system'
                });

                io.to(`chat:${chatId}`).emit('new-message', {
                    chat_id: chatId,
                    sender_id: socket.userId,
                    content: systemMsg,
                    type: 'system',
                    sent_at: new Date().toISOString()
                });

            } catch (error) {
                logger.error('Disappearing messages error:', error);
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

// Helper: Broadcast online status to followers AND group peers
const broadcastOnlineStatus = async (socket, isOnline) => {
    try {
        const [followers] = await pool.query(
            'SELECT follower_id FROM follows WHERE following_id = ?',
            [socket.userId]
        );

        // Get Group Peers
        const groupPeers = await GroupMember.getGroupPeers(socket.userId);
        
        // Merge unique IDs
        const targetIds = new Set([
            ...followers.map(f => f.follower_id),
            ...groupPeers
        ]);

        const statusData = {
            userId: socket.userId,
            username: socket.user.username,
            isOnline,
            lastSeen: isOnline ? null : new Date().toISOString()
        };

        targetIds.forEach(targetId => {
            socket.to(`user:${targetId}`).emit('user-status', statusData);
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
