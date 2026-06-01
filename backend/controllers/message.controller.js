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

  // Build permissions object checking message-level snapshot settings
  const permissions = {
    isSender: message.senderId === user.id,
    canEdit: canEditMessage(user, message),
    canDeleteForMe: canDeleteForMe(user, message),
    canDeleteForEveryone: canDeleteForEveryone(user, message, { type: message.conversationType }),
    canPin: canPinMessage(user, message, { type: message.conversationType }),
    canReact: canReactMessage(user, message),
    canForward: !!message.allow_forward && canForwardMessage(user, message),
    canReply: true, // always allowed
    canCopy: !!message.allow_copy,
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

  if (!message.allow_forward) {
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

const crypto = require('crypto');

// Custom in-memory store for rate limiting setting changes and websocket alerts
const settingsRateLimits = new Map(); // key: userId:chatId -> timestamp[]
const socketAlertThrottles = new Map(); // key: ownerId:chatId -> timestamp[]

/** Participant validation helper */
async function checkParticipant(chatId, userId) {
  // Check personal chats
  const [personalRows] = await db.query(
    'SELECT participant1_id, participant2_id FROM personal_chats WHERE chat_id = ?',
    [chatId]
  );
  if (personalRows && personalRows.length > 0) {
    const chat = personalRows[0];
    if (chat.participant1_id === userId || chat.participant2_id === userId) {
      return { isParticipant: true, isGroup: false, partnerId: chat.participant1_id === userId ? chat.participant2_id : chat.participant1_id };
    }
  }
  
  // Check group chats members
  const [groupRows] = await db.query(
    'SELECT user_id FROM group_members WHERE chat_id = ? AND user_id = ?',
    [chatId, userId]
  );
  if (groupRows && groupRows.length > 0) {
    return { isParticipant: true, isGroup: true };
  }

  return { isParticipant: false };
}

// GET privacy settings for a user in a conversation
async function getPrivacySettings(req, res) {
  const { chatId } = req.params;
  const user = req.user;

  const { isParticipant } = await checkParticipant(chatId, user.id);
  if (!isParticipant) {
    return res.status(403).json({ error: 'Access denied: not a participant of this chat' });
  }

  const [rows] = await db.query(
    'SELECT allow_forward, allow_copy, block_screenshot, blur_screen_recording, notify_screenshot_attempts FROM chat_privacy_settings WHERE chat_id = ? AND user_id = ?',
    [chatId, user.id]
  );

  const settings = (rows && rows[0]) ? {
    screenshotProtection: !!rows[0].block_screenshot,
    screenRecordingProtection: !!rows[0].blur_screen_recording,
    copyProtection: !rows[0].allow_copy,
    forwardProtection: !rows[0].allow_forward,
    captureNotifications: !!rows[0].notify_screenshot_attempts
  } : {
    screenshotProtection: false,
    screenRecordingProtection: false,
    copyProtection: false,
    forwardProtection: false,
    captureNotifications: true
  };

  return res.json(settings);
}

// PATCH privacy settings for a user in a conversation
async function updatePrivacySettings(req, res) {
  const { chatId } = req.params;
  const user = req.user;
  const {
    screenshotProtection,
    screenRecordingProtection,
    copyProtection,
    forwardProtection,
    captureNotifications,
  } = req.body;

  const { isParticipant } = await checkParticipant(chatId, user.id);
  if (!isParticipant) {
    return res.status(403).json({ error: 'Access denied: not a participant of this chat' });
  }

  // Rate Limiting: 10 requests per minute per user per chat
  const limitKey = `${user.id}:${chatId}`;
  const now = Date.now();
  const userHistory = settingsRateLimits.get(limitKey) || [];
  const oneMinuteAgo = now - 60000;
  const activeRequests = userHistory.filter(t => t > oneMinuteAgo);
  if (activeRequests.length >= 10) {
    return res.status(429).json({ error: 'Too many settings changes. Limit is 10 per minute.' });
  }
  activeRequests.push(now);
  settingsRateLimits.set(limitKey, activeRequests);

  const blockScreenshots = screenshotProtection !== undefined ? (screenshotProtection ? 1 : 0) : 0;
  const blurScreenRecording = screenRecordingProtection !== undefined ? (screenRecordingProtection ? 1 : 0) : 0;
  const allowCopy = copyProtection !== undefined ? (copyProtection ? 0 : 1) : 1;
  const allowForward = forwardProtection !== undefined ? (forwardProtection ? 0 : 1) : 1;
  const notifyScreenshot = captureNotifications !== undefined ? (captureNotifications ? 1 : 0) : 1;

  const settingId = crypto.randomUUID();

  await db.query(
    `INSERT INTO chat_privacy_settings (id, chat_id, user_id, allow_forward, allow_copy, block_screenshot, blur_screen_recording, notify_screenshot_attempts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
     allow_forward = VALUES(allow_forward),
     allow_copy = VALUES(allow_copy),
     block_screenshot = VALUES(block_screenshot),
     blur_screen_recording = VALUES(blur_screen_recording),
     notify_screenshot_attempts = VALUES(notify_screenshot_attempts)`,
    [
      settingId,
      chatId,
      user.id,
      allowForward,
      allowCopy,
      blockScreenshots,
      blurScreenRecording,
      notifyScreenshot,
    ]
  );

  const privacySettings = {
    screenshotProtection: !!blockScreenshots,
    screenRecordingProtection: !!blurScreenRecording,
    copyProtection: !allowCopy,
    forwardProtection: !allowForward,
    captureNotifications: !!notifyScreenshot
  };

  // Emit privacy update only to this specific user to update their own UI/chat list settings
  try {
    const io = getIO();
    io.to(`user:${user.id}`).emit('conversation_privacy_updated', { chatId, ...privacySettings });
  } catch (err) {
    console.error('Socket error during per-user privacy broadcast:', err.message);
  }

  return res.json({ success: true, privacySettings });
}

// POST capture attempt logging & alerts
async function recordCaptureAttempt(req, res) {
  const { chatId } = req.params;
  const user = req.user;
  const { attemptType, detectionMethod, deviceInfo, metadata } = req.body;

  const { isParticipant, partnerId } = await checkParticipant(chatId, user.id);
  if (!isParticipant) {
    return res.status(403).json({ error: 'Access denied: not a participant of this chat' });
  }

  // The targeted content owner is the partner in a 1-to-1 conversation
  const ownerId = partnerId || null;
  if (!ownerId) {
    return res.json({ success: true, message: 'Group chat attempts tracked without alert routing' });
  }

  // Check if there is an attempt within last 30 seconds
  const [existingAttempts] = await db.query(
    'SELECT id, metadata FROM capture_attempts WHERE actor_user_id = ? AND chat_id = ? AND created_at > NOW() - INTERVAL 30 SECOND LIMIT 1',
    [user.id, chatId]
  );

  let attemptId;
  if (existingAttempts && existingAttempts.length > 0) {
    attemptId = existingAttempts[0].id;
    let oldMeta = {};
    try {
      oldMeta = typeof existingAttempts[0].metadata === 'string' ? JSON.parse(existingAttempts[0].metadata) : (existingAttempts[0].metadata || {});
    } catch(e) {}
    const attemptCount = (oldMeta.attempt_count || 1) + 1;
    const updatedMeta = JSON.stringify({ ...oldMeta, attempt_count: attemptCount });
    
    await db.query(
      'UPDATE capture_attempts SET metadata = ? WHERE id = ?',
      [updatedMeta, attemptId]
    );
  } else {
    attemptId = crypto.randomUUID();
    const initialMeta = JSON.stringify({ attempt_count: 1, ...(metadata || {}) });
    
    await db.query(
      'INSERT INTO capture_attempts (id, chat_id, owner_user_id, actor_user_id, attempt_type, detection_method, device_info, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [attemptId, chatId, ownerId, user.id, attemptType || 'SCREENSHOT_ATTEMPT', detectionMethod || 'UNKNOWN', JSON.stringify(deviceInfo || {}), initialMeta]
    );

    // Save persistent notification
    const notificationId = crypto.randomUUID();
    await db.query(
      'INSERT INTO capture_notifications (id, recipient_user_id, capture_attempt_id) VALUES (?, ?, ?)',
      [notificationId, ownerId, attemptId]
    );
  }

  // Immutable Audit Log entry
  const auditId = crypto.randomUUID();
  await db.query(
    'INSERT INTO capture_audit_log (id, capture_attempt_id, actor_user_id, owner_user_id, chat_id, action) VALUES (?, ?, ?, ?, ?, ?)',
    [auditId, attemptId, user.id, ownerId, chatId, 'CAPTURE_ATTEMPT_LOGGED']
  );

  // Rate Limit WebSocket real-time delivery: Max 2 alerts per minute per chat per owner
  const throttleKey = `${ownerId}:${chatId}`;
  const now = Date.now();
  const alertHistory = socketAlertThrottles.get(throttleKey) || [];
  const oneMinuteAgo = now - 60000;
  const activeAlerts = alertHistory.filter(t => t > oneMinuteAgo);
  
  if (activeAlerts.length < 2) {
    activeAlerts.push(now);
    socketAlertThrottles.set(throttleKey, activeAlerts);

    // Emit Real-time WebSocket Alert
    try {
      const io = getIO();
      io.to(`user:${ownerId}`).emit('capture_attempt', {
        type: 'capture_attempt',
        payload: {
          chatId,
          attemptType: attemptType || 'SCREENSHOT_ATTEMPT',
          detectionMethod: detectionMethod || 'UNKNOWN',
          timestamp: new Date().toISOString(),
          actorUserId: user.id
        }
      });
    } catch (err) {
      console.error('Socket alert dispatch failed:', err.message);
    }
  }

  return res.json({ success: true, attemptId });
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
  recordCaptureAttempt,
};
