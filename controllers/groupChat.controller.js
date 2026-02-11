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
}

module.exports = new GroupChatController();
