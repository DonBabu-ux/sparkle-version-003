const GroupChat = require('../models/GroupChat');
const GroupMember = require('../models/GroupMember');
const Message = require('../models/Message');

class GroupChatController {

    // === HTTP API Methods ===

    async createGroupChat(req, res) {
        try {
            const { name, member_ids, photo_url, settings } = req.body;
            const creatorId = req.user.user_id || req.user.userId;

            // Handle file upload
            let finalPhotoUrl = photo_url;
            if (req.file && req.file.path) {
                finalPhotoUrl = req.file.path;
            }

            // Create Group
            const chatId = await GroupChat.create({
                creatorId,
                name: name || 'Group Chat',
                photoUrl: finalPhotoUrl,
                settings
            });

            // Add Creator
            await GroupMember.add({ chatId, userId: creatorId, role: 'creator', status: 'active' });

            // Add Members
            if (member_ids && Array.isArray(member_ids)) {
                await GroupMember.addMany(member_ids.map(uid => ({
                    chatId, userId: uid, role: 'member', status: 'active'
                })));
            }

            // Initial System Message
            await Message.sendMessage({
                chatId,
                senderId: creatorId,
                content: 'created the group',
                type: 'system'
            });

            res.status(201).json({ status: 'success', data: { chatId } });

            // Notify via Socket
            if (req.io) {
                const members = [creatorId, ...(member_ids || [])];
                members.forEach(uid => {
                    req.io.to(`user:${uid}`).emit('new_group_chat', { chatId, name });
                });
            }

        } catch (error) {
            console.error('Create Chat Error:', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async getUserChats(req, res) {
        try {
            const userId = req.user.user_id || req.user.userId;
            const chats = await GroupChat.getUserChats(userId);
            res.json({ status: 'success', data: chats });
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async getMessages(req, res) {
        try {
            const { chatId } = req.params;
            const messages = await Message.getGroupMessages(chatId);
            res.json({ status: 'success', data: messages });
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async getChatDetails(req, res) {
        try {
            const { chatId } = req.params;
            const chat = await GroupChat.findById(chatId);
            const members = await GroupMember.getMembers(chatId);
            res.json({ status: 'success', data: { ...chat, members } });
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async addMembers(req, res) {
        try {
            const { chatId } = req.params;
            const { user_ids } = req.body;

            await GroupMember.addMany(user_ids.map(uid => ({
                chatId, userId: uid, role: 'member', status: 'active'
            })));

            res.json({ status: 'success', message: 'Members added' });
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async updateGroup(req, res) {
        try {
            const { chatId } = req.params;
            const updates = { ...req.body };
            delete updates.user_id; // prevent updating unexpected fields manually if passed

            if (req.file && req.file.path) {
                updates.photoUrl = req.file.path;
            }

            // Verify admin status (middleware could do this, but simple check here)
            // For now assuming route protection or checking member status
            const member = await GroupMember.getMember(chatId, req.user.user_id || req.user.userId);
            if (!member || member.role !== 'admin' && member.role !== 'creator') {
                return res.status(403).json({ status: 'error', error: 'Only admins can update group settings' });
            }

            await GroupChat.update(chatId, updates);
            res.json({ status: 'success', message: 'Group updated' });
        } catch (error) {
            console.error('Update Group Error:', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }


    // === WebSocket Logic ===

    setupChatWebSocket(io) {
        const chatNamespace = io.of('/chat'); // Or just use root io if preferred

        io.on('connection', (socket) => {
            console.log('User connected to socket:', socket.id);
            const userId = socket.handshake.query.userId;

            if (userId) {
                socket.join(`user:${userId}`);
                console.log(`User ${userId} joined room user:${userId}`);
            }

            socket.on('join_chat', (chatId) => {
                socket.join(`chat:${chatId}`);
                console.log(`Socket ${socket.id} joined chat:${chatId}`);
            });

            socket.on('send_group_message', async (data) => {
                try {
                    const { chatId, content, type, senderId } = data;

                    // Save to DB
                    const messageId = await Message.sendMessage({
                        chatId,
                        senderId, // In production verify this matches socket user
                        content,
                        type: type || 'text'
                    });

                    // Update Last Message
                    await GroupChat.updateLastMessage(chatId);

                    // Broadcast
                    io.to(`chat:${chatId}`).emit('new_message', {
                        message_id: messageId,
                        chat_id: chatId,
                        sender_id: senderId,
                        content,
                        type,
                        sent_at: new Date()
                    });

                } catch (err) {
                    console.error('Socket Message Error:', err);
                    socket.emit('error', { message: 'Failed to send message' });
                }
            });

            socket.on('disconnect', () => {
                // console.log('User disconnected');
            });
        });
    }
}

module.exports = new GroupChatController();
