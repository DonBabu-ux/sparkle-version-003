// backend/controllers/message.controller.js

const Message = require('../models/Message');
const { canPinMessage, canEditMessage, canDeleteForMe, canDeleteForEveryone, canReactMessage, canForwardMessage } = require('../services/messagePermission');

// Assuming you have a socket.io instance exported from your server entry
const { getIO } = require('../../socket'); 

/** Helper to send socket events to the conversation room */
function emitToConversation(conversationId, event, payload) {
  try {
    const io = getIO();
    io.to(`conversation:${conversationId}`).emit(event, payload);
  } catch (err) {
    console.error('Socket not initialized during broadcast:', err.message);
  }
}

// GET message permissions (used by frontend modal)
async function getMessagePermissions(req, res) {
  const { messageId } = req.params;
  const user = req.user; // auth middleware should set req.user
  const message = await Message.getById(messageId);
  if (!message) return res.status(404).json({ error: 'Message not found' });
  const conversationId = message.conversationId;
  // Build permissions object
  const permissions = {
    isSender: message.senderId === user.id,
    canEdit: canEditMessage(user, message),
    canDeleteForMe: canDeleteForMe(user, message),
    canDeleteForEveryone: canDeleteForEveryone(user, message, { type: message.conversationType }),
    canPin: canPinMessage(user, message, { type: message.conversationType }),
    canReact: canReactMessage(user, message),
    canForward: canForwardMessage(user, message),
    canReply: true, // always allowed
    canCopy: true, // always allowed
  };
  return res.json({ permissions });
}

// PIN a message
async function pinMessage(req, res) {
  const { messageId } = req.params;
  const user = req.user;
  const message = await Message.getById(messageId);
  if (!message) return res.status(404).json({ error: 'Message not found' });
  if (!canPinMessage(user, message, { type: message.conversationType })) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  await Message.updatePermissions(messageId, { pinned: true }); // we’ll add a generic update method later
  emitToConversation(message.conversationId, 'message_pinned', { messageId, pinnedBy: user.id });
  return res.json({ success: true });
}

// UNPIN a message
async function unpinMessage(req, res) {
  const { messageId } = req.params;
  const user = req.user;
  const message = await Message.getById(messageId);
  if (!message) return res.status(404).json({ error: 'Message not found' });
  if (!canPinMessage(user, message, { type: message.conversationType })) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  await Message.updatePermissions(messageId, { pinned: false });
  emitToConversation(message.conversationId, 'message_unpinned', { messageId });
  return res.json({ success: true });
}

// REACT to a message (toggle)
async function reactMessage(req, res) {
  const { messageId } = req.params;
  const { emoji } = req.body;
  const user = req.user;
  const message = await Message.getById(messageId);
  if (!message) return res.status(404).json({ error: 'Message not found' });
  if (!canReactMessage(user, message)) return res.status(403).json({ error: 'Forbidden' });
  const updated = await Message.toggleReaction(messageId, user.id, emoji);
  emitToConversation(message.conversationId, 'reaction_updated', { messageId, reactions: updated });
  return res.json({ success: true, reactions: updated });
}

// EDIT a message
async function editMessage(req, res) {
  const { messageId } = req.params;
  const { text, media } = req.body;
  const user = req.user;
  const message = await Message.getById(messageId);
  if (!message) return res.status(404).json({ error: 'Message not found' });
  if (!canEditMessage(user, message)) return res.status(403).json({ error: 'Forbidden' });
  const updated = await Message.editContent(messageId, { text, media });
  emitToConversation(message.conversationId, 'message_edited', { messageId, text, editedAt: updated.editedAt });
  return res.json({ success: true, message: updated });
}

// DELETE for me (hide locally)
async function deleteForMe(req, res) {
  const { messageId } = req.params;
  const user = req.user;
  const message = await Message.getById(messageId);
  if (!message) return res.status(404).json({ error: 'Message not found' });
  if (!canDeleteForMe(user, message)) return res.status(403).json({ error: 'Forbidden' });
  await Message.addDeletedFor(messageId, user.id);
  emitToConversation(message.conversationId, 'message_deleted_for_me', { messageId, userId: user.id });
  return res.json({ success: true });
}

// DELETE for everyone (remove globally)
async function deleteForEveryone(req, res) {
  const { messageId } = req.params;
  const user = req.user;
  const message = await Message.getById(messageId);
  if (!message) return res.status(404).json({ error: 'Message not found' });
  if (!canDeleteForEveryone(user, message, { type: message.conversationType })) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  await Message.markAsDeletedForAll(messageId);
  emitToConversation(message.conversationId, 'message_deleted', { messageId });
  return res.json({ success: true });
}

// FORWARD a message (creates a copy in target conversation)
async function forwardMessage(req, res) {
  const { messageId } = req.params;
  const { targetConversationId } = req.body;
  const user = req.user;
  const message = await Message.getById(messageId);
  if (!message) return res.status(404).json({ error: 'Message not found' });
  if (!canForwardMessage(user, message)) return res.status(403).json({ error: 'Forbidden' });
  const newId = await Message.sendMessage({
    chatId: targetConversationId,
    senderId: user.id,
    content: message.content,
    type: message.type,
    mediaUrl: message.mediaUrl,
    replyToId: null,
    // other fields left as default
  });
  // Increment forward count on original
  await Message.incrementForwardCount(messageId);
  emitToConversation(targetConversationId, 'message_new', { messageId: newId });
  return res.json({ success: true, newMessageId: newId });
}

module.exports = {
  getMessagePermissions,
  pinMessage,
  unpinMessage,
  reactMessage,
  editMessage,
  deleteForMe,
  deleteForEveryone,
  forwardMessage,
};
