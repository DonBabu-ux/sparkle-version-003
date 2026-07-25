// controllers/rooms.controller.js
// Controller handling CRUD for Rooms and room membership.

const Room = require('../models/Room');
const RoomMember = require('../models/RoomMember');
const RoomChannel = require('../models/RoomChannel');

module.exports = {
  // POST /api/rooms - create a new room
  async createRoom(req, res) {
    try {
      const creatorId = req.user.id; // assume auth middleware sets req.user
      const { name, avatarUrl, bannerUrl, description, campus, category, isPublic, requiresApproval } = req.body;
      const { roomId, defaultChannelId } = await Room.create({
        creatorId,
        name,
        avatarUrl,
        bannerUrl,
        description,
        campus,
        category,
        isPublic,
        requiresApproval,
      });
      res.status(201).json({ roomId, defaultChannelId });
    } catch (err) {
      console.error('Error creating room:', err);
      res.status(500).json({ error: 'Failed to create room' });
    }
  },

  // GET /api/rooms - list rooms user belongs to
  async listUserRooms(req, res) {
    try {
      const userId = req.user.id;
      const rooms = await Room.getUserRooms(userId);
      res.json(rooms);
    } catch (err) {
      console.error('Error fetching rooms:', err);
      res.status(500).json({ error: 'Failed to fetch rooms' });
    }
  },

  // GET /api/rooms/:roomId - room profile
  async getRoom(req, res) {
    try {
      const { roomId } = req.params;
      const room = await Room.findById(roomId);
      if (!room) return res.status(404).json({ error: 'Room not found' });
      res.json(room);
    } catch (err) {
      console.error('Error fetching room:', err);
      res.status(500).json({ error: 'Failed to fetch room' });
    }
  },

  // PUT /api/rooms/:roomId - update room settings (owner/admin only)
  async updateRoom(req, res) {
    try {
      const { roomId } = req.params;
      const updates = req.body;
      await Room.update(roomId, updates);
      res.json({ success: true });
    } catch (err) {
      console.error('Error updating room:', err);
      res.status(500).json({ error: 'Failed to update room' });
    }
  },

  // DELETE /api/rooms/:roomId - delete room (owner only)
  async deleteRoom(req, res) {
    try {
      const { roomId } = req.params;
      await Room.delete(roomId);
      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting room:', err);
      res.status(500).json({ error: 'Failed to delete room' });
    }
  },

  // POST /api/rooms/:roomId/join - join a room
  async joinRoom(req, res) {
    try {
      const { roomId } = req.params;
      const userId = req.user.id;
      await RoomMember.add({ roomId, userId, role: 'member' });
      res.json({ success: true });
    } catch (err) {
      console.error('Error joining room:', err);
      res.status(500).json({ error: 'Failed to join room' });
    }
  },

  // POST /api/rooms/:roomId/leave - leave a room
  async leaveRoom(req, res) {
    try {
      const { roomId } = req.params;
      const userId = req.user.id;
      await RoomMember.remove(roomId, userId);
      res.json({ success: true });
    } catch (err) {
      console.error('Error leaving room:', err);
      res.status(500).json({ error: 'Failed to leave room' });
    }
  },
};
