const socketIO = require('socket.io');
const perms = require('../services/messagePermission');
const PermissionEngine = require('../services/PermissionEngine');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/database');
const logger = require('../utils/logger');
const { socketAuthErrorMessage } = require('../utils/socketAuthError');
const realtimeLogger = require('../utils/realtimeTrace');
const secureLogger = require('../utils/secureLogger');
const Message = require('../models/Message');
const Room = require('../models/Room');
const RoomMember = require('../models/RoomMember');
const RoomChannel = require('../models/RoomChannel');
const ChannelMessage = require('../models/ChannelMessage');
// Duplicate Message import removed
// ===== LOGGING HELPER =====
const logSocketRooms = (socket, context = '') => {
  console.log(`[ROOMS] ${context} - User: ${socket.userId}, Rooms:`, {
    rooms: Array.from(socket.rooms),
    count: socket.rooms.size
  });
};
const ScreenshotAudit = require('../models/ScreenshotAudit');
const User = require('../models/User');
const GroupMember = require('../models/GroupMember');

const SessionService = require('../services/session.service');
const DeliveryQueueWorker = require('../workers/deliveryQueueWorker');
const { filterPresenceViewers } = require('../services/presencePrivacy');

let io;

/**
 * Grace period (ms) before a disconnected user is marked offline.
 * Product requirement: keep the "online" indicator for one full minute after
 * disconnect so brief network blips don't flicker presence.
 */
const OFFLINE_GRACE_MS = 60_000;

