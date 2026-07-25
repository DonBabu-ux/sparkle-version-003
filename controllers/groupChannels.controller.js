// controllers/groupChannels.controller.js
// Handles HTTP CRUD requests for group chat channels.

const GroupChannel = require('../models/GroupChannel');
const GroupMember = require('../models/GroupMember');
const GroupChat = require('../models/GroupChat');
const { getIO } = require('../socket');

// Helper to check user permissions inside a group chat
async function checkManagePermission(chatId, userId) {
  const chat = await GroupChat.findById(chatId);
  if (!chat) {
    return { allowed: false, status: 404, message: 'Group chat not found' };
  }

  const member = await GroupMember.find(chatId, userId);
  if (!member || member.status === 'left') {
    return { allowed: false, status: 403, message: 'You are not a member of this group' };
  }

  // If only admins/creator can edit/manage settings, verify role
  if (chat.only_admins_edit) {
    const isAuthorized = member.role === 'creator' || member.role === 'admin' || chat.creator_id === userId;
    if (!isAuthorized) {
      return { allowed: false, status: 403, message: 'Only admins or the creator can manage channels' };
    }
  }

  return { allowed: true, member, chat };
}

module.exports = {
  // GET /api/groupChat/:chatId/channels
  async listChannels(req, res) {
    try {
      const { chatId } = req.params;
      const userId = req.user.user_id || req.user.userId;

      // Verify membership
      const isPart = await GroupMember.isParticipant(chatId, userId);
      if (!isPart) {
        return res.status(403).json({ status: 'error', message: 'You are not a member of this group' });
      }

      const channels = await GroupChannel.listByChatId(chatId);
      res.json({ status: 'success', data: channels });
    } catch (err) {
      console.error('List group channels error:', err);
      res.status(500).json({ status: 'error', error: err.message });
    }
  },

  // POST /api/groupChat/:chatId/channels
  async createChannel(req, res) {
    try {
      const { chatId } = req.params;
      const userId = req.user.user_id || req.user.userId;
      const { name, type, icon, position, isDefault, isReadOnly } = req.body;

      if (!name) {
        return res.status(400).json({ status: 'error', message: 'Channel name is required' });
      }

      const check = await checkManagePermission(chatId, userId);
      if (!check.allowed) {
        return res.status(check.status).json({ status: 'error', message: check.message });
      }

      const channelId = await GroupChannel.create({
        chatId,
        name,
        type: type || 'TEXT',
        icon: icon || '💬',
        position: position || 0,
        createdBy: userId,
        isDefault: isDefault !== false,
        isReadOnly: !!isReadOnly,
      });

      const newChannel = await GroupChannel.findById(channelId);

      // Notify members in real-time
      try {
        const io = getIO();
        io.to(`group:${chatId}`).emit('channel_created', { chatId, channel: newChannel });
      } catch (ioErr) {
        console.error('Real-time socket notify error:', ioErr);
      }

      res.status(201).json({ status: 'success', data: newChannel });
    } catch (err) {
      console.error('Create group channel error:', err);
      res.status(500).json({ status: 'error', error: err.message });
    }
  },

  // PATCH /api/groupChat/:chatId/channels/:id
  async updateChannel(req, res) {
    try {
      const { chatId, id: channelId } = req.params;
      const userId = req.user.user_id || req.user.userId;
      const updates = req.body;

      const check = await checkManagePermission(chatId, userId);
      if (!check.allowed) {
        return res.status(check.status).json({ status: 'error', message: check.message });
      }

      const channel = await GroupChannel.findById(channelId);
      if (!channel || channel.chat_id !== chatId) {
        return res.status(404).json({ status: 'error', message: 'Channel not found in this group' });
      }

      await GroupChannel.update(channelId, updates);
      const updatedChannel = await GroupChannel.findById(channelId);

      // Notify members in real-time
      try {
        const io = getIO();
        io.to(`group:${chatId}`).emit('channel_updated', { chatId, channel: updatedChannel });
      } catch (ioErr) {
        console.error('Real-time socket notify error:', ioErr);
      }

      res.json({ status: 'success', data: updatedChannel });
    } catch (err) {
      console.error('Update group channel error:', err);
      res.status(500).json({ status: 'error', error: err.message });
    }
  },

  // DELETE /api/groupChat/:chatId/channels/:id
  async deleteChannel(req, res) {
    try {
      const { chatId, id: channelId } = req.params;
      const userId = req.user.user_id || req.user.userId;

      const check = await checkManagePermission(chatId, userId);
      if (!check.allowed) {
        return res.status(check.status).json({ status: 'error', message: check.message });
      }

      const channel = await GroupChannel.findById(channelId);
      if (!channel || channel.chat_id !== chatId) {
        return res.status(404).json({ status: 'error', message: 'Channel not found in this group' });
      }

      // If it's the last channel, prevent deletion or check if it's default
      if (channel.is_default) {
        // Find if there's any other channel
        const allChannels = await GroupChannel.listByChatId(chatId);
        if (allChannels.length <= 1) {
          return res.status(400).json({ status: 'error', message: 'Cannot delete the only channel in a group chat' });
        }
      }

      // Hard-delete or archive based on requirement; plan says delete (Cascade deletes messages)
      await GroupChannel.delete(channelId);

      // Notify members in real-time
      try {
        const io = getIO();
        io.to(`group:${chatId}`).emit('channel_deleted', { chatId, channelId });
      } catch (ioErr) {
        console.error('Real-time socket notify error:', ioErr);
      }

      res.json({ status: 'success', message: 'Channel deleted successfully' });
    } catch (err) {
      console.error('Delete group channel error:', err);
      res.status(500).json({ status: 'error', error: err.message });
    }
  },
};
