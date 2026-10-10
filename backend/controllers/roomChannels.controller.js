// controllers/roomChannels.controller.js
// Controller handling CRUD for Room Channels and channel messages.

const RoomChannel = require('../models/RoomChannel');
const ChannelMessage = require('../models/ChannelMessage');
const RoomMember = require('../models/RoomMember');
const Room = require('../models/Room');
const db = require('../config/database');
const { getIO } = require('../socket');

// Helper to check if a user is a member of a room
async function getRoomMembership(roomId, userId) {
  const [rows] = await db.query(
    'SELECT * FROM room_members WHERE room_id = ? AND user_id = ? LIMIT 1',
    [roomId, userId]
  );
  return rows[0] || null;
}

// Helper to check if user has permission to manage channels
async function checkManagePermission(roomId, userId) {
  const room = await Room.findById(roomId);
  if (!room) {
    return { allowed: false, status: 404, message: 'Room not found' };
  }

  const membership = await getRoomMembership(roomId, userId);
  if (!membership || membership.status === 'left' || membership.status === 'removed' || membership.status === 'banned') {
    return { allowed: false, status: 403, message: 'You are not a member of this room' };
  }

  const isAuthorized = ['owner', 'admin', 'dept_admin'].includes(membership.role) || room.creator_id === userId;
  if (!isAuthorized) {
    return { allowed: false, status: 403, message: 'Only room admins or owner can manage channels' };
  }

  return { allowed: true, membership, room };
}