const pendingOfflineTimers = new Map();
const userSockets = new Map();
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
        transports: ['websocket', 'polling'],
        pingTimeout: 60000,
        pingInterval: 25000
    });

    // Start background delivery queue worker
    DeliveryQueueWorker.startWorker(io);

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
            // Log minimal auth info for debugging (no sensitive data)
            logger.debug(`🔌 Socket Auth: Authenticating user ID ${decoded.userId || decoded.id}`);
            // Support different token structures (id vs userId vs nested user.id)
            const tokenUserId = decoded.userId || decoded.id || (decoded.user && decoded.user.id);
            const user = await User.findById(tokenUserId);

            if (!user) {
                logger.warn(`🔌 Socket Auth: User not found for ID ${tokenUserId}`);
                return next(new Error('User not found'));
            }

            // ACCOUNT LIFECYCLE CHECK
            const accountStatus = user.account_status ? String(user.account_status).trim().toLowerCase() : 'active';
            if (accountStatus === 'suspended' || accountStatus === 'terminated' || accountStatus === 'pending_deletion' || accountStatus === 'deleted' || accountStatus === 'deactivated') {
                logger.warn(`🔌 Socket Auth REJECTED: User ${tokenUserId} has account_status='${accountStatus}'`);
                return next(new Error(`ACCOUNT_${accountStatus.toUpperCase()}`));
            }

            // TOKEN VERSION CHECK
            if (decoded.tokenVersion !== undefined && user.token_version !== undefined && decoded.tokenVersion < user.token_version) {
                logger.warn(`🔌 Socket Auth REJECTED: Stale token version for user ${tokenUserId}`);
                return next(new Error('SESSION_REVOKED'));
            }

            socket.user = user;
            // Store the DB primary key for later use
            socket.userId = user.user_id;
            logger.info(`🔌 Socket Auth SUCCESS userId=${socket.userId} socketId=${socket.id}`);
            next();
        } catch (error) {
            logger.error(`🔌 Socket Auth Error [${socket.id}]:`, error.message);
            // H24: DB blips during User.findById map to ServiceUnavailable,
            // never to "Invalid token" (which would make clients refresh-loop
            // on a perfectly valid JWT).
            next(new Error(socketAuthErrorMessage(error)));
        }
    });

    io.on('connection', async (socket) => {
        // ── Track user active sockets (Set for multi-socket support) ──
        if (!userSockets.has(socket.userId)) {
            userSockets.set(socket.userId, new Set());
        }
        userSockets.get(socket.userId).add(socket);
        const sessions = userSockets.get(socket.userId);
        logger.info(`🔌 User connected: ${socket.userId} (${socket.user.username}) - Active sessions: ${sessions.size}`);

        // ── Cancel any pending offline timer for this user (reconnect within grace window) ──
        if (pendingOfflineTimers.has(socket.userId)) {
            clearTimeout(pendingOfflineTimers.get(socket.userId));
            pendingOfflineTimers.delete(socket.userId);
            logger.info(`📡 Reconnect within grace window for ${socket.userId} — staying ONLINE`);
        }

        // Update user online status — wrapped in try/catch so a transient
        // DB ECONNRESET doesn't crash the entire process.
        try {
            await User.setOnlineStatus(socket.userId, true);
        } catch (dbErr) {
            logger.error(`⚠️  setOnlineStatus failed for ${socket.userId}: ${dbErr.message}`);
        }

        // Periodic cleanup for disappearing messages (Runs once per connection)
        if (!global._disappearingCleanupStarted) {
            global._disappearingCleanupStarted = true;
            setInterval(async () => {
                try {
                    // Find messages where expires_at <= NOW()
                    const [expiredRows] = await pool.query(
                        'SELECT message_id, chat_id, personal_chat_id, conversation_id FROM messages WHERE expires_at IS NOT NULL AND expires_at <= NOW()'
                    );
                    if (expiredRows && expiredRows.length > 0) {
                        const byChat = new Map();
                        const expiredIds = [];
                        expiredRows.forEach(r => {
                            const cid = r.chat_id || r.personal_chat_id || r.conversation_id;
                            if (cid) {
                                if (!byChat.has(cid)) byChat.set(cid, []);
                                byChat.get(cid).push(r.message_id);
                            }
                            expiredIds.push(r.message_id);
                        });

                        // Delete from delivery_queue and messages
                        await pool.query('DELETE FROM delivery_queue WHERE message_id IN (?)', [expiredIds]);
                        await pool.query('DELETE FROM messages WHERE message_id IN (?)', [expiredIds]);

                        // Broadcast realtime expiration to active chat rooms
                        byChat.forEach((msgIds, chatId) => {
                            io.to(`chat:${chatId}`).to(`conversation:${chatId}`).emit('messages_expired', {
                                chatId,
                                messageIds: msgIds
                            });
                        });
                    }
                } catch (e) {
                    console.error('Disappearing cleanup error:', e.message);
                }
            }, 10000); // Check every 10 seconds for precise disappearing message lifecycle
        }

        // Join user to their personal room
        socket.join(`user:${socket.userId}`);
        console.log(`Joined room user:${socket.userId}`);

        // Join all chat rooms (personal and group) they're part of
        try {
            await joinUserChatRooms(socket);
            await joinUserRoomChannels(socket);
        } catch (dbErr) {
            logger.error(`⚠️  joinUserChatRooms / joinUserRoomChannels failed for ${socket.userId}: ${dbErr.message}`);
        }

        // Broadcast online status to followers
        broadcastOnlineStatus(socket, true);

        // Broadcast group presence updates
        broadcastGroupPresence(io, socket);

        // ── CALL SIGNALING (1:1 WebRTC relay) ──
        require('./callSignaling').handleCallEvents(io, socket);

        // --- CHAT EVENTS ---

        // ── Register Session in DB ──
        const sessionId = socket.handshake.auth.sessionId || socket.handshake.auth.session_id || crypto.randomUUID();
        socket.sessionId = sessionId;
        try {
            await SessionService.registerSession({
                userId: socket.userId,
                sessionId,
                socketId: socket.id,
                platform: socket.handshake.auth.platform || 'web',
                pushToken: socket.handshake.auth.pushToken || null
            });
        } catch (sErr) {
            logger.error(`⚠️ Session registration error for ${socket.userId}:`, sErr.message);
        }

        // Handle disconnect: deactivate session
        socket.on('disconnect', async () => {
            try {
                await SessionService.deactivateSocket(socket.id);
            } catch (dErr) {
                logger.error(`⚠️ Deactivate socket error:`, dErr.message);
            }
        });

        // Join a specific chat (e.g., when opening a chat window)
        socket.on('join-chat', async (chatId) => {
            if (!socket.rooms.has(`chat:${chatId}`)) { socket.join(`chat:${chatId}`); }
            console.log('[ROOM CHECK]', { chatId, userId: socket.userId, timestamp: Date.now() });
        });

// Debug: retrieve list of rooms for this socket
socket.on('get-rooms', () => {
  logSocketRooms(socket, 'debug:get-rooms');
  socket.emit('rooms-data', {
    userId: socket.userId,
    rooms: Array.from(socket.rooms)
  });
});
        // Typing indicator — server-coordinated with auto-expiry & privacy enforcement
        socket.on('typing', async (data) => {
            const { chatId, isTyping } = data;
            if (!chatId) return;

            // Check sender's typing_indicator_enabled setting
            try {
                const [pRows] = await pool.query(
                    'SELECT typing_indicator_enabled FROM chat_privacy_settings WHERE chat_id = ? AND user_id = ?',
                    [chatId, socket.userId]
                );
                if (pRows && pRows.length > 0 && pRows[0].typing_indicator_enabled === 0) {
                    // Typing indicator privacy is disabled — do not transmit event
                    return;
                }
            } catch (pErr) {
                // If query fails, fallback to normal broadcast
                logger.debug('typing-privacy lookup failed; broadcasting typing event', pErr?.message || pErr);
            }

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

        // ── Real-Time Message Interaction Events (Reactions, Edits, Deletes, Pins, Stars, Sync) ──
        socket.on('add-reaction', async (data) => {
            try {
                const { messageId, emoji } = data || {};
                if (!messageId || !emoji) return;
                const result = await Message.addReaction(messageId, socket.userId, emoji);
                // Sender ACK
                socket.emit('operation-confirmed', {
                    operationId: data.operationId || result.eventId,
                    event_id: result.eventId,
                    sequence_no: result.sequenceNo,
                    type: 'add-reaction',
                    messageId,
                    emoji
                });
                // Broadcast to room
                io.to(`chat:${result.chatId}`).emit('new-reaction', {
                    chatId: result.chatId,
                    messageId,
                    userId: socket.userId,
                    emoji,
                    event_id: result.eventId,
                    sequence_no: result.sequenceNo
                });
            } catch (err) {
                logger.error('Socket add-reaction error:', err);
                socket.emit('operation-failed', { operationId: data?.operationId, error: err.message });
            }
        });

        socket.on('remove-reaction', async (data) => {
            try {
                const { messageId } = data || {};
                if (!messageId) return;
                const result = await Message.removeReaction(messageId, socket.userId);
                // Sender ACK
                socket.emit('operation-confirmed', {
                    operationId: data.operationId || result.eventId,
                    event_id: result.eventId,
                    sequence_no: result.sequenceNo,
                    type: 'remove-reaction',
                    messageId
                });
                // Broadcast to room
                io.to(`chat:${result.chatId}`).emit('reaction-removed', {
                    chatId: result.chatId,
                    messageId,
                    userId: socket.userId,
                    event_id: result.eventId,
                    sequence_no: result.sequenceNo
                });
            } catch (err) {
                logger.error('Socket remove-reaction error:', err);
                socket.emit('operation-failed', { operationId: data?.operationId, error: err.message });
            }
        });

        socket.on('edit-message', async (data, callback) => {
            try {
                const { messageId, content } = data || {};
                if (!messageId || !content || !content.trim()) {
                    if (typeof callback === 'function') callback({ success: false, error: 'MessageId and content are required' });
                    return;
                }
                const result = await Message.editMessage(messageId, socket.userId, content.trim());
                if (!result) {
                    if (typeof callback === 'function') callback({ success: false, error: 'Cannot edit message (not yours or past 15 min)' });
                    return socket.emit('operation-failed', { operationId: data?.operationId, error: 'Cannot edit message' });
                }
                // Sender ACK
                socket.emit('operation-confirmed', {
                    operationId: data?.operationId || result.eventId,
                    event_id: result.eventId,
                    sequence_no: result.sequenceNo,
                    type: 'edit-message',
                    messageId,
                    content: content.trim(),
                    is_edited: true,
                    edited: true,
                    edited_at: result.edited_at
                });
                // Broadcast to room
                io.to(`chat:${result.chatId}`).emit('message-edited', {
                    chatId: result.chatId,
                    messageId,
                    content: content.trim(),
                    is_edited: true,
                    edited: true,
                    edited_at: result.edited_at,
                    event_id: result.eventId,
                    sequence_no: result.sequenceNo
                });
                if (typeof callback === 'function') callback({ success: true, data: result });
            } catch (err) {
                logger.error('Socket edit-message error:', err);
                if (typeof callback === 'function') callback({ success: false, error: err.message });
                socket.emit('operation-failed', { operationId: data?.operationId, error: err.message });
            }
        });

        socket.on('delete-message', async (data) => {
            try {
                const { messageId } = data || {};
                if (!messageId) return;
                const result = await Message.deleteMessageForEveryone(messageId, socket.userId);
                if (!result) return socket.emit('operation-failed', { operationId: data.operationId, error: 'Cannot delete message' });
                // Sender ACK
                socket.emit('operation-confirmed', {
                    operationId: data.operationId || result.eventId,
                    event_id: result.eventId,
                    sequence_no: result.sequenceNo,
                    type: 'delete-message',
                    messageId
                });
                // Broadcast to room
                io.to(`chat:${result.chatId}`).emit('message-deleted-everyone', {
                    chatId: result.chatId,
                    messageId,
                    event_id: result.eventId,
                    sequence_no: result.sequenceNo
                });
            } catch (err) {
                logger.error('Socket delete-message error:', err);
                socket.emit('operation-failed', { operationId: data?.operationId, error: err.message });
            }
        });

        socket.on('pin-message', async (data) => {
            try {
                const { messageId, pinned } = data || {};
                if (!messageId) return;
                const result = await Message.pinMessage(messageId, socket.userId, pinned !== false);
                socket.emit('operation-confirmed', {
                    operationId: data.operationId || result.eventId,
                    event_id: result.eventId,
                    sequence_no: result.sequenceNo,
                    type: 'pin-message',
                    messageId,
                    pinned: pinned !== false
                });
                io.to(`chat:${result.chatId}`).emit('message-pinned-updated', {
                    chatId: result.chatId,
                    messageId,
                    pinned: pinned !== false,
                    event_id: result.eventId,
                    sequence_no: result.sequenceNo
                });
            } catch (err) {
                logger.error('Socket pin-message error:', err);
                socket.emit('operation-failed', { operationId: data?.operationId, error: err.message });
            }
        });

        socket.on('star-message', async (data) => {
            try {
                const { messageId, starred } = data || {};
                if (!messageId) return;
                const result = await Message.starMessage(messageId, socket.userId, starred !== false);
                socket.emit('operation-confirmed', {
                    operationId: data.operationId || result.eventId,
                    event_id: result.eventId,
                    sequence_no: result.sequenceNo,
                    type: 'star-message',
                    messageId,
                    starred: starred !== false
                });
            } catch (err) {
                logger.error('Socket star-message error:', err);
                socket.emit('operation-failed', { operationId: data?.operationId, error: err.message });
            }
        });

        socket.on('sync-request', async (data) => {
            try {
                const { chatId, sinceSeq = 0 } = data || {};
                if (!chatId) return;
                const events = await Message.getEventsSinceSeq(chatId, sinceSeq);
                socket.emit('sync-response', { chatId, events, sinceSeq });
            } catch (err) {
                logger.error('Socket sync-request error:', err);
            }
        });
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

        // --- ROOM & CHANNEL EVENTS ---
        socket.on('join-room', (roomId) => {
            if (!socket.rooms.has(`room:${roomId}`)) {
                socket.join(`room:${roomId}`);
                console.log(`[ROOM EVENT] User ${socket.userId} joined room:${roomId}`);
            }
        });

        socket.on('leave-room', (roomId) => {
            socket.leave(`room:${roomId}`);
            console.log(`[ROOM EVENT] User ${socket.userId} left room:${roomId}`);
        });

        socket.on('join-room-channel', (channelId) => {
            if (!socket.rooms.has(`room_channel:${channelId}`)) {
                socket.join(`room_channel:${channelId}`);
                console.log(`[ROOM EVENT] User ${socket.userId} joined room_channel:${channelId}`);
            }
        });

        socket.on('leave-room-channel', (channelId) => {
            socket.leave(`room_channel:${channelId}`);
            console.log(`[ROOM EVENT] User ${socket.userId} left room_channel:${channelId}`);
        });

        socket.on('send-room-channel-message', async (data, callback) => {
            try {
                const { channelId, content, type = 'text', mediaUrl, mediaType, replyToId } = data;
                if (!channelId) {
                    return socket.emit('room-message-error', { error: 'Channel ID is required' });
                }

                // Verify room membership first
                const channel = await RoomChannel.findById(channelId);
                if (!channel) {
                    return socket.emit('room-message-error', { error: 'Channel not found' });
                }

                const [memberRows] = await pool.query(
                    'SELECT role, status FROM room_members WHERE room_id = ? AND user_id = ? LIMIT 1',
                    [channel.room_id, socket.userId]
                );
                const membership = memberRows[0];
                if (!membership || ['left', 'removed', 'banned'].includes(membership.status)) {
                    return socket.emit('room-message-error', { error: 'Not a member of this room' });
                }

                // Check read-only constraint
                if (channel.is_read_only) {
                    const room = await Room.findById(channel.room_id);
                    const isAuthorized = ['owner', 'admin', 'dept_admin'].includes(membership.role) || (room && room.creator_id === socket.userId);
                    if (!isAuthorized) {
                        return socket.emit('room-message-error', { error: 'This channel is read-only' });
                    }
                }

                const messageId = await ChannelMessage.create({
                    channelId,
                    senderId: socket.userId,
                    type,
                    content,
                    mediaUrl,
                    mediaType,
                    replyToId
                });

                const [msgRows] = await pool.query(
                    `SELECT cm.*, u.name as sender_name, u.username as sender_username, u.avatar_url as sender_avatar 
                     FROM channel_messages cm
                     JOIN users u ON cm.sender_id = u.user_id
                     WHERE cm.message_id = ?`,
                    [messageId]
                );
                const message = msgRows[0] || {};

                if (typeof callback === 'function') {
                    callback({ success: true, messageId, sentAt: message.sent_at });
                }

                // Broadcast to all in the channel room
                io.to(`room_channel:${channelId}`).emit('room_channel_message', message);
            } catch (error) {
                logger.error('Send room channel message error:', error);
                if (typeof callback === 'function') {
                    callback({ success: false, error: 'Database or broadcast error' });
                }
                socket.emit('room-message-error', { error: 'Failed to send message' });
            }
        });

        // Send Message
        socket.on('send-message', async (data, callback) => {
            const traceId = realtimeLogger.generateTraceId();
            realtimeLogger.trace(traceId, 'SERVER_RECEIVE', { chatId: data.chatId, senderId: socket.userId });
            try {
                const MESSAGE_TRACE_ID = crypto.randomUUID();
                secureLogger.messageTrace(MESSAGE_TRACE_ID, 'client_send', { chatId: data.chatId, senderId: socket.userId, recipientId: data.recipientId || data.partnerId });
                const { chatId, content, type = 'text', mediaUrl, storyId, replyToId, marketplaceListingId, viewPolicy = 'unlimited', attachment, messageId: clientMessageId } = data;
                const recipientId = data.recipientId || data.partnerId;
                let context = data.context || 'chat';

                const metadata = attachment ? JSON.stringify({ attachment }) : null;

                // --- Moderation & Group Access Enforcement ---
                if (chatId) {
                    try {
                        const [groups] = await pool.query('SELECT only_admins_send FROM group_chats WHERE chat_id = ?', [chatId]);
                        if (groups.length > 0 && groups[0].only_admins_send === 1) {
                            const isAdmin = await GroupMember.isAdmin(chatId, socket.userId);
                            if (!isAdmin) {
                                return socket.emit('message-error', { error: 'Only admins can send messages' });
                            }
                        }
                    } catch (moderationErr) {
                        logger.warn(`[Socket] GroupMember moderation check failed for chatId=${chatId}, allowing message: ${moderationErr.message}`);
                    }
                }

                if (context === 'chat' && (marketplaceListingId || data.listingId)) context = 'marketplace';

                // Check for idempotency (if message was saved previously but ACK was lost)
                let alreadyExisted = false;
                if (clientMessageId) {
                    const [chk] = await pool.query('SELECT message_id FROM messages WHERE message_id = ? LIMIT 1', [clientMessageId]);
                    if (chk && chk.length > 0) {
                        alreadyExisted = true;
                        logger.info(`🔄 [Socket Idempotency] Duplicate message retry detected for messageId=${clientMessageId}`);
                    }
                }

                // 1. Authoritative MySQL Persistence (Validate -> INSERT -> COMMIT)
                realtimeLogger.trace(traceId, 'DB_SAVE_START', { chatId: data.chatId, clientMessageId });
                const messageId = await Message.sendMessage({
                    messageId: clientMessageId || undefined,
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
                    context,
                    metadata,
                });
                realtimeLogger.trace(traceId, 'DB_SAVE_SUCCESS', { messageId, alreadyExisted });

                // Retrieve saved message with complete reply & sender metadata
                const [fullMessage] = await pool.query(`
                    SELECT m.*, 
                           u.name as sender_name, u.username as sender_username, u.avatar_url as sender_avatar,
                           rm.content as reply_content, rm.type as reply_type, ru.name as reply_sender_name,
                           rm.media_url as reply_media_url, rm.is_deleted_for_everyone as reply_is_deleted
                    FROM messages m
                    JOIN users u ON m.sender_id = u.user_id
                    LEFT JOIN messages rm ON m.reply_to_message_id = rm.message_id
                    LEFT JOIN users ru ON rm.sender_id = ru.user_id
                    WHERE m.message_id = ?
                `, [messageId]);

                const message = fullMessage[0] || {};
                const finalChatId = message.chat_id || message.conversation_id || message.personal_chat_id || chatId;
                if (!message.chat_id) { message.chat_id = finalChatId; }
                message.chatId = finalChatId;
                message.id = message.message_id;
                message.senderId = message.sender_id;
                // Recipient is whatever the model stored (derived from the chat pair) —
                // never the client-supplied recipientId/partnerId (forged-emit/push fix).
                const trueRecipientId = message.recipient_id || null;

                // 2. Authoritative ACK to Sender
                if (typeof callback === 'function') {
                    callback({ 
                        success: true, 
                        messageId, 
                        sentAt: message.sent_at,
                        server_sequence: message.server_sequence 
                    });
                }

                realtimeLogger.trace(traceId, 'EMIT_TO_SENDER', { messageId });
                socket.emit('message-sent', message);

                // If this message was already processed in a previous attempt, skip duplicate room broadcast & push notifications
                if (alreadyExisted) {
                    return;
                }

                realtimeLogger.trace(traceId, 'EMIT_TO_ROOM', { chatId: finalChatId, messageId });
                socket.to(`chat:${finalChatId}`).emit('new-message', message);

                // 3. Asynchronous Non-Critical Operations (Post-Emit)
                setImmediate(async () => {
                    try {
                        // User room chat list update
                        io.to(`user:${socket.userId}`).emit('chat-updated', { chatId: finalChatId });
                        if (trueRecipientId) {
                            io.to(`user:${trueRecipientId}`).emit('chat-updated', { chatId: finalChatId });

                            // Push Notification queueing for offline recipient
                            const isOnline = userSockets.has(trueRecipientId) && userSockets.get(trueRecipientId).size > 0;
                            if (!isOnline) {
                                try {
                                    const { buildMessageNotificationPayload } = require('../utils/notificationPayloadHelper');
                                    const payload = buildMessageNotificationPayload({
                                        sender: {
                                            user_id: socket.userId,
                                            name: message.sender_name || socket.user?.name,
                                            username: message.sender_username || socket.user?.username,
                                            avatar_url: message.sender_avatar || socket.user?.avatar_url
                                        },
                                        message: {
                                            message_id: messageId,
                                            chat_id: finalChatId,
                                            conversation_id: message.conversation_id,
                                            content: message.content,
                                            type: message.type,
                                            media_url: message.media_url,
                                            metadata: message.metadata,
                                            sent_at: message.sent_at,
                                            server_sequence: message.server_sequence
                                        }
                                    });
                                    await queuePushNotification(trueRecipientId, {
                                        type: 'message',
                                        title: payload.title,
                                        body: payload.body,
                                        data: payload.data
                                    });
                                } catch (pushQueueErr) {
                                    logger.warn('[Socket queuePushNotification error]:', pushQueueErr?.message || pushQueueErr);
                                }
                            }
                        }

                        // Check for @Sparkle mention OR reply to a Sparkly AI message
                        const sparklyMentionMatch = content && /@sparkl(?:y|e)\b/i.test(content);
                        let isReplyToSparkly = false;
                        const replyId = data.replyToId || data.reply_to_message_id;
                        if (replyId) {
                            try {
                                const [replyRows] = await pool.query('SELECT sender_id, metadata FROM messages WHERE message_id = ? LIMIT 1', [replyId]);
                                if (replyRows && replyRows.length > 0) {
                                    const rMsg = replyRows[0];
                                    if (rMsg.sender_id === 'sparkly_bot' || (rMsg.metadata && rMsg.metadata.includes('sparkly_bot'))) {
                                        isReplyToSparkly = true;
                                    }
                                }
                            } catch (e) {
                                logger.debug('sparkly reply lookup failed', e?.message || e);
                            }
                        }

                        if (sparklyMentionMatch || isReplyToSparkly) {
                            handleSparklyMentionInChat({
                                io,
                                chatId: finalChatId,
                                senderUserId: socket.userId,
                                senderName: socket.user?.name || socket.user?.username || 'User',
                                userMessage: content,
                                replyToMessageId: replyId
                            }).catch(err => logger.error('[SparklyMention] Async execution error:', err));
                        }
                    } catch (asyncErr) {
                        logger.error('[Socket Post-Emit Error]:', asyncErr);
                    }
                });

            } catch (error) {
                logger.error('Send message error:', error);
                realtimeLogger.error(traceId, 'SEND_MESSAGE_ERROR', error, { data });
                const isBlocked = Boolean(error.isBlocked || error.code === 'MESSAGE_BLOCKED' || error.message?.includes('blocked'));
                const isBadUrl = error.code === 'INVALID_MEDIA_URL';
                const isForbidden = error.code === 'CHAT_FORBIDDEN';
                const isNotFound = error.code === 'CHAT_NOT_FOUND';
                const errorCode = isBlocked ? 'MESSAGE_BLOCKED'
                    : isBadUrl ? 'INVALID_MEDIA_URL'
                    : isForbidden ? 'CHAT_FORBIDDEN'
                    : isNotFound ? 'CHAT_NOT_FOUND'
                    : 'MESSAGE_ERROR';
                const errorMessage = isBlocked ? 'You cannot message this user (blocked)' : (error.message || 'Failed to send message');

                if (typeof callback === 'function') {
                    callback({ success: false, code: errorCode, isBlocked, error: errorMessage });
                }
                socket.emit('message-error', {
                    code: errorCode,
                    isBlocked,
                    error: errorMessage,
                    chatId: data.chatId,
                    clientMessageId: data.messageId || data.clientMessageId
                });
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

        // Enterprise Delivery ACK handler (Session-aware)
        socket.on('message-delivered-ack', async (data, callback) => {
            try {
                const { messageId, sessionId } = data || {};
                if (!messageId) return;
                const targetSessionId = sessionId || socket.sessionId;
                await Message.markSessionDelivered(messageId, targetSessionId, socket.userId);
                
                const msg = await Message.getById(messageId);
                if (msg) {
                    const chatId = msg.chat_id || msg.conversation_id;
                    const payload = {
                        messageId,
                        chatId,
                        recipientUserId: socket.userId,
                        deliveredAt: new Date().toISOString()
                    };
                    io.to(`chat:${chatId}`).emit('message-delivered-update', payload);
                    io.to(`chat:${chatId}`).emit('messages-delivered', payload);
                    if (msg.sender_id) {
                        io.to(`user:${msg.sender_id}`).emit('message-delivered-update', payload);
                        io.to(`user:${msg.sender_id}`).emit('messages-delivered', payload);
                    }
                }
                if (typeof callback === 'function') callback({ success: true });
            } catch (err) {
                logger.error('message-delivered-ack error:', err);
            }
        });

        // Enterprise Tri-Condition Read Receipt ACK handler
        socket.on('message-read-ack', async (data, callback) => {
            try {
                const { chatId, messageIds } = data || {};
                if (!chatId) return;
                const { readReceiptsEnabled } = await Message.markReadTriCondition(chatId, messageIds, socket.userId);

                if (readReceiptsEnabled) {
                    const readAt = new Date().toISOString();
                    const payload = {
                        chatId,
                        messageIds: messageIds || null,
                        readerUserId: socket.userId,
                        userId: socket.userId,
                        readAt
                    };
                    io.to(`chat:${chatId}`).emit('message-read-update', payload);
                    io.to(`chat:${chatId}`).emit('messages-read', payload);

                    // Also broadcast to the other participant's personal user room if 1-on-1 chat
                    const [chatRows] = await pool.query(
                        'SELECT participant1_id, participant2_id FROM personal_chats WHERE chat_id = ? LIMIT 1',
                        [chatId]
                    );
                    if (chatRows && chatRows.length > 0) {
                        const partnerId = String(chatRows[0].participant1_id) === String(socket.userId)
                            ? chatRows[0].participant2_id
                            : chatRows[0].participant1_id;
                        if (partnerId) {
                            io.to(`user:${partnerId}`).emit('message-read-update', payload);
                            io.to(`user:${partnerId}`).emit('messages-read', payload);
                        }
                    }
                }
                if (typeof callback === 'function') callback({ success: true, readReceiptsEnabled: !!readReceiptsEnabled });
            } catch (err) {
                logger.error('message-read-ack error:', err);
            }
        });

        // Enterprise Cursor Delta Synchronization
        socket.on('cursor-sync-request', async (data, callback) => {
            try {
                const { lastCursor = 0 } = data || {};
                const messages = await Message.getCursorDelta(socket.userId, lastCursor);
                if (typeof callback === 'function') {
                    callback({ success: true, messages });
                } else {
                    socket.emit('cursor-sync-response', { messages });
                }
            } catch (err) {
                logger.error('cursor-sync-request error:', err);
                if (typeof callback === 'function') callback({ success: false, error: 'Sync failed' });
            }
        });

        // Legacy mark-read & mark-delivered compatibility wrappers
        socket.on('mark-read', async (chatId) => {
            try {
                const { readReceiptsEnabled } = await Message.markReadTriCondition(chatId, null, socket.userId);
                if (readReceiptsEnabled) {
                    const readAt = new Date().toISOString();
                    const payload = {
                        chatId,
                        readerUserId: socket.userId,
                        userId: socket.userId,
                        readAt
                    };
                    io.to(`chat:${chatId}`).emit('message-read-update', payload);
                    io.to(`chat:${chatId}`).emit('messages-read', payload);

                    const [chatRows] = await pool.query(
                        'SELECT participant1_id, participant2_id FROM personal_chats WHERE chat_id = ? LIMIT 1',
                        [chatId]
                    );
                    if (chatRows && chatRows.length > 0) {
                        const partnerId = String(chatRows[0].participant1_id) === String(socket.userId)
                            ? chatRows[0].participant2_id
                            : chatRows[0].participant1_id;
                        if (partnerId) {
                            io.to(`user:${partnerId}`).emit('message-read-update', payload);
                            io.to(`user:${partnerId}`).emit('messages-read', payload);
                        }
                    }
                }
            } catch (error) {
                logger.error('Mark read error:', error);
            }
        });

        socket.on('mark-delivered', async (data) => {
            try {
                const { messageId } = data || {};
                if (messageId) {
                    await Message.markSessionDelivered(messageId, socket.sessionId, socket.userId);
                    const msg = await Message.getById(messageId);
                    if (msg && msg.sender_id) {
                        const payload = {
                            messageId,
                            chatId: msg.chat_id || msg.conversation_id,
                            recipientUserId: socket.userId,
                            deliveredAt: new Date().toISOString()
                        };
                        io.to(`user:${msg.sender_id}`).emit('message-delivered-update', payload);
                        io.to(`user:${msg.sender_id}`).emit('messages-delivered', payload);
                    }
                }
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

        // Explicit offline signal (tab close / beforeunload) - checks multi-device active sessions
        socket.on('presence:offline', async () => {
            try {
                logger.info(`📴 Explicit offline signal from ${socket.userId}`);
                const sessions = userSockets.get(socket.userId);
                if (sessions) {
                    sessions.delete(socket);
                    if (sessions.size === 0) {
                        userSockets.delete(socket.userId);
                    }
                }
                const stillOnline = userSockets.has(socket.userId) && userSockets.get(socket.userId).size > 0;
                if (stillOnline) {
                    logger.info(`📡 User still has active sessions on other devices, staying ONLINE: ${socket.userId}`);
                    return;
                }
                // Respect the same grace window as a transport disconnect so a
                // rapid reload/reconnect never flickers offline → online.
                if (pendingOfflineTimers.has(socket.userId)) {
                    clearTimeout(pendingOfflineTimers.get(socket.userId));
                    pendingOfflineTimers.delete(socket.userId);
                }
                const timer = setTimeout(async () => {
                    try {
                        const still = userSockets.has(socket.userId) && userSockets.get(socket.userId).size > 0;
                        if (!still) {
                            await User.setOnlineStatus(socket.userId, false);
                            await broadcastOnlineStatus(socket, false);
                            logger.info(`📴 User offline after grace period (explicit signal): ${socket.userId}`);
                        }
                    } catch (e) {
                        logger.error('Grace offline error (explicit signal):', e);
                    } finally {
                        pendingOfflineTimers.delete(socket.userId);
                    }
                }, OFFLINE_GRACE_MS);
                pendingOfflineTimers.set(socket.userId, timer);
            } catch (e) {
                logger.error('presence:offline error:', e);
            }
        });

        // Custom heartbeat ping-pong (supplements socket.io's built-in ping)
        socket.on('sparkle-ping', async () => {
            try {
                // Only refresh presence while this socket is still a tracked
                // session. A socket that already sent presence:offline was
                // removed from userSockets and must not resurrect is_online.
                const sessions = userSockets.get(socket.userId);
                const isActiveSession = sessions && sessions.has(socket);
                if (isActiveSession) {
                    await pool.query('UPDATE users SET last_seen_at = UTC_TIMESTAMP(), is_online = 1 WHERE user_id = ?', [socket.userId]);
                }
            } catch (e) {
                logger.error('Error updating presence on heartbeat:', e);
            }
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

        // Delete message for everyone (strictly server-authoritative)
        socket.on('delete-for-everyone', async (data, callback) => {
            const { messageId, chatId, operationId } = data;
            try {
                const msg = await Message.getById(messageId);
                if (!msg) {
                    if (typeof callback === 'function') callback({ success: false, error: 'Message not found' });
                    return;
                }

                // Idempotency check: If message is already deleted for everyone, ACK immediately
                if (msg.is_deleted_for_everyone === 1) {
                    if (operationId) {
                        socket.emit('operation-confirmed', { operationId, type: 'delete-for-everyone' });
                    }
                    if (typeof callback === 'function') callback({ success: true, operationId, messageId, alreadyDeleted: true });
                    return;
                }

                // Determine conversation type for permission check
                const [groupExists] = await pool.query('SELECT chat_id FROM group_chats WHERE chat_id = ?', [chatId]);
                const conv = { type: groupExists.length > 0 ? 'group' : 'private' };
                if (!perms.canDeleteForEveryone(socket.user, msg, conv)) {
                    socket.emit('delete-rejected', { messageId, chatId, originalContent: msg.content, reason: 'Permission denied', operationId });
                    if (typeof callback === 'function') callback({ success: false, error: 'Permission denied: cannot delete this message for everyone.' });
                    return;
                }

                const success = await Message.deleteForEveryone(messageId, socket.userId, operationId, conv.type === 'group', socket.user.username);
                if (success) {
                    io.to(`chat:${chatId}`).emit('message-deleted-everyone', { messageId, chatId, operationId, deletedAt: new Date().toISOString() });
                    if (operationId) {
                        socket.emit('operation-confirmed', { operationId, type: 'delete-for-everyone' });
                    }
                    secureLogger.deleteTrace(messageId, chatId, socket.userId);
                    secureLogger.safeLog('DELETE_FOR_EVERYONE', { chatId, messageId, userId: socket.userId });
                    if (typeof callback === 'function') callback({ success: true, operationId, messageId });
                } else {
                    socket.emit('delete-rejected', { messageId, chatId, originalContent: msg.content, reason: 'Server database error', operationId });
                    if (typeof callback === 'function') callback({ success: false, error: 'Failed to delete message for everyone.' });
                }
            } catch (error) {
                logger.error('Delete for everyone error:', error);
                if (typeof callback === 'function') callback({ success: false, error: error.message || 'Server error' });
            }
        });

        // Delete message for me
        socket.on('delete-for-me', async (data, callback) => {
            const { messageId, chatId, operationId } = data;
            try {
                const success = await Message.deleteForMe(messageId, socket.userId, operationId);
                if (success) {
                    if (operationId) {
                        socket.emit('operation-confirmed', { operationId, type: 'delete-for-me' });
                    }
                    socket.emit('message-deleted-me', { messageId, chatId, operationId });
                    if (typeof callback === 'function') callback({ success: true, operationId });
                } else {
                    if (typeof callback === 'function') callback({ success: false, error: 'Failed to delete message locally' });
                }
            } catch (error) {
                logger.error('Delete for me error:', error);
                if (typeof callback === 'function') callback({ success: false, error: 'Server error' });
            }
        });

        // Delete messages for me (bulk)
        socket.on('delete-for-me-bulk', async (data, callback) => {
            const { messageIds, chatId, operationId } = data;
            try {
                if (!Array.isArray(messageIds) || messageIds.length === 0) {
                    if (typeof callback === 'function') callback({ success: true });
                    return;
                }
                const success = await Message.deleteForMeBulk(messageIds, socket.userId, operationId);
                if (operationId) {
                    socket.emit('operation-confirmed', { operationId, type: 'delete-for-me-bulk' });
                }
                if (typeof callback === 'function') callback({ success: true, operationId });
            } catch (error) {
                logger.error('Delete for me bulk error:', error);
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

        // Forward Message
        socket.on('forward-message', async (data, callback) => {
            const { targetChatIds } = data || {};
            const rawMessageIds = data.messageIds && Array.isArray(data.messageIds)
                ? data.messageIds
                : [data.messageId].filter(Boolean);

            if (!Array.isArray(targetChatIds) || targetChatIds.length === 0 || targetChatIds.length > 5) {
                if (typeof callback === 'function') callback({ success: false, error: 'Cannot forward to more than 5 recipients at a time.' });
                return;
            }

            if (!rawMessageIds || rawMessageIds.length === 0) {
                if (typeof callback === 'function') callback({ success: false, error: 'At least one message is required to forward.' });
                return;
            }

            try {
                const forwardedMessages = [];

                for (const srcMsgId of rawMessageIds) {
                    const originalMsg = await Message.getById(srcMsgId);
                    if (!originalMsg) continue;

                    const sourceChatId = originalMsg.chat_id || originalMsg.conversation_id || originalMsg.personal_chat_id;
                    const [privacyRows] = await pool.query(
                        'SELECT allow_forward, allow_copy, block_screenshot, blur_screen_recording, privacy_version FROM chat_privacy_settings WHERE chat_id = ? AND user_id = ?',
                        [sourceChatId, originalMsg.sender_id || originalMsg.senderId]
                    );
                    const senderPrivacy = (privacyRows && privacyRows[0]) ? privacyRows[0] : {};
                    const permissions = PermissionEngine.computePermissions({
                        message: originalMsg,
                        senderPrivacy,
                        viewerUserId: socket.userId
                    });

                    if (!permissions.canForward) {
                        continue;
                    }

                    // Root lineage and authoritative forward count
                    const rootMessageId = originalMsg.forward_lineage_id || originalMsg.source_message_id || originalMsg.message_id;
                    await pool.query(
                        'UPDATE messages SET forward_count = IFNULL(forward_count, 0) + 1 WHERE message_id = ?',
                        [rootMessageId]
                    );
                    const [fcRows] = await pool.query('SELECT forward_count FROM messages WHERE message_id = ?', [rootMessageId]);
                    const forwardCount = fcRows[0]?.forward_count || 1;

                    for (const targetChatId of targetChatIds) {
                        const [pc] = await pool.query('SELECT participant1_id, participant2_id FROM personal_chats WHERE chat_id = ?', [targetChatId]);

                        let recipientId = null;
                        if (pc.length > 0) {
                            recipientId = pc[0].participant1_id === socket.userId ? pc[0].participant2_id : pc[0].participant1_id;
                        }

                        const newMsgId = crypto.randomUUID();
                        const sentAt = new Date();
                        const personalChatId = pc.length > 0 ? targetChatId : null;
                        const groupChatId = pc.length > 0 ? null : targetChatId;

                        await pool.query(`
                            INSERT INTO chat_sequences (chat_id, last_sequence) VALUES (?, 1)
                            ON DUPLICATE KEY UPDATE last_sequence = last_sequence + 1
                        `, [targetChatId]);
                        const [seqRow] = await pool.query('SELECT last_sequence FROM chat_sequences WHERE chat_id = ?', [targetChatId]);
                        const serverSequence = seqRow[0]?.last_sequence || 1;

                        await pool.query(`
                            INSERT INTO messages (
                                message_id, chat_id, conversation_id, personal_chat_id, 
                                sender_id, recipient_id, content, type, media_url, 
                                status, is_read, sent_at, context,
                                forwarded, forwarded_from, source_message_id, forward_lineage_id, forward_count,
                                server_sequence
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', 0, ?, 'chat', 1, ?, ?, ?, ?, ?)
                        `, [
                            newMsgId,
                            groupChatId,
                            personalChatId,
                            personalChatId,
                            socket.userId,
                            recipientId,
                            originalMsg.content,
                            originalMsg.type,
                            originalMsg.media_url,
                            sentAt,
                            socket.user?.username || socket.user?.name || 'user',
                            rootMessageId,
                            rootMessageId,
                            forwardCount,
                            serverSequence
                        ]);

                        try {
                            const deliveryId = crypto.randomUUID();
                            await pool.query(`
                                INSERT INTO message_forward_deliveries (delivery_id, source_message_id, forwarded_message_id, destination_chat_id, forwarded_by_user_id)
                                VALUES (?, ?, ?, ?, ?)
                            `, [deliveryId, rootMessageId, newMsgId, targetChatId, socket.userId]);
                        } catch (e) {
                            // Table note
                        }

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
                        `, [newMsgId]);

                        if (fullMessage && fullMessage[0]) {
                            const message = {
                                ...fullMessage[0],
                                sent_at: sentAt.toISOString(),
                                chatId: targetChatId,
                                chat_id: targetChatId,
                                forwarded: true,
                                forwarded_from: socket.user?.username || socket.user?.name || 'user',
                                source_message_id: rootMessageId,
                                forward_lineage_id: rootMessageId,
                                forward_count: forwardCount
                            };

                            socket.emit('new-message', message);
                            socket.emit('message-sent', message);
                            socket.to(`chat:${targetChatId}`).emit('new-message', message);
                            forwardedMessages.push(message);
                        }
                    }
                }

                if (typeof callback === 'function') callback({ success: true, messages: forwardedMessages });
            } catch (error) {
                logger.error('Forward message error:', error);
            }
        });

        // Helper: format duration text (e.g. "24 hours", "7 days")
        const formatDurationText = (seconds) => {
            if (!seconds || seconds <= 0) return 'off';
            if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
            if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
            if (seconds === 86400) return '24 hours';
            const days = Math.round(seconds / 86400);
            return `${days} ${days === 1 ? 'day' : 'days'}`;
        };

        const normalizeDisappearingSeconds = (val) => {
            const num = parseInt(val, 10) || 0;
            if (num <= 0) return 0;
            if (num === 24) return 86400;
            if (num === 7) return 604800;
            if (num === 90) return 7776000;
            return num;
        };

        // Disappearing Messages toggle (Authoritative Server Synchronization)
        socket.on('disappearing_messages', async (data, callback) => {
            const { chatId, duration: rawDuration, clientVersion } = data || {};
            try {
                if (!chatId) {
                    if (typeof callback === 'function') callback({ success: false, error: 'chatId is required' });
                    return;
                }

                // Verify participant
                const [pcRows] = await pool.query(
                    'SELECT chat_id, disappearing_duration, disappearing_version, participant1_id, participant2_id FROM personal_chats WHERE chat_id = ?',
                    [chatId]
                );
                const [gcRows] = pcRows.length === 0 ? await pool.query(
                    'SELECT gc.chat_id, gc.disappearing_duration, gc.disappearing_version FROM group_chats gc JOIN group_chat_members gcm ON gc.chat_id = gcm.chat_id WHERE gc.chat_id = ? AND gcm.user_id = ?',
                    [chatId, socket.userId]
                ) : [[]];

                const isPersonal = pcRows.length > 0;
                const chatRow = isPersonal ? pcRows[0] : gcRows[0];
                if (!chatRow) {
                    if (typeof callback === 'function') callback({ success: false, error: 'Unauthorized: not a member of this chat' });
                    return;
                }

                if (isPersonal && chatRow.participant1_id !== socket.userId && chatRow.participant2_id !== socket.userId) {
                    if (typeof callback === 'function') callback({ success: false, error: 'Unauthorized' });
                    return;
                }

                const prevDuration = chatRow.disappearing_duration || 0;
                const prevVersion = chatRow.disappearing_version || 1;
                const newDuration = normalizeDisappearingSeconds(rawDuration);

                // Concurrency control: if client passed older version than authoritative, reject
                if (clientVersion && clientVersion < prevVersion) {
                    if (typeof callback === 'function') callback({ success: false, error: 'Stale configuration version', currentVersion: prevVersion, duration: prevDuration });
                    return;
                }

                const newVersion = prevVersion + 1;
                const table = isPersonal ? 'personal_chats' : 'group_chats';
                const now = new Date();

                // Update authoritative chat settings
                await pool.query(
                    `UPDATE ${table} SET disappearing_duration = ?, disappearing_version = ?, disappearing_updated_at = NOW(), disappearing_updated_by = ? WHERE chat_id = ?`,
                    [newDuration, newVersion, socket.userId, chatId]
                );

                // 4.2 Expiry Semantics:
                // When disappearing messages are first enabled, existing eligible messages are
                // evaluated using their original authoritative creation timestamps.
                // Subsequent duration changes do not reset the expiry deadline of existing messages.
                if (prevDuration === 0 && newDuration > 0) {
                    await pool.query(
                        `UPDATE messages 
                         SET expires_at = DATE_ADD(COALESCE(created_at, sent_at), INTERVAL ? SECOND)
                         WHERE (chat_id = ? OR conversation_id = ? OR personal_chat_id = ?)
                           AND expires_at IS NULL
                           AND (is_deleted_for_everyone IS NULL OR is_deleted_for_everyone = 0)`,
                        [newDuration, chatId, chatId, chatId]
                    );
                }

                const actorName = socket.user?.name || socket.user?.username || 'User';
                let systemContent = '';
                let actionType = 'disabled';

                if (newDuration > 0) {
                    if (prevDuration > 0) {
                        actionType = 'changed';
                        systemContent = `${actorName} changed the disappearing-message duration to ${formatDurationText(newDuration)}.`;
                    } else {
                        actionType = 'enabled';
                        systemContent = `${actorName} enabled disappearing messages. Messages will disappear after ${formatDurationText(newDuration)}.`;
                    }
                } else {
                    actionType = 'disabled';
                    systemContent = `${actorName} turned off disappearing messages.`;
                }

                const systemMsgId = crypto.randomUUID();
                const metadataObj = {
                    system_type: 'disappearing_messages_change',
                    action: actionType,
                    duration: newDuration,
                    previous_duration: prevDuration,
                    actor_id: socket.userId,
                    actor_name: actorName,
                    version: newVersion,
                    updated_at: now.toISOString()
                };

                await pool.query(
                    `INSERT INTO messages (
                        message_id, chat_id, conversation_id, sender_id, content, type, metadata, sent_at, status, is_read
                     ) VALUES (?, ?, ?, ?, ?, 'system', ?, NOW(), 'sent', 1)`,
                    [systemMsgId, chatId, chatId, socket.userId, systemContent, JSON.stringify(metadataObj)]
                );

                const systemMsg = {
                    message_id: systemMsgId,
                    id: systemMsgId,
                    chat_id: chatId,
                    chatId,
                    sender_id: socket.userId,
                    senderId: socket.userId,
                    content: systemContent,
                    type: 'system',
                    metadata: metadataObj,
                    sent_at: now.toISOString(),
                    status: 'sent'
                };

                // Broadcast authoritative update to chat room
                io.to(`chat:${chatId}`).emit('disappearing_messages_update', {
                    chatId,
                    duration: newDuration,
                    version: newVersion,
                    updatedAt: now.toISOString(),
                    updatedBy: socket.userId,
                    systemMessage: systemMsg
                });
                io.to(`chat:${chatId}`).emit('new-message', systemMsg);

                if (typeof callback === 'function') {
                    callback({ success: true, duration: newDuration, version: newVersion, systemMessage: systemMsg });
                }
            } catch (error) {
                logger.error('Disappearing messages error:', error);
                if (typeof callback === 'function') callback({ success: false, error: 'Internal server error' });
            }
        });

        // Set Chat Nickname (Authoritative Server Synchronization)
        socket.on('set_chat_nickname', async (data, callback) => {
            const { chatId, targetUserId, nickname: rawNickname } = data || {};
            try {
                if (!chatId || !targetUserId) {
                    if (typeof callback === 'function') callback({ success: false, error: 'chatId and targetUserId are required' });
                    return;
                }

                // Verify membership
                const [pc] = await pool.query(
                    'SELECT 1 FROM personal_chats WHERE chat_id = ? AND (participant1_id = ? OR participant2_id = ?) UNION SELECT 1 FROM group_chat_members WHERE chat_id = ? AND user_id = ?',
                    [chatId, socket.userId, socket.userId, chatId, socket.userId]
                );
                if (pc.length === 0) {
                    if (typeof callback === 'function') callback({ success: false, error: 'Unauthorized: not a member of this chat' });
                    return;
                }

                // Get target user display name
                const [targetRows] = await pool.query('SELECT user_id, name, username FROM users WHERE user_id = ?', [targetUserId]);
                const targetUser = targetRows[0] || {};
                const targetDisplayName = targetUser.name || targetUser.username || 'User';
                const actorName = socket.user?.name || socket.user?.username || 'User';

                // Get current nickname
                const [curNick] = await pool.query('SELECT nickname, version FROM chat_nicknames WHERE chat_id = ? AND user_id = ?', [chatId, targetUserId]);
                const prevNickname = curNick[0]?.nickname || null;
                const curVer = curNick[0]?.version || 0;
                const newVersion = curVer + 1;

                const cleanNickname = typeof rawNickname === 'string' ? rawNickname.trim().slice(0, 64) : '';

                if (cleanNickname) {
                    const nickId = crypto.randomUUID();
                    await pool.query(
                        `INSERT INTO chat_nicknames (id, chat_id, user_id, nickname, set_by_id, version)
                         VALUES (?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE nickname = VALUES(nickname), set_by_id = VALUES(set_by_id), version = version + 1`,
                        [nickId, chatId, targetUserId, cleanNickname, socket.userId, newVersion]
                    );
                } else {
                    await pool.query('DELETE FROM chat_nicknames WHERE chat_id = ? AND user_id = ?', [chatId, targetUserId]);
                }

                let systemContent = '';
                if (cleanNickname) {
                    if (prevNickname && prevNickname !== cleanNickname) {
                        systemContent = `${actorName} changed ${targetDisplayName}'s nickname from ${prevNickname} to ${cleanNickname}.`;
                    } else {
                        systemContent = `${actorName} set ${targetDisplayName}'s nickname to ${cleanNickname}.`;
                    }
                } else {
                    systemContent = `${actorName} removed ${targetDisplayName}'s nickname.`;
                }

                const systemMsgId = crypto.randomUUID();
                const now = new Date();
                const metadataObj = {
                    system_type: 'nickname_change',
                    actor_id: socket.userId,
                    actor_name: actorName,
                    target_user_id: targetUserId,
                    target_name: targetDisplayName,
                    previous_nickname: prevNickname,
                    new_nickname: cleanNickname || null,
                    version: newVersion,
                    updated_at: now.toISOString()
                };

                await pool.query(
                    `INSERT INTO messages (
                        message_id, chat_id, conversation_id, sender_id, content, type, metadata, sent_at, status, is_read
                     ) VALUES (?, ?, ?, ?, ?, 'system', ?, NOW(), 'sent', 1)`,
                    [systemMsgId, chatId, chatId, socket.userId, systemContent, JSON.stringify(metadataObj)]
                );

                const systemMsg = {
                    message_id: systemMsgId,
                    id: systemMsgId,
                    chat_id: chatId,
                    chatId,
                    sender_id: socket.userId,
                    senderId: socket.userId,
                    content: systemContent,
                    type: 'system',
                    metadata: metadataObj,
                    sent_at: now.toISOString(),
                    status: 'sent'
                };

                io.to(`chat:${chatId}`).emit('new-message', systemMsg);
                io.to(`chat:${chatId}`).emit('chat:nickname_updated', {
                    chatId,
                    targetUserId,
                    nickname: cleanNickname || null,
                    setById: socket.userId,
                    version: newVersion
                });
                io.to(`chat:${chatId}`).emit('nickname_updated', {
                    chatId,
                    targetUserId,
                    nickname: cleanNickname || null,
                    setById: socket.userId,
                    version: newVersion
                });

                if (typeof callback === 'function') {
                    callback({ success: true, targetUserId, nickname: cleanNickname || null, version: newVersion });
                }
            } catch (error) {
                logger.error('Set chat nickname error:', error);
                if (typeof callback === 'function') callback({ success: false, error: 'Internal server error' });
            }
        });

        // Handle disconnect (including network loss)
        socket.on('disconnect', async (reason) => {
            try {
                logger.info(`🔌 Socket disconnect: ${socket.id} reason=${reason} userId=${socket.userId}`);

                // Remove this specific socket from the user's active socket set
                const sessions = userSockets.get(socket.userId);
                if (sessions) {
                    sessions.delete(socket);
                    if (sessions.size === 0) {
                        userSockets.delete(socket.userId);
                    }
                }

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

                // If user still has other connected sessions on other devices/tabs, do NOT go offline!
                const hasRemainingSessions = userSockets.has(socket.userId) && userSockets.get(socket.userId).size > 0;
                if (hasRemainingSessions) {
                    logger.info(`📡 User still has active sessions on other devices, staying ONLINE: ${socket.userId}`);
                    return;
                }

                // Schedule offline transition after grace period for the last disconnected session
                // This allows brief network blips / transport upgrades to
                // reconnect without the user appearing offline.
                if (pendingOfflineTimers.has(socket.userId)) {
                    clearTimeout(pendingOfflineTimers.get(socket.userId));
                    pendingOfflineTimers.delete(socket.userId);
                }
                const timer = setTimeout(async () => {
                    try {
                        // Verify if the user has any remaining active socket sessions
                        const stillOnline = userSockets.has(socket.userId) && userSockets.get(socket.userId).size > 0;

                        if (!stillOnline) {
                            await User.setOnlineStatus(socket.userId, false);
                            await broadcastOnlineStatus(socket, false);
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

// Helper: Join user's room channels (Sparkle Rooms architecture)
const joinUserRoomChannels = async (socket) => {
    try {
        const rooms = await Room.getUserRooms(socket.userId);
        if (!Array.isArray(rooms)) return;
        for (const r of rooms) {
            socket.join(`room:${r.room_id}`);
            const channels = await RoomChannel.listByRoom(r.room_id);
            if (Array.isArray(channels)) {
                for (const ch of channels) {
                    socket.join(`room_channel:${ch.channel_id}`);
                }
            }
        }
    } catch (error) {
        if (error?.code !== 'ER_NO_SUCH_TABLE') {
            logger.warn('Join room channels notice:', error.message || error);
        }
    }
};

// Helper: Broadcast aggregated group presence
// Uses only in-memory Socket.IO room state — NO database queries.
// Presence is maintained in Redis/memory, not MySQL.
const broadcastGroupPresence = (io, socket) => {
    try {
        // Iterate over all rooms this socket is already in and emit group:presence:update
        // for any chat: rooms (joined during joinUserChatRooms above).
        for (const room of socket.rooms) {
            if (!room.startsWith('chat:')) continue;
            const chatId = room.replace('chat:', '');
            const roomSockets = io.sockets.adapter.rooms.get(room);
            if (!roomSockets) continue;

            const userIds = new Set();
            for (const socketId of roomSockets) {
                const s = io.sockets.sockets.get(socketId);
                if (s && s.userId) userIds.add(s.userId);
            }
            io.to(room).emit('group:presence:update', { chatId, onlineCount: userIds.size });
        }
    } catch (e) {
        logger.error('Broadcast group presence error:', e);
    }
};

// Helper: Broadcast online status to followers, group peers, and direct chat partners.
// Privacy-enforced: viewers who are not allowed to see the subject's presence
// (activity_status_enabled = 0 or last_seen_privacy = no_one/followers) never
// receive real status; when the subject hides presence entirely, a `hidden`
// marker is emitted so clients can clear stale online indicators without
// learning the real connection state.
const broadcastOnlineStatus = async (socket, isOnline) => {
    try {
        const subjectId = socket.userId;
        const [followers] = await pool.query(
            'SELECT follower_id FROM follows WHERE following_id = ?',
            [subjectId]
        );

        // Get Group Peers
        const groupPeers = await GroupMember.getGroupPeers(subjectId);

        // Direct Chat Partners (personal_chats)
        const [chatPartners] = await pool.query(
            `SELECT IF(participant1_id = ?, participant2_id, participant1_id) AS partner_id
             FROM personal_chats
             WHERE participant1_id = ? OR participant2_id = ?`,
            [subjectId, subjectId, subjectId]
        );

        // Merge unique IDs
        const targetIds = new Set([
            ...followers.map(f => f.follower_id),
            ...groupPeers,
            ...chatPartners.map(p => p.partner_id)
        ]);
        targetIds.delete(subjectId);
        const candidates = Array.from(targetIds);
        if (candidates.length === 0 || !io) return;

        const allowed = await filterPresenceViewers(subjectId, candidates);
        const username = socket.user ? socket.user.username : undefined;

        const statusData = allowed.length === 0
            // Hidden: clear stale indicators everywhere, leak nothing.
            ? { userId: subjectId, username, isOnline: false, hidden: true, lastSeen: null }
            : { userId: subjectId, username, isOnline, hidden: false, lastSeen: isOnline ? null : new Date().toISOString() };

        const emitTargets = allowed.length === 0 ? candidates : allowed;
        const rooms = emitTargets.map(id => `user:${id}`);
        if (rooms.length > 0) {
            io.to(rooms).emit('user-status', statusData);
        }
    } catch (error) {
        logger.error('Broadcast status error:', error);
    }
};

/**
 * Re-evaluates and re-broadcasts a user's presence after their Active Status
 * privacy settings change, using the authoritative session state.
 */
const refreshPresenceBroadcast = async (userId, username) => {
    try {
        if (!userId) return;
        const isOnline = userSockets.has(Number(userId)) && userSockets.get(Number(userId)).size > 0;
        await broadcastOnlineStatus({ userId: Number(userId), user: username ? { username } : undefined }, isOnline);
    } catch (e) {
        logger.error('refreshPresenceBroadcast error:', e);
    }
};

// Helper: Queue push notification for offline users
const queuePushNotification = async (userId, notification) => {
    try {
        const notificationId = crypto.randomUUID();
        await pool.query(
            `INSERT INTO push_notifications (id, user_id, type, title, body, data, sent_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [notificationId, userId, notification.type, notification.title,
                notification.body, JSON.stringify(notification.data)]
        );
    } catch (error) {
        const errorMsg = error?.message || String(error).slice(0, 200);
        logger.warn('Push notification table error (using standard notifications): ' + errorMsg);
        try {
            if (notification.type === 'message') {
                return;
            }
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

const emitSecurityAlert = (userId, alertData) => {
    try {
        if (io) {
            io.to(`user:${userId}`).emit('security:alert', alertData);
            logger.info(`🚨 Security alert broadcasted to user:${userId} event=${alertData.event_type || 'alert'}`);
        }
    } catch (error) {
        logger.error('emitSecurityAlert error:', error);
    }
};

const notifyOrderUpdate = (orderData) => {
    try {
        if (!io) return;
        const { order_id, buyer_id, seller_id, status } = orderData;
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

async function ensureSparklyBotUserExists() {
    try {
        await pool.query(`
            INSERT INTO users (
                user_id, name, username, email, password_hash, user_type, account_type, account_status, is_verified, onboarding_step, bio
            ) VALUES (
                'sparkly_bot', 'Sparkly AI Assistant', 'sparkly_bot', 'sparkly_bot@sparkle.app', 'NO_LOGIN', 'system', 'system', 'active', 1, 6, 'Official Sparkly AI Assistant on Sparkle'
            ) ON DUPLICATE KEY UPDATE name = VALUES(name)
        `);
    } catch (e) {
        // Suppress duplicate/concurrent insertion warning
        logger.debug('sparkly bot upsert (expected on duplicate)', e?.message || e);
    }
}

/**
 * Asynchronously processes @Sparkle mentions in normal chat rooms.
 * Streams real-time tokens into a single growing bot response bubble.
 */
async function handleSparklyMentionInChat({ io, chatId, senderUserId, senderName, userMessage, replyToMessageId }) {
    await ensureSparklyBotUserExists();
    const cleanPrompt = userMessage.replace(/@sparkl(?:y|e)\b/gi, '').trim() || "Hi Sparkly, how can you help me today?";
    const botMessageId = 'msg_sparkly_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const SparklyService = require('../services/sparkly.service');

    // Atomic server_sequence increment for chat order
    let serverSequence = 1;
    try {
        await pool.query(`
            INSERT INTO chat_sequences (chat_id, last_sequence) VALUES (?, 1)
            ON DUPLICATE KEY UPDATE last_sequence = last_sequence + 1
        `, [chatId]);
        const [seqRow] = await pool.query('SELECT last_sequence FROM chat_sequences WHERE chat_id = ?', [chatId]);
        serverSequence = seqRow[0]?.last_sequence || 1;
    } catch (seqErr) {
        logger.warn('[SparklyMention] Sequence increment fallback:', seqErr.message);
    }

    // Determine personal vs group chat & recipient
    let personalChatId = null;
    let groupChatId = null;
    let recipientId = null;
    try {
        const [personalRows] = await pool.query(
            'SELECT chat_id, participant1_id, participant2_id FROM personal_chats WHERE chat_id = ?',
            [chatId]
        );
        if (personalRows && personalRows.length > 0) {
            personalChatId = chatId;
            const p = personalRows[0];
            recipientId = (p.participant1_id === senderUserId) ? p.participant2_id : p.participant1_id;
        } else {
            groupChatId = chatId;
        }
    } catch (chatLookupErr) {
        personalChatId = chatId;
    }

    // Lookup reply context if message replies to another
    let replyContent = null;
    let replyType = null;
    let replySenderName = null;
    if (replyToMessageId) {
        try {
            const [replyRows] = await pool.query(`
                SELECT rm.content, rm.type, ru.name as sender_name, ru.username as sender_username
                FROM messages rm
                LEFT JOIN users ru ON rm.sender_id = ru.user_id
                WHERE rm.message_id = ? LIMIT 1
            `, [replyToMessageId]);
            if (replyRows && replyRows.length > 0) {
                replyContent = replyRows[0].content;
                replyType = replyRows[0].type;
                replySenderName = replyRows[0].sender_name || replyRows[0].sender_username || 'User';
            }
        } catch (rErr) {
            logger.warn('[SparklyMention] Reply lookup error:', rErr);
        }
    }

    const initialMetadata = JSON.stringify({ source: 'sparkly_bot', streaming: true });
    const initialSentAt = new Date().toISOString();

    // Persist placeholder in DB immediately so it exists for keyset pagination and replies
    try {
        await ensureSparklyBotUserExists();
        await pool.query(`
            INSERT INTO messages (
                message_id, client_message_id, chat_id, conversation_id, personal_chat_id, 
                sender_id, recipient_id, content, type, status, is_read, sent_at, context, metadata,
                server_sequence, reply_to_message_id, version
            ) VALUES (?, ?, ?, ?, ?, 'sparkly_bot', ?, '', 'text', 'sent', 0, NOW(), 'chat', ?, ?, ?, 1)
        `, [
            botMessageId,
            botMessageId,
            groupChatId,
            personalChatId,
            personalChatId,
            recipientId,
            initialMetadata,
            serverSequence,
            replyToMessageId || null
        ]);
    } catch (insertErr) {
        logger.error('[SparklyMention] Initial placeholder insert error:', insertErr);
    }

    const initialBotMessage = {
        id: botMessageId,
        message_id: botMessageId,
        chatId: chatId,
        chat_id: groupChatId,
        conversation_id: personalChatId,
        personal_chat_id: personalChatId,
        sender_id: 'sparkly_bot',
        senderId: 'sparkly_bot',
        recipient_id: recipientId,
        sender_name: 'Sparkly AI',
        sender_username: 'sparkly',
        sender_avatar: '/assets/system/sparkle-logo.svg',
        content: '',
        type: 'text',
        sent_at: initialSentAt,
        server_sequence: serverSequence,
        reply_to_message_id: replyToMessageId || null,
        reply_content: replyContent,
        reply_type: replyType,
        reply_sender_name: replySenderName,
        is_sparkly_bot: true,
        metadata: initialMetadata
    };

    io.to(`chat:${chatId}`).emit('new-message', initialBotMessage);

    let accumulatedContent = '';
    let cards = [];

    // Resolve a valid sparkly_conversations.id for this chat session.
    // chatId is a messages.chat_id UUID and does NOT exist in sparkly_conversations,
    // so passing it directly causes ER_NO_REFERENCED_ROW_2 FK violations.
    let sparklyConversationId = null;
    try {
        const SparklyModel = require('../models/sparkly.model');
        sparklyConversationId = await SparklyModel.getOrCreateConversationForChat(senderUserId, chatId);
    } catch (convErr) {
        logger.warn('[SparklyMention] Could not resolve sparkly conversation id, memory save will be skipped:', convErr.message);
        sparklyConversationId = null;
    }

    try {
        await SparklyService.processMessageStream({
            userId: senderUserId,
            userMessage: cleanPrompt,
            conversationId: sparklyConversationId,
            replyToMessageId,
            persona: 'friendly',
            responseStyle: 'conversational',
            onInit: () => {},
            onChunk: (textChunk) => {
                accumulatedContent += textChunk;
                io.to(`chat:${chatId}`).emit('sparkly-stream-chunk', {
                    chatId,
                    messageId: botMessageId,
                    text: textChunk,
                    fullContent: accumulatedContent
                });
            },
            onCards: (receivedCards) => {
                cards = receivedCards;
                io.to(`chat:${chatId}`).emit('sparkly-stream-cards', {
                    chatId,
                    messageId: botMessageId,
                    cards: receivedCards
                });
            },
            onDone: async (finalData) => {
                const finalContent = finalData.answer || accumulatedContent || "I'm here to help!";
                const finalCards = finalData.structuredCards || cards || [];
                const finalMetadata = JSON.stringify({ source: 'sparkly_bot', cards: finalCards });

                try {
                    await pool.query(`
                        UPDATE messages 
                        SET content = ?, metadata = ?
                        WHERE message_id = ?
                    `, [finalContent, finalMetadata, botMessageId]);
                } catch (dbErr) {
                    logger.error('[SparklyMention] DB update error:', dbErr);
                }

                if (personalChatId) {
                    await pool.query('UPDATE personal_chats SET last_message_time = NOW() WHERE chat_id = ?', [personalChatId]).catch(() => {});
                } else if (groupChatId) {
                    await pool.query('UPDATE group_chats SET last_message_at = NOW() WHERE chat_id = ?', [groupChatId]).catch(() => {});
                }

                io.to(`chat:${chatId}`).emit('sparkly-stream-complete', {
                    chatId,
                    messageId: botMessageId,
                    finalMessage: {
                        ...initialBotMessage,
                        content: finalContent,
                        structured_data: { cards: finalCards },
                        metadata: finalMetadata
                    }
                });
                io.to(`chat:${chatId}`).emit('chat-updated', { chatId });
            }
        });
    } catch (err) {
        logger.error('[SparklyMention] AI execution failed:', err);
        const errorFallback = "Sparkly couldn't generate a response right now. Please try again in a moment.";
        const fallbackMeta = JSON.stringify({ source: 'sparkly_bot', error: true });
        try {
            await pool.query(`
                UPDATE messages 
                SET content = ?, metadata = ?
                WHERE message_id = ?
            `, [errorFallback, fallbackMeta, botMessageId]);
        } catch (dbErr) {
            logger.error('[SparklyMention] Fallback DB update error:', dbErr);
        }

        io.to(`chat:${chatId}`).emit('sparkly-stream-complete', {
            chatId,
            messageId: botMessageId,
            finalMessage: {
                ...initialBotMessage,
                content: errorFallback,
                metadata: fallbackMeta
            }
        });
        io.to(`chat:${chatId}`).emit('chat-updated', { chatId });
    }
}

const disconnectUserSockets = (userId, reason = 'account_restricted') => {
    try {
        if (!userId) return;
        const sockets = userSockets.get(userId);
        if (sockets && sockets.size > 0) {
            for (const socket of Array.from(sockets)) {
                socket.emit('account_status_changed', { status: reason });
                socket.disconnect(true);
            }
            userSockets.delete(userId);
            logger.info(`🔌 Force-disconnected ${sockets.size} socket(s) for user ${userId} (reason: ${reason})`);
        }
    } catch (e) {
        logger.error(`Error disconnecting sockets for user ${userId}:`, e);
    }
};

module.exports = { 
    initializeSocket, 
    getIO, 
    emitNotification, 
    emitSecurityAlert, 
    notifyOrderUpdate, 
    emitMarketplaceMessage, 
    handleSparklyMentionInChat,
    disconnectUserSockets,
    refreshPresenceBroadcast
};
