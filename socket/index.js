const socketIO = require('socket.io');
const perms = require('../backend/services/messagePermission');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/database');
const logger = require('../utils/logger');
const Message = require('../models/Message');
const ScreenshotAudit = require('../models/ScreenshotAudit');
const User = require('../models/User');
const GroupMember = require('../models/GroupMember');

let io;

/**
 * Grace period (ms) before a disconnected user is marked offline.
 * This prevents false offline transitions during brief network fluctuations.
 */
const OFFLINE_GRACE_MS = 30_000;

/**
 * Tracks pending offline timers keyed by userId.
 * If the same user reconnects within OFFLINE_GRACE_MS, the timer is cancelled
 * and they remain online with no status change.
 */
const pendingOfflineTimers = new Map();

/**
 * Tracks active typing sessions per socket: Map<socketId, Set<chatId>>
 * Used to auto-expire typing indicators when a socket disconnects mid-type.
 */
const activeTypingSessions = new Map();

const initializeSocket = (server) => {
    io = socketIO(server, {
        cors: {
            origin: [
                'http://localhost:5173',
                'http://localhost:3000',
                'http://localhost:5174',
                'http://localhost',
                'https://localhost',
                'capacitor://localhost',
                'https://sparkleappweb.vercel.app',
                'https://sparkleappweb1.vercel.app',
                'https://sparklewebapp.vercel.app',
                'https://sparkleapp.vercel.app'
            ],
            credentials: true
        },
        transports: ['websocket', 'polling'], // Explicitly allow both, but client will prefer websocket now
        pingTimeout: 60000,
        pingInterval: 25000
    });

    // Initialize marketplace messaging namespace
    require('./marketplaceChat')(io);

    // Authentication middleware
    io.use(async (socket, next) => {
        try {
            let token = socket.handshake.auth.token ||
                socket.handshake.headers.cookie?.split('sparkleToken=')[1]?.split(';')[0];

            if (!token) {
                logger.warn(`🔌 Socket Auth: Missing token for socket ${socket.id}`);
                return next(new Error('Authentication required'));
            }

            // Handle Bearer prefix if sent by mistake
            if (token.startsWith('Bearer ')) {
                token = token.slice(7);
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId);

            if (!user) {
                logger.warn(`🔌 Socket Auth: User not found for ID ${decoded.userId}`);
                return next(new Error('User not found'));
            }

            socket.user = user;
            socket.userId = user.user_id;
            next();
        } catch (error) {
            logger.error(`🔌 Socket Auth Error [${socket.id}]:`, error.message);
            const message = error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
            next(new Error(message));
        }
    });

    io.on('connection', async (socket) => {
        logger.info(`🔌 User connected: ${socket.userId} (${socket.user.username})`);

        // ── Cancel any pending offline timer for this user (reconnect within grace window) ──
        if (pendingOfflineTimers.has(socket.userId)) {
            clearTimeout(pendingOfflineTimers.get(socket.userId));
            pendingOfflineTimers.delete(socket.userId);
            logger.info(`📡 Reconnect within grace window for ${socket.userId} — staying ONLINE`);
        }

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
        
        // Broadcast group presence updates
        broadcastGroupPresence(io, socket);

        // --- CHAT EVENTS ---

        // Join a specific chat (e.g., when opening a chat window)
        socket.on('join-chat', async (chatId) => {
            socket.join(`chat:${chatId}`);
            // Mark messages in this chat as delivered if they were sent to this user
            await Message.updateStatus(chatId, socket.userId, 'delivered');
            socket.to(`chat:${chatId}`).emit('messages-delivered', { chatId, userId: socket.userId });
        });

        // Typing indicator — server-coordinated with auto-expiry
        socket.on('typing', (data) => {
            const { chatId, isTyping } = data;

            // Track which chats this socket is actively typing in
            if (isTyping) {
                if (!activeTypingSessions.has(socket.id)) {
                    activeTypingSessions.set(socket.id, new Set());
                }
                activeTypingSessions.get(socket.id).add(chatId);
            } else {
                const sessions = activeTypingSessions.get(socket.id);
                if (sessions) sessions.delete(chatId);
            }

            // Broadcast to everyone else in the chat room
            socket.to(`chat:${chatId}`).emit('user-typing', {
                chatId,
                userId: socket.userId,
                username: socket.user.username,
                isTyping: !!isTyping
            });
        });
        // Register screenshot attempt event
        socket.on('screenshotAttempt', async (data) => {
            try {
                const { chatId = null, method = 'screenshot' } = data || {};
                const ip = socket.handshake.address || null;
                await ScreenshotAudit.create({
                    userId: socket.userId,
                    chatId,
                    method,
                    ip
                });
                // Notify the initiating user
                socket.emit('screenshot_attempt', { method, chatId });
                // Optionally notify participants in the chat
                if (chatId) {
                    socket.to(`chat:${chatId}`).emit('privacy_alert', {
                        userId: socket.userId,
                        method,
                        chatId,
                        message: `${socket.user.username} attempted a ${method}`
                    });
                }
            } catch (e) {
                logger.error('Screenshot attempt handling error:', e);
            }
        });

        // Send Message
        socket.on('send-message', async (data, callback) => {
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

                const message = {
                    ...fullMessage[0],
                    sent_at: fullMessage[0].sent_at ? new Date(fullMessage[0].sent_at).toISOString() : null,
                    read_at: fullMessage[0].read_at ? new Date(fullMessage[0].read_at).toISOString() : null
                };
                const finalChatId = message.conversation_id || message.chat_id;

                // Acknowledge receipt to the sender with server-authoritative sentAt
                // IMPORTANT: sentAt comes from the DB record, not from the client clock
                if (typeof callback === 'function') {
                    callback({ success: true, messageId, sentAt: message.sent_at });
                }

                // 2. Emit to sender for confirmation
                socket.emit('new-message', message);
                socket.emit('message-sent', message);

                // 3. Emit to all in the chat room
                socket.to(`chat:${finalChatId}`).emit('new-message', message);

                // 4. Handle push notifications if it's a personal chat and recipient is offline
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
                if (typeof callback === 'function') {
                    callback({ success: false, error: 'Database or broadcast error' });
                }
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
                
                // Broadcast to everyone in the room (including sender on other devices)
                io.to(`chat:${chatId}`).emit('messages-read', {
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

                // Notify everyone in the room
                io.to(`chat:${chatId}`).emit('messages-delivered', {
                    chatId,
                    messageId,
                    userId: socket.userId,
                    deliveredAt: new Date().toISOString()
                });
            } catch (error) {
                logger.error('Mark delivered error:', error);
            }
        });

        // Graceful background signal — keep online but note backgrounded
        socket.on('presence:background', () => {
            logger.info(`📱 User backgrounded: ${socket.userId}`);
            // Do nothing immediately; the socket is still connected
            // The OFFLINE_GRACE_MS disconnect timeout will handle actual offline
        });

        // Explicit offline signal (tab close / beforeunload)
        socket.on('presence:offline', async () => {
            try {
                logger.info(`📴 Explicit offline signal from ${socket.userId}`);
                await User.setOnlineStatus(socket.userId, false);
                broadcastOnlineStatus(socket, false);
            } catch (e) {
                logger.error('presence:offline error:', e);
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
        socket.on('delete-for-everyone', async (data, callback) => {
            const { messageId, chatId } = data;
            try {
                const msg = await Message.getById(messageId);
                if (!msg) {
                    if (typeof callback === 'function') callback({ success: false, error: 'Message not found' });
                    return;
                }
                // Determine conversation type for permission check
                const conv = { type: (chatId && (await pool.query('SELECT chat_id FROM group_chats WHERE chat_id = ?', [chatId])).length > 0 ? 'group' : 'private') };
                if (!perms.canDeleteForEveryone(socket.user, msg, conv)) {
                    if (typeof callback === 'function') callback({ success: false, error: 'Permission denied: cannot delete this message for everyone.' });
                    return;
                }
                const success = await Message.deleteForEveryone(messageId, socket.userId, conv.type === 'group', socket.user.username);
                if (success) {
                    io.to(`chat:${chatId}`).emit('message-deleted-everyone', { messageId, chatId });
                    if (typeof callback === 'function') callback({ success: true });
                } else {
                    if (typeof callback === 'function') callback({ success: false, error: 'Failed to delete message for everyone.' });
                }
            } catch (error) {
                logger.error('Delete for everyone error:', error);
                if (typeof callback === 'function') callback({ success: false, error: 'Server error' });
            }
        });

        // Delete message for me
        socket.on('delete-for-me', async (data, callback) => {
            const { messageId, chatId } = data;
            try {
                const success = await Message.deleteForMe(messageId, socket.userId);
                if (success) {
                    socket.emit('message-deleted-me', { messageId, chatId });
                    if (typeof callback === 'function') callback({ success: true });
                } else {
                    if (typeof callback === 'function') callback({ success: false, error: 'Failed to delete message locally' });
                }
            } catch (error) {
                logger.error('Delete for me error:', error);
                if (typeof callback === 'function') callback({ success: false, error: 'Server error' });
            }
        });

        // Pin Message
        socket.on('pin-message', async (data, callback) => {
            const { messageId, chatId } = data;
            try {
                const [groupExists] = await pool.query('SELECT chat_id FROM group_chats WHERE chat_id = ?', [chatId]);
                // Determine conversation type for permission check
                const conv = { type: (groupExists.length > 0) ? 'group' : 'private' };
                const msg = await Message.getById(messageId);
                if (!msg) {
                    if (typeof callback === 'function') callback({ success: false, error: 'Message not found' });
                    return;
                }
                if (!perms.canPinMessage(socket.user, msg, conv)) {
                    socket.emit('message-error', { error: 'You do not have permission to pin this message' });
                    if (typeof callback === 'function') callback({ success: false, error: 'Permission denied' });
                    return;
                }

                // Check pin limit: maximum 5 pinned messages per chat
                const [pinnedCount] = await pool.query(
                    'SELECT COUNT(*) as count FROM messages WHERE (chat_id = ? OR conversation_id = ?) AND pinned = 1',
                    [chatId, chatId]
                );
                if (pinnedCount[0].count >= 5) {
                    socket.emit('message-error', { error: 'Pin limit reached (maximum 5 pinned messages allowed)' });
                    if (typeof callback === 'function') callback({ success: false, error: 'Pin limit reached (max 5)' });
                    return;
                }

                const [result] = await pool.query(
                    'UPDATE messages SET pinned = 1, pinned_at = NOW(), pinned_by = ? WHERE message_id = ?',
                    [socket.userId, messageId]
                );

                if (result.affectedRows > 0) {
                    io.to(`chat:${chatId}`).emit('message-pinned', { messageId, chatId, pinnedBy: socket.userId });
                    if (typeof callback === 'function') callback({ success: true });
                } else {
                    if (typeof callback === 'function') callback({ success: false, error: 'Message not found' });
                }
            } catch (error) {
                logger.error('Pin message error:', error);
                if (typeof callback === 'function') callback({ success: false, error: 'Server error' });
            }
        });

        // Unpin Message
        socket.on('unpin-message', async (data, callback) => {
            const { messageId, chatId } = data;
            try {
                const [groupExists] = await pool.query('SELECT chat_id FROM group_chats WHERE chat_id = ?', [chatId]);
                const conv = { type: (groupExists.length > 0) ? 'group' : 'private' };
                const msg = await Message.getById(messageId);
                if (!msg) {
                    if (typeof callback === 'function') callback({ success: false, error: 'Message not found' });
                    return;
                }
                if (!perms.canPinMessage(socket.user, msg, conv)) {
                    socket.emit('message-error', { error: 'You do not have permission to unpin this message' });
                    if (typeof callback === 'function') callback({ success: false, error: 'Permission denied' });
                    return;
                }

                const [result] = await pool.query(
                    'UPDATE messages SET pinned = 0, pinned_at = NULL, pinned_by = NULL WHERE message_id = ?',
                    [messageId]
                );

                if (result.affectedRows > 0) {
                    io.to(`chat:${chatId}`).emit('message-unpinned', { messageId, chatId });
                    if (typeof callback === 'function') callback({ success: true });
                } else {
                    if (typeof callback === 'function') callback({ success: false, error: 'Message not found' });
                }
            } catch (error) {
                logger.error('Unpin message error:', error);
                if (typeof callback === 'function') callback({ success: false, error: 'Server error' });
            }
        });

        // Edit Message
        socket.on('edit-message', async (data, callback) => {
            const { messageId, chatId, content } = data;
            try {
                const msg = await Message.getById(messageId);
                if (!msg) {
                    if (typeof callback === 'function') callback({ success: false, error: 'Message not found' });
                    return;
                }
                if (!perms.canEditMessage(socket.user, msg)) {
                    if (typeof callback === 'function') callback({ success: false, error: 'Permission denied: cannot edit this message.' });
                    return;
                }
                const success = await Message.editMessage(messageId, socket.userId, content);
                if (success) {
                    io.to(`chat:${chatId}`).emit('message-edited', { messageId, chatId, content, editedAt: new Date().toISOString() });
                    if (typeof callback === 'function') callback({ success: true });
                } else {
                    if (typeof callback === 'function') callback({ success: false, error: 'Failed to edit message due to server error.' });
                }
            } catch (error) {
                logger.error('Edit message error:', error);
                if (typeof callback === 'function') callback({ success: false, error: 'Server error' });
            }
        });

        // Forward Message
        socket.on('forward-message', async (data, callback) => {
            const { messageId, targetChatIds } = data;
            
            if (!Array.isArray(targetChatIds) || targetChatIds.length > 5) {
                if (typeof callback === 'function') callback({ success: false, error: 'Cannot forward to more than 5 people at a time.' });
                return;
            }

            try {
                const originalMsg = await Message.getById(messageId);
                if (!originalMsg) {
                    if (typeof callback === 'function') callback({ success: false, error: 'Original message not found' });
                    return;
                }

                const forwardedMessages = [];
                for (const targetChatId of targetChatIds) {
                    const [pc] = await pool.query('SELECT participant1_id, participant2_id FROM personal_chats WHERE chat_id = ?', [targetChatId]);
                    
                    let recipientId = null;
                    if (pc.length > 0) {
                        recipientId = pc[0].participant1_id === socket.userId ? pc[0].participant2_id : pc[0].participant1_id;
                    }

                    const messageId = crypto.randomUUID();
                    const sentAt = new Date();
                    const personalChatId = pc.length > 0 ? targetChatId : null;
                    const groupChatId = pc.length > 0 ? null : targetChatId;

                    await pool.query(`
                        INSERT INTO messages (
                            message_id, chat_id, conversation_id, personal_chat_id, 
                            sender_id, recipient_id, content, type, media_url, 
                            status, is_read, sent_at, context,
                            forwarded, forwarded_from
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', 0, ?, 'chat', 1, ?)
                    `, [
                        messageId, 
                        groupChatId, 
                        personalChatId, 
                        personalChatId, 
                        socket.userId, 
                        recipientId, 
                        originalMsg.content, 
                        originalMsg.type, 
                        originalMsg.media_url, 
                        sentAt, 
                        socket.user.username
                    ]);

                    if (personalChatId) {
                        await pool.query('UPDATE personal_chats SET last_message_time = ? WHERE chat_id = ?', [sentAt, personalChatId]);
                    } else if (groupChatId) {
                        await pool.query('UPDATE group_chats SET last_message_at = ? WHERE chat_id = ?', [sentAt, groupChatId]);
                    }

                    const [fullMessage] = await pool.query(`
                        SELECT m.*, 
                               u.name as sender_name, u.username as sender_username, u.avatar_url as sender_avatar
                        FROM messages m
                        JOIN users u ON m.sender_id = u.user_id
                        WHERE m.message_id = ?
                    `, [messageId]);

                    const message = {
                        ...fullMessage[0],
                        sent_at: fullMessage[0].sent_at ? new Date(fullMessage[0].sent_at).toISOString() : null,
                        read_at: fullMessage[0].read_at ? new Date(fullMessage[0].read_at).toISOString() : null
                    };

                    socket.emit('new-message', message);
                    socket.emit('message-sent', message);
                    socket.to(`chat:${targetChatId}`).emit('new-message', message);
                    forwardedMessages.push(message);
                }

                if (typeof callback === 'function') callback({ success: true, messages: forwardedMessages });
            } catch (error) {
                logger.error('Forward message error:', error);
                if (typeof callback === 'function') callback({ success: false, error: 'Server error' });
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

        // Handle disconnection — with graceful offline timeout
        socket.on('disconnect', async (reason) => {
            try {
                logger.info(`🔌 User disconnected: ${socket.userId} (${reason})`);

                // ── Auto-expire any stale typing sessions for this socket ──
                const typingChats = activeTypingSessions.get(socket.id);
                if (typingChats && typingChats.size > 0) {
                    for (const chatId of typingChats) {
                        socket.to(`chat:${chatId}`).emit('user-typing', {
                            chatId,
                            userId: socket.userId,
                            username: socket.user.username,
                            isTyping: false
                        });
                    }
                    logger.info(`⌨️  Cleared ${typingChats.size} stale typing session(s) for ${socket.userId}`);
                }
                activeTypingSessions.delete(socket.id);

                // Schedule offline transition after grace period
                // This allows brief network blips / transport upgrades to
                // reconnect without the user appearing offline.
                const timer = setTimeout(async () => {
                    try {
                        // Verify the user has no other active socket sessions
                        const userRoom = io.sockets.adapter.rooms.get(`user:${socket.userId}`);
                        const stillOnline = userRoom && userRoom.size > 0;

                        if (!stillOnline) {
                            await User.setOnlineStatus(socket.userId, false);
                            broadcastOnlineStatus(socket, false);
                            logger.info(`📴 User offline after grace period: ${socket.userId}`);
                        } else {
                            logger.info(`📡 User still has active sessions, staying ONLINE: ${socket.userId}`);
                        }
                    } catch (e) {
                        logger.error('Grace offline error:', e);
                    } finally {
                        pendingOfflineTimers.delete(socket.userId);
                    }
                }, OFFLINE_GRACE_MS);

                pendingOfflineTimers.set(socket.userId, timer);

                // Update groups immediately (group presence count changes)
                setTimeout(() => {
                    broadcastGroupPresence(io, socket);
                }, 500);
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

// Helper: Broadcast aggregated group presence
const broadcastGroupPresence = async (io, socket) => {
    try {
        const conversations = await Message.getUserConversations(socket.userId);
        const groupChats = conversations.filter(c => c.chat_type === 'group');
        
        for (const group of groupChats) {
            const chatId = group.chat_id;
            const room = io.sockets.adapter.rooms.get(`chat:${chatId}`);
            let count = 0;
            if (room) {
                const userIds = new Set();
                for (const socketId of room) {
                    const clientSocket = io.sockets.sockets.get(socketId);
                    if (clientSocket && clientSocket.userId) {
                        userIds.add(clientSocket.userId);
                    }
                }
                count = userIds.size;
            }
            io.to(`chat:${chatId}`).emit('group:presence:update', { chatId, onlineCount: count });
        }
    } catch (e) {
        logger.error('Broadcast group presence error:', e);
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

        const rooms = Array.from(targetIds).map(id => `user:${id}`);
        if (rooms.length > 0) {
            socket.to(rooms).emit('user-status', statusData);
        }
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

const emitMarketplaceMessage = (chatId, message) => {
    try {
        if (!io) return;
        io.to(`chat:${chatId}`).emit('marketplace:new_message', { chatId, message });
        logger.info(`📡 Marketplace message broadcasted to chat:${chatId}`);
    } catch (error) {
        logger.error('emitMarketplaceMessage error:', error);
    }
};

module.exports = { initializeSocket, getIO, emitNotification, notifyOrderUpdate, emitMarketplaceMessage };