module.exports = {
  // GET /api/rooms/:roomId/channels
  async listChannels(req, res) {
    try {
      const { roomId } = req.params;
      const userId = req.user.user_id || req.user.userId || req.user.id;

      // Verify membership
      const membership = await getRoomMembership(roomId, userId);
      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this room' });
      }

      const channels = await RoomChannel.listByRoom(roomId);
      res.json(channels);
    } catch (err) {
      console.error('List room channels error:', err);
      res.status(500).json({ error: 'Failed to list channels' });
    }
  },

  // POST /api/rooms/:roomId/channels
  async createChannel(req, res) {
    try {
      const { roomId } = req.params;
      const userId = req.user.user_id || req.user.userId || req.user.id;
      const { name, description, icon, type, position, isDefault, isReadOnly, isNsfw, slowModeSecs } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Channel name is required' });
      }

      const check = await checkManagePermission(roomId, userId);
      if (!check.allowed) {
        return res.status(check.status).json({ error: check.message });
      }

      const channelId = await RoomChannel.create({
        roomId,
        name,
        description,
        icon: icon || '💬',
        type: type || 'TEXT',
        position: position || 0,
        isDefault: !!isDefault,
        isReadOnly: !!isReadOnly,
        isArchived: false,
        isNsfw: !!isNsfw,
        slowModeSecs: slowModeSecs || 0,
        createdBy: userId
      });

      const newChannel = await RoomChannel.findById(channelId);

      // Socket broadcast to room members
      try {
        const io = getIO();
        io.to(`room:${roomId}`).emit('room_channel_created', { roomId, channel: newChannel });
      } catch (ioErr) {
        console.error('Real-time channel broadcast error:', ioErr);
      }

      res.status(201).json(newChannel);
    } catch (err) {
      console.error('Create room channel error:', err);
      res.status(500).json({ error: 'Failed to create channel' });
    }
  },

  // PATCH /api/rooms/:roomId/channels/:channelId
  async updateChannel(req, res) {
    try {
      const { roomId, channelId } = req.params;
      const userId = req.user.user_id || req.user.userId || req.user.id;
      const updates = req.body;

      const check = await checkManagePermission(roomId, userId);
      if (!check.allowed) {
        return res.status(check.status).json({ error: check.message });
      }

      const channel = await RoomChannel.findById(channelId);
      if (!channel || channel.room_id !== roomId) {
        return res.status(404).json({ error: 'Channel not found in this room' });
      }

      await RoomChannel.update(channelId, updates);
      const updatedChannel = await RoomChannel.findById(channelId);

      // Socket broadcast to room members
      try {
        const io = getIO();
        io.to(`room:${roomId}`).emit('room_channel_updated', { roomId, channel: updatedChannel });
      } catch (ioErr) {
        console.error('Real-time channel update broadcast error:', ioErr);
      }

      res.json(updatedChannel);
    } catch (err) {
      console.error('Update room channel error:', err);
      res.status(500).json({ error: 'Failed to update channel' });
    }
  },

  // DELETE /api/rooms/:roomId/channels/:channelId
  async deleteChannel(req, res) {
    try {
      const { roomId, channelId } = req.params;
      const userId = req.user.user_id || req.user.userId || req.user.id;

      const check = await checkManagePermission(roomId, userId);
      if (!check.allowed) {
        return res.status(check.status).json({ error: check.message });
      }

      const channel = await RoomChannel.findById(channelId);
      if (!channel || channel.room_id !== roomId) {
        return res.status(404).json({ error: 'Channel not found in this room' });
      }

      // Don't allow deleting the default channel if it's the last one
      if (channel.is_default) {
        const allChannels = await RoomChannel.listByRoom(roomId);
        if (allChannels.length <= 1) {
          return res.status(400).json({ error: 'Cannot delete the only channel in a room' });
        }
      }

      await RoomChannel.delete(channelId);

      // Socket broadcast to room members
      try {
        const io = getIO();
        io.to(`room:${roomId}`).emit('room_channel_deleted', { roomId, channelId });
      } catch (ioErr) {
        console.error('Real-time channel delete broadcast error:', ioErr);
      }

      res.json({ success: true, message: 'Channel deleted successfully' });
    } catch (err) {
      console.error('Delete room channel error:', err);
      res.status(500).json({ error: 'Failed to delete channel' });
    }
  },

  // GET /api/rooms/channels/:channelId/messages
  async getMessages(req, res) {
    try {
      const { channelId } = req.params;
      const userId = req.user.user_id || req.user.userId || req.user.id;
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

      const channel = await RoomChannel.findById(channelId);
      if (!channel) {
        return res.status(404).json({ error: 'Channel not found' });
      }

      // Check room membership
      const membership = await getRoomMembership(channel.room_id, userId);
      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of the room this channel belongs to' });
      }

      const messages = await ChannelMessage.getChannelMessages(channelId, limit, offset);
      
      // Fetch sender names & details to return rich data
      const enrichedMessages = await Promise.all(messages.map(async (msg) => {
        const [userRows] = await db.query(
          'SELECT name, username, avatar_url FROM users WHERE user_id = ?',
          [msg.sender_id]
        );
        const user = userRows[0] || {};
        return {
          ...msg,
          sender_name: user.name || 'User',
          sender_username: user.username || 'user',
          sender_avatar: user.avatar_url || null
        };
      }));

      res.json(enrichedMessages);
    } catch (err) {
      console.error('Get channel messages error:', err);
      res.status(500).json({ error: 'Failed to get messages' });
    }
  },

  // POST /api/rooms/channels/:channelId/messages
  async sendMessage(req, res) {
    try {
      const { channelId } = req.params;
      const userId = req.user.user_id || req.user.userId || req.user.id;
      const { content, type, mediaUrl, mediaType, replyToId } = req.body;

      if (!content && !mediaUrl) {
        return res.status(400).json({ error: 'Message content or media is required' });
      }

      const channel = await RoomChannel.findById(channelId);
      if (!channel) {
        return res.status(404).json({ error: 'Channel not found' });
      }

      // Check room membership
      const membership = await getRoomMembership(channel.room_id, userId);
      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this room' });
      }

      // Check if channel is read-only and user is not an admin/creator
      if (channel.is_read_only) {
        const room = await Room.findById(channel.room_id);
        const isAuthorized = ['owner', 'admin', 'dept_admin'].includes(membership.role) || (room && room.creator_id === userId);
        if (!isAuthorized) {
          return res.status(403).json({ error: 'This channel is read-only' });
        }
      }

      const messageId = await ChannelMessage.create({
        channelId,
        senderId: userId,
        type: type || 'text',
        content,
        mediaUrl,
        mediaType,
        replyToId
      });

      const [msgRows] = await db.query(
        `SELECT cm.*, u.name as sender_name, u.username as sender_username, u.avatar_url as sender_avatar 
         FROM channel_messages cm
         JOIN users u ON cm.sender_id = u.user_id
         WHERE cm.message_id = ?`,
        [messageId]
      );
      const savedMessage = msgRows[0];

      // Broadcast message in real-time
      try {
        const io = getIO();
        io.to(`room_channel:${channelId}`).emit('room_channel_message', savedMessage);
      } catch (ioErr) {
        console.error('Real-time channel message broadcast error:', ioErr);
      }

      res.status(201).json(savedMessage);
    } catch (err) {
      console.error('Send channel message error:', err);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }
};
