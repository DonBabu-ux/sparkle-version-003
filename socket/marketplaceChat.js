const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const logger = require('../utils/logger');
const User = require('../models/User');
const NotificationService = require('../services/notification.service');

const onlineUsers = new Map();

module.exports = (io) => {
    const marketplaceNs = io.of('/marketplace');

    // Authentication middleware specific to marketplace NS
    marketplaceNs.use(async (socket, next) => {
        try {
            // Re-use logic from index.js but here we just need the userId
            // Assuming socket.handshake.auth.userId is passed from the client,
            // or we decode from token
            let userId = socket.handshake.auth.userId;

            if (!userId && socket.handshake.auth.token) {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET);
                userId = decoded.userId || decoded.user_id;
            }

            if (!userId) {
                return next(new Error('Authentication required'));
            }

            socket.userId = userId;
            next();
        } catch (error) {
            logger.error('Marketplace Socket Auth Error:', error.message);
            next(new Error('Invalid token'));
        }
    });

    marketplaceNs.on('connection', (socket) => {
        const userId = socket.userId;
        logger.info(`🛒 User connected to marketplace: ${userId}`);

        // 1. Presence: Mark Online
        onlineUsers.set(userId, socket.id);
        
        const checkOnline = async () => {
            const [settings] = await pool.query(`SELECT show_online_status FROM marketplace_message_settings WHERE user_id = ?`, [userId]);
            const enabled = settings.length === 0 || settings[0].show_online_status;
            if (enabled) {
                marketplaceNs.emit('user_status_change', { userId, status: 'online' });
            }
        };
        checkOnline();

        // 2. Room Management
        socket.on('join_conversation', (conversationId) => {
            socket.join(`conversation:${conversationId}`);
            logger.info(`User ${userId} joined marketplace conversation: ${conversationId}`);
        });

        socket.on('leave_conversation', (conversationId) => {
            socket.leave(`conversation:${conversationId}`);
        });

        // 3. Messaging
        socket.on('send_message', async (data, callback) => {
            const { conversationId, text, type = 'text', mediaUrl, replyToId } = data;
            const messageId = uuidv4();

            try {
                // A. Save to Database
                await pool.query(
                    `INSERT INTO marketplace_messages (id, conversation_id, sender_id, message_text, message_type, media_url, reply_to_id) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [messageId, conversationId, userId, text, type, mediaUrl || null, replyToId || null]
                );
                
                // Initialize status
                await pool.query(`INSERT INTO marketplace_message_status (message_id) VALUES (?)`, [messageId]);

                // Update Conversation Activity
                const lastMessageText = text || (type === 'image' ? '📷 Sent an image' : type === 'video' ? '🎥 Sent a video' : 'Sent media');
                await pool.query(
                    `UPDATE marketplace_conversations SET last_message = ?, last_activity_at = NOW(), reminder_sent = FALSE WHERE id = ?`,
                    [lastMessageText, conversationId]
                );

                const messagePayload = {
                    id: messageId,
                    conversation_id: conversationId,
                    sender_id: userId,
                    message_text: text,
                    message_type: type,
                    media_url: mediaUrl,
                    reply_to_id: replyToId,
                    created_at: new Date()
                };

                // B. Broadcast to Room
                socket.to(`conversation:${conversationId}`).emit('receive_message', messagePayload);
                
                const [conv] = await pool.query(`SELECT buyer_id, seller_id, is_muted FROM marketplace_conversations WHERE id = ?`, [conversationId]);

                // C. Auto-Reply Logic
                if (conv.length > 0) {
                    const opponentId = conv[0].buyer_id === userId ? conv[0].seller_id : conv[0].buyer_id;
                    if (!onlineUsers.has(opponentId)) {
                        const [oppSettings] = await pool.query(
                            `SELECT auto_reply_enabled, auto_reply_text FROM marketplace_message_settings WHERE user_id = ?`,
                            [opponentId]
                        );

                        if (oppSettings.length > 0 && oppSettings[0].auto_reply_enabled && oppSettings[0].auto_reply_text) {
                            const autoReplyId = uuidv4();
                            const autoText = oppSettings[0].auto_reply_text;

                            // Save auto-reply to DB
                            await pool.query(
                                `INSERT INTO marketplace_messages (id, conversation_id, sender_id, message_text, message_type) 
                                 VALUES (?, ?, ?, ?, 'text')`,
                                [autoReplyId, conversationId, opponentId, autoText]
                            );
                            
                            await pool.query(`INSERT INTO marketplace_message_status (message_id) VALUES (?)`, [autoReplyId]);

                            const autoPayload = {
                                id: autoReplyId,
                                conversation_id: conversationId,
                                sender_id: opponentId,
                                message_text: autoText,
                                message_type: 'text',
                                created_at: new Date(),
                                is_auto_reply: true
                            };

                            // Emit back to the original sender
                            socket.emit('receive_message', autoPayload);
                        }
                    }
                }

                // D. Offline Push Notifications Fallback
                if (conv.length > 0) {
                    const opponentId = conv[0].buyer_id === userId ? conv[0].seller_id : conv[0].buyer_id;
                    if (!onlineUsers.has(opponentId) && !conv[0].is_muted) {
                        try {
                            const [sender] = await pool.query(`SELECT name FROM users WHERE user_id = ?`, [userId]);
                            const senderName = sender[0]?.name || 'Someone';
                            
                            await NotificationService.send({
                                type: 'marketplace_contact',
                                priority: 'HIGH',
                                recipients: [opponentId],
                                data: {
                                    title: 'New Marketplace Message',
                                    content: `${senderName}: ${type === 'text' ? text : 'sent a ' + type}`,
                                    url: `/marketplace/messages/${conversationId}`,
                                    conversationId
                                }
                            });
                        } catch (notifErr) {
                            logger.error("Failed to enqueue marketplace notification:", notifErr);
                        }
                    }
                }

                // Return success to sender
                if (typeof callback === 'function') callback({ status: 'success', message: messagePayload });

            } catch (err) {
                logger.error("Marketplace message send error:", err);
                if (typeof callback === 'function') callback({ status: 'error', error: err.message });
            }
        });

        // 4. Edit Message
        socket.on('edit_message', async (data, callback) => {
            const { messageId, conversationId, newText } = data;
            try {
                // Verify ownership is ideally done via SQL, or we assume client auth is enough for socket scope
                await pool.query(
                    `UPDATE marketplace_messages SET message_text = ?, is_edited = TRUE WHERE id = ? AND sender_id = ?`,
                    [newText, messageId, userId]
                );
                
                socket.to(`conversation:${conversationId}`).emit('message_edited', { messageId, newText, is_edited: true });
                if (typeof callback === 'function') callback({ status: 'success' });
            } catch (err) {
                logger.error("Marketplace message edit error:", err);
                if (typeof callback === 'function') callback({ status: 'error', error: err.message });
            }
        });

        // 5. Delete Message
        socket.on('delete_message', async (data, callback) => {
            const { messageId, conversationId } = data;
            try {
                // Delete from DB (or soft delete)
                await pool.query(`DELETE FROM marketplace_messages WHERE id = ? AND sender_id = ?`, [messageId, userId]);
                // Status is cascaded or explicitly deleted
                await pool.query(`DELETE FROM marketplace_message_status WHERE message_id = ?`, [messageId]);
                
                socket.to(`conversation:${conversationId}`).emit('message_deleted', { messageId });
                if (typeof callback === 'function') callback({ status: 'success' });
            } catch (err) {
                logger.error("Marketplace message delete error:", err);
                if (typeof callback === 'function') callback({ status: 'error', error: err.message });
            }
        });

        // 6. React to Message
        socket.on('react_message', async (data, callback) => {
            const { messageId, conversationId, reaction } = data;
            try {
                // We broadcast the reaction to the room
                socket.to(`conversation:${conversationId}`).emit('message_reaction', { messageId, userId, reaction });
                if (typeof callback === 'function') callback({ status: 'success' });
            } catch (err) {
                logger.error("Marketplace message react error:", err);
            }
        });

        // 6. Read Receipts
        socket.on('mark_read', async ({ messageId, conversationId }) => {
            try {
                // Check if user has read receipts enabled
                const [settings] = await pool.query(`SELECT read_receipts FROM marketplace_message_settings WHERE user_id = ?`, [userId]);
                const enabled = settings.length === 0 || settings[0].read_receipts;

                if (enabled) {
                    await pool.query(
                        `UPDATE marketplace_message_status SET read_at = NOW() WHERE message_id = ? AND read_at IS NULL`,
                        [messageId]
                    );
                    socket.to(`conversation:${conversationId}`).emit('message_read', { messageId, readerId: userId });
                }
            } catch (error) {
                logger.error("Marketplace message read error:", error);
            }
        });

        // 5. Typing Indicators
        socket.on('typing_start', async ({ conversationId }) => {
            const [settings] = await pool.query(`SELECT typing_indicators FROM marketplace_message_settings WHERE user_id = ?`, [userId]);
            const enabled = settings.length === 0 || settings[0].typing_indicators;
            if (enabled) {
                socket.to(`conversation:${conversationId}`).emit('user_typing', { userId, isTyping: true });
            }
        });

        socket.on('typing_stop', async ({ conversationId }) => {
            const [settings] = await pool.query(`SELECT typing_indicators FROM marketplace_message_settings WHERE user_id = ?`, [userId]);
            const enabled = settings.length === 0 || settings[0].typing_indicators;
            if (enabled) {
                socket.to(`conversation:${conversationId}`).emit('user_typing', { userId, isTyping: false });
            }
        });

        // 6. Presence: Disconnect
        socket.on('disconnect', async () => {
            // Buffer timeout to prevent flickering on quick reloads
            setTimeout(async () => {
                const currentSocketId = onlineUsers.get(userId);
                if (currentSocketId === socket.id) {
                    onlineUsers.delete(userId);

                    // Check if user has online status enabled
                    const [settings] = await pool.query(`SELECT show_online_status FROM marketplace_message_settings WHERE user_id = ?`, [userId]);
                    const enabled = settings.length === 0 || settings[0].show_online_status;
                    
                    if (enabled) {
                        marketplaceNs.emit('user_status_change', { userId, status: 'offline', last_seen: new Date() });
                    }
                }
            }, 15000); 
        });
    });
};
