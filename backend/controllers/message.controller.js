// backend/controllers/message.controller.js

const Message = require('../models/Message');
const { canPinMessage, canEditMessage, canDeleteForMe, canDeleteForEveryone, canReactMessage, canForwardMessage } = require('../services/messagePermission');
const db = require('../../config/database');

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

  // Default privacy settings (BALANCED)
  let privacySettings = {
    allowForward: true,
    allowCopy: true,
    blockScreenshots: false,
    blurScreenRecording: true,
    notifyScreenshotAttempts: true,
  };

  // Fetch stored privacy settings based on conversation type
  try {
    if (message.conversationType === 'group') {
      const [rows] = await db.query('SELECT privacy_settings FROM group_chats WHERE chat_id = ?', [conversationId]);
      if (rows[0] && rows[0].privacy_settings) {
        privacySettings = { ...privacySettings, ...JSON.parse(rows[0].privacy_settings) };
      }
    } else {
      const [rows] = await db.query('SELECT privacy_settings FROM personal_chats WHERE chat_id = ?', [conversationId]);
      if (rows[0] && rows[0].privacy_settings) {
        privacySettings = { ...privacySettings, ...JSON.parse(rows[0].privacy_settings) };
      }
    }
  } catch (err) {
    console.error('Error fetching privacy settings:', err);
  }

  // Build permissions object
  const permissions = {
    isSender: message.senderId === user.id,
    canEdit: canEditMessage(user, message),
    canDeleteForMe: canDeleteForMe(user, message),
    canDeleteForEveryone: canDeleteForEveryone(user, message, { type: message.conversationType }),
    canPin: canPinMessage(user, message, { type: message.conversationType }),
    canReact: canReactMessage(user, message),
    canForward: privacySettings.allowForward && canForwardMessage(user, message),
    canReply: true, // always allowed
    canCopy: privacySettings.allowCopy && true,
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

  // Fetch privacy settings for the source conversation
  let privacySettings = { allowForward: true };
  try {
    if (message.conversationType === 'group') {
      const [rows] = await db.query('SELECT privacy_settings FROM group_chats WHERE id = ?', [message.conversationId]);
      if (rows[0] && rows[0].privacy_settings) {
        privacySettings = { ...privacySettings, ...JSON.parse(rows[0].privacy_settings) };
      }
    } else {
      const [rows] = await db.query('SELECT privacy_settings FROM personal_chats WHERE id = ?', [message.conversationId]);
      if (rows[0] && rows[0].privacy_settings) {
        privacySettings = { ...privacySettings, ...JSON.parse(rows[0].privacy_settings) };
      }
    }
  } catch (err) {
    console.error('Error fetching privacy settings:', err);
  }

  if (!privacySettings.allowForward) {
    return res.status(403).json({ error: 'Forwarding disabled by privacy settings' });
  }

  if (!canForwardMessage(user, message)) return res.status(403).json({ error: 'Forbidden' });

  const newId = await Message.sendMessage({
    chatId: targetConversationId,
    senderId: user.id,
    content: message.content,
    type: message.type,
    mediaUrl: message.mediaUrl,
    replyToId: null,
  });
  await Message.incrementForwardCount(messageId);
  emitToConversation(targetConversationId, 'message_new', { messageId: newId });
  return res.json({ success: true, newMessageId: newId });
}

  // GET privacy settings for a conversation
  async function getPrivacySettings(req, res) {
    const { chatId } = req.params;
    // Determine conversation type and fetch settings
    let conversationType = null;
    const [groupRows] = await db.query('SELECT chat_id FROM group_chats WHERE chat_id = ?', [chatId]);
    if (groupRows.length) conversationType = 'group';
    else {
      const [personalRows] = await db.query('SELECT chat_id FROM personal_chats WHERE chat_id = ?', [chatId]);
      if (personalRows.length) conversationType = 'personal';
    }
    if (!conversationType) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    const tableName = conversationType === 'group' ? 'group_chats' : 'personal_chats';
    const [rows] = await db.query(`SELECT privacy_settings FROM ${tableName} WHERE chat_id = ?`, [chatId]);
    const settings = rows[0] && rows[0].privacy_settings ? JSON.parse(rows[0].privacy_settings) : { allowForward: true, allowCopy: true, blockScreenshots: false, blurScreenRecording: true, notifyScreenshotAttempts: true };
    return res.json(settings);
  }

// PATCH privacy settings for a conversation
async function updatePrivacySettings(req, res) {
  const { chatId } = req.params;
  const {
    allowForward,
    allowCopy,
    blockScreenshots,
    blurScreenRecording,
    notifyScreenshotAttempts,
  } = req.body;
  // Determine conversation type
  let conversationType = null;
  const [groupRows] = await db.query('SELECT chat_id FROM group_chats WHERE chat_id = ?', [chatId]);
  if (groupRows.length) conversationType = 'group';
  else {
    const [personalRows] = await db.query('SELECT chat_id FROM personal_chats WHERE chat_id = ?', [chatId]);
    if (personalRows.length) conversationType = 'personal';
  }
  if (!conversationType) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  const privacySettings = {
    allowForward,
    allowCopy,
    blockScreenshots,
    blurScreenRecording,
    notifyScreenshotAttempts,
  };
  const tableName = conversationType === 'group' ? 'group_chats' : 'personal_chats';
  await db.query(`UPDATE ${tableName} SET privacy_settings = ? WHERE chat_id = ?`, [JSON.stringify(privacySettings), chatId]);
  emitToConversation(chatId, 'conversation_privacy_updated', { chatId, ...privacySettings });
  return res.json({ success: true, privacySettings });
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
  updatePrivacySettings,
  getPrivacySettings,
};
