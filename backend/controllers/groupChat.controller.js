const GroupChat = require('../models/GroupChat');
const GroupMember = require('../models/GroupMember');
const User = require('../models/User');
const Message = require('../models/Message');
const { getIO } = require('../socket');

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

            // Parse member_ids if it's a string (from FormData)
            let actualMemberIds = member_ids;
            if (typeof member_ids === 'string') {
                try {
                    actualMemberIds = JSON.parse(member_ids);
                } catch (e) {
                    actualMemberIds = [member_ids];
                }
            }

            // Create Group
            const chatId = await GroupChat.create({
                creatorId,
                name: name || 'Group Chat',
                photoUrl: finalPhotoUrl,
                description: req.body.description || null,
                settings: settings || { 
                    allowMedia: true, 
                    allowVoice: true, 
                    allowVideo: true, 
                    allowReactions: true,
                    onlyAdminsSend: req.body.onlyAdminsSend === 'true' || req.body.onlyAdminsSend === true,
                    onlyAdminsEdit: req.body.onlyAdminsEdit === 'true' || req.body.onlyAdminsEdit === true
                }
            });

            // Add Creator
            await GroupMember.add({ chatId, userId: creatorId, role: 'creator', status: 'active' });

            // Add Members
            if (actualMemberIds && Array.isArray(actualMemberIds)) {
                await GroupMember.addMany(actualMemberIds.map(uid => ({
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

            // --- Real-time: Notify all members to refresh their inbox ---
            try {
                const io = getIO();
                // We emit to all members including the creator
                const allUids = [creatorId, ...actualMemberIds];
                allUids.forEach(uid => {
                    io.to(`user:${uid}`).emit('new_group_created', { chatId });
                });
            } catch (ioErr) {
                console.error('Socket notification error:', ioErr);
            }

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
            if (!user_ids || !Array.isArray(user_ids)) {
                return res.status(400).json({ status: 'error', error: 'user_ids is required and must be an array' });
            }
            // Filter out existing members
            const existingMembers = await GroupMember.getMembers(chatId);
            const existingIds = new Set(existingMembers.map(m => m.user_id));
            const newUids = user_ids.filter(uid => !existingIds.has(uid));

            if (newUids.length === 0) {
                return res.json({ status: 'success', message: 'No new members to add' });
            }

            await GroupMember.addMany(newUids.map(uid => ({
                chatId, userId: uid, role: 'member', status: 'active'
            })));

            // Send system message
            for (const uid of newUids) {
                const user = await User.findById(uid);
                await Message.sendMessage({
                    chatId,
                    senderId: req.user.user_id || req.user.userId,
                    content: `added ${user ? user.username : 'a member'}`,
                    type: 'system'
                });
            }

            // --- Real-time: Notify added members ---
            try {
                const io = getIO();
                user_ids.forEach(uid => {
                    io.to(`user:${uid}`).emit('new_group_created', { chatId });
                });
                // Notify existing group that someone joined? (Optional system message would be better)
            } catch (ioErr) { }

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
                updates.photo_url = req.file.path;
            }

            // Verify admin status (middleware could do this, but simple check here)
            // For now assuming route protection or checking member status
            const member = await GroupMember.find(chatId, req.user.user_id || req.user.userId);
            if (!member || member.role !== 'admin' && member.role !== 'creator') {
                return res.status(403).json({ status: 'error', error: 'Only admins can update group settings' });
            }

            if (req.body.onlyAdminsSend !== undefined) {
                updates.only_admins_send = req.body.onlyAdminsSend === 'true' || req.body.onlyAdminsSend === true ? 1 : 0;
                delete updates.onlyAdminsSend;
            }
            if (req.body.onlyAdminsEdit !== undefined) {
                updates.only_admins_edit = req.body.onlyAdminsEdit === 'true' || req.body.onlyAdminsEdit === true ? 1 : 0;
                delete updates.onlyAdminsEdit;
            }

            await GroupChat.update(chatId, updates);
            res.json({ status: 'success', message: 'Group updated' });
        } catch (error) {
            console.error('Update Group Error:', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }
    async leaveGroupChat(req, res) {
        try {
            const { chatId } = req.params;
            const userId = req.user.user_id || req.user.userId;

            // Update membership status to 'left'
            await GroupMember.updateStatus(chatId, userId, 'left');

            // Send system message
            await Message.sendMessage({
                chatId,
                senderId: userId,
                content: 'left the group',
                type: 'system'
            });

            res.json({ status: 'success', message: 'Left group chat' });
        } catch (error) {
            console.error('Leave Group Chat Error:', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async sendGroupMessage(req, res) {
        try {
            const { chatId } = req.params;
            const { content, media_url, type } = req.body;
            const userId = req.user.user_id || req.user.userId;

            if (!content && !media_url) {
                return res.status(400).json({ status: 'error', error: 'Content or media is required' });
            }

            const messageId = await Message.sendMessage({
                chatId,
                senderId: userId,
                content: content || '',
                type: type || 'text',
                mediaUrl: media_url || null
            });

            // Update last_message_at on the group chat
            await GroupChat.updateLastMessage(chatId);

            res.status(201).json({ status: 'success', data: { messageId, chatId } });
        } catch (error) {
            console.error('Send Group Message Error:', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async removeMember(req, res) {
        try {
            const { chatId, userId } = req.params;
            const currentUserId = req.user.user_id || req.user.userId;

            // Check if current user is admin
            const isAdmin = await GroupMember.isAdmin(chatId, currentUserId);
            if (!isAdmin) {
                return res.status(403).json({ status: 'error', error: 'Only admins can remove members' });
            }

            // Update membership status
            await GroupMember.updateStatus(chatId, userId, 'removed');

            // Fetch target user details
            const targetUser = await User.findById(userId);
            const username = targetUser ? targetUser.username : 'a member';

            // Send system message
            await Message.sendMessage({
                chatId,
                senderId: currentUserId,
                content: `REMOVED_FROM_GROUP:${userId}:${username}`,
                type: 'system'
            });

            res.json({ status: 'success', message: 'Member removed' });
        } catch (error) {
            console.error('Remove member error:', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }

    async updateMemberRole(req, res) {
        try {
            const { chatId, userId } = req.params;
            const { role } = req.body; // 'admin' or 'member'
            const currentUserId = req.user.user_id || req.user.userId;

            if (!['admin', 'member'].includes(role)) {
                return res.status(400).json({ status: 'error', error: 'Invalid role' });
            }

            // Check if current user is admin/creator
            const isAdmin = await GroupMember.isAdmin(chatId, currentUserId);
            if (!isAdmin) {
                return res.status(403).json({ status: 'error', error: 'Only admins can change roles' });
            }

            // Perform update
            await GroupMember.updateRole(chatId, userId, role);

            // Fetch target user details
            const targetUser = await User.findById(userId);
            const username = targetUser ? targetUser.username : 'a member';

            // Notify group with structured message
            await Message.sendMessage({
                chatId,
                senderId: currentUserId,
                content: `${role === 'admin' ? 'PROMOTED_TO_ADMIN' : 'DEMOTED_TO_MEMBER'}:${userId}:${username}`,
                type: 'system'
            });

            res.json({ status: 'success', message: `Member ${role === 'admin' ? 'promoted' : 'demoted'}` });
        } catch (error) {
            console.error('Update member role error:', error);
            res.status(500).json({ status: 'error', error: error.message });
        }
    }
}

module.exports = new GroupChatController();
