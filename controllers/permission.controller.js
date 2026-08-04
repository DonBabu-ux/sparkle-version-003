
// controllers/permission.controller.js

const Message = require('../models/Message');
const { canPinMessage, canEditMessage, canDeleteForMe, canDeleteForEveryone, canReactMessage, canForwardMessage } = require('../services/messagePermission');
const db = require('../config/database');

// Assuming you have a socket.io instance exported from your server entry
const { getIO } = require('../socket');

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
  const user = req.user;
  const message = await Message.getById(messageId);
  if (!message) return res.status(404).json({ error: 'Message not found' });

  const chatId = message.conversationId || message.chatId || message.personal_chat_id;

  // Query sender's privacy settings for this chat
  const [privacyRows] = await db.query(
    'SELECT allow_forward, allow_copy FROM chat_privacy_settings WHERE chat_id = ? AND user_id = ?',
    [chatId, message.senderId]
  );

  const senderPrivacy = (privacyRows && privacyRows[0]) ? privacyRows[0] : { allow_forward: 1, allow_copy: 1 };
  const allowCopy = message.allow_copy !== undefined ? !!message.allow_copy : senderPrivacy.allow_copy !== 0;
  const allowForward = message.allow_forward !== undefined ? !!message.allow_forward : senderPrivacy.allow_forward !== 0;

  // Build permissions object
  const permissions = {
    isSender: message.senderId === user.id,
    canEdit: canEditMessage(user, message),
    canDeleteForMe: canDeleteForMe(user, message),
    canDeleteForEveryone: canDeleteForEveryone(user, message, { type: message.conversationType }),
    canPin: canPinMessage(user, message, { type: message.conversationType }),
    canReact: canReactMessage(user, message),
    canForward: allowForward && canForwardMessage(user, message),
    canReply: true, // always allowed
    canCopy: allowCopy,
  };
  return res.json({ permissions });
}

// Helper to validate a participant (personal or group chat)
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

  // Validate userId
  if (!userId) {
    return { isParticipant: false };
  }
  // Check group chats members using correct column name
  const [groupRows] = await db.query(
    'SELECT user_id FROM group_members WHERE group_id = ? AND user_id = ?',
    [chatId, userId]
  );
  if (groupRows && groupRows.length > 0) {
    return { isParticipant: true, isGroup: true };
  }

  return { isParticipant: false };
}

// Helper to map a DB row to a privacy settings object
function rowToPrivacy(row) {
  if (!row) return {
    screenshotProtection: false,
    screenRecordingProtection: false,
    copyProtection: false,
    forwardProtection: false,
    captureNotifications: true,
    privacyVersion: 1,
  };
  return {
    screenshotProtection: !!row.block_screenshot,
    screenRecordingProtection: !!row.blur_screen_recording,
    copyProtection: !row.allow_copy,
    forwardProtection: !row.allow_forward,
    captureNotifications: !!row.notify_screenshot_attempts,
    privacyVersion: row.privacy_version || 1,
  };
}

// GET privacy settings for a chat – returns BOTH the user's own settings
// AND the partner's settings so the frontend can:
//   1. Populate the toggle panel with "mySettings"
//   2. ENFORCE the partner's restrictions via "enforcedSettings"
async function getPrivacySettings(req, res) {
  const { chatId } = req.params;
  const user = req.user;

  const { isParticipant, isGroup, partnerId } = await checkParticipant(chatId, user.id);
  if (!isParticipant) {
    return res.status(403).json({ error: 'Access denied: not a participant of this chat' });
  }

  // Fetch the user's OWN settings (what they set for this chat)
  const [ownRows] = await db.query(
    'SELECT allow_forward, allow_copy, block_screenshot, blur_screen_recording, notify_screenshot_attempts, privacy_version FROM chat_privacy_settings WHERE chat_id = ? AND user_id = ?',
    [chatId, user.id]
  );
  const mySettings = rowToPrivacy(ownRows && ownRows[0]);

  let enforcedSettings;
  if (isGroup) {
    // Group chat: Strictest Rule Wins across all members
    const [allMemberSettings] = await db.query(
      `SELECT allow_forward, allow_copy, block_screenshot, blur_screen_recording, notify_screenshot_attempts, privacy_version 
       FROM chat_privacy_settings 
       WHERE chat_id = ? AND user_id != ?`,
      [chatId, user.id]
    );
    let screenshotProtection = false;
    let screenRecordingProtection = false;
    let copyProtection = false;
    let forwardProtection = false;
    let captureNotifications = true;
    let maxVersion = 1;

    (allMemberSettings || []).forEach(row => {
      if (row.block_screenshot) screenshotProtection = true;
      if (row.blur_screen_recording) screenRecordingProtection = true;
      if (row.allow_copy === 0) copyProtection = true;
      if (row.allow_forward === 0) forwardProtection = true;
      if (row.privacy_version > maxVersion) maxVersion = row.privacy_version;
    });

    enforcedSettings = {
      screenshotProtection,
      screenRecordingProtection,
      copyProtection,
      forwardProtection,
      captureNotifications,
      privacyVersion: maxVersion,
    };
  } else {
    // Personal 1-on-1 chat: partner's settings apply
    let partnerSettings = null;
    if (partnerId) {
      const [partnerRows] = await db.query(
        'SELECT allow_forward, allow_copy, block_screenshot, blur_screen_recording, notify_screenshot_attempts, privacy_version FROM chat_privacy_settings WHERE chat_id = ? AND user_id = ?',
        [chatId, partnerId]
      );
      partnerSettings = rowToPrivacy(partnerRows && partnerRows[0]);
    }
    enforcedSettings = partnerSettings || rowToPrivacy(null);
  }

  return res.json({
    mySettings,
    enforcedSettings,
    // Legacy flat format for backward compat
    ...enforcedSettings,
  });
}

const crypto = require('crypto');

// In‑memory stores for rate‑limiting settings changes and websocket alerts
const settingsRateLimits = new Map(); // key: `${userId}:${chatId}` → timestamps[]
const socketAlertThrottles = new Map(); // key: `${ownerId}:${chatId}` → timestamps[]

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

  // Rate limiting: max 10 changes per minute per user per chat
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

  // Upsert with privacy_version increment
  await db.query(
    `INSERT INTO chat_privacy_settings (id, chat_id, user_id, allow_forward, allow_copy, block_screenshot, blur_screen_recording, notify_screenshot_attempts, privacy_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
     allow_forward = VALUES(allow_forward),
     allow_copy = VALUES(allow_copy),
     block_screenshot = VALUES(block_screenshot),
     blur_screen_recording = VALUES(blur_screen_recording),
     notify_screenshot_attempts = VALUES(notify_screenshot_attempts),
     privacy_version = privacy_version + 1`,
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

  // Fetch the new privacy_version after increment
  const [versionRow] = await db.query(
    'SELECT privacy_version FROM chat_privacy_settings WHERE chat_id = ? AND user_id = ?',
    [chatId, user.id]
  );
  const privacyVersion = (versionRow && versionRow[0]) ? versionRow[0].privacy_version : 1;

  const privacySettings = {
    screenshotProtection: !!blockScreenshots,
    screenRecordingProtection: !!blurScreenRecording,
    copyProtection: !allowCopy,
    forwardProtection: !allowForward,
    captureNotifications: !!notifyScreenshot,
    privacyVersion,
  };

  // Find the partner so we can broadcast restrictions TO THEM
  const { partnerId } = await checkParticipant(chatId, user.id);

  try {
    const io = getIO();
    // Notify the SETTER (for their toggle panel confirmation)
    io.to(`user:${user.id}`).emit('conversation_privacy_updated', {
      chatId,
      role: 'setter',
      ...privacySettings,
    });
    // Notify the PARTNER (so they receive the restrictions in real-time)
    if (partnerId) {
      io.to(`user:${partnerId}`).emit('conversation_privacy_updated', {
        chatId,
        role: 'receiver',
        setterId: user.id,
        ...privacySettings,
      });
    }
  } catch (err) {
    console.error('Socket error during privacy broadcast:', err.message);
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

  // For 1‑to‑1 chats the target owner is the partner; group chats skip direct alerts
  const ownerId = partnerId || null;
  if (!ownerId) {
    return res.json({ success: true, message: 'Group chat attempts tracked without alert routing' });
  }

  // Debounce attempts within 30 seconds – merge meta if needed
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
    } catch (e) {}
    const attemptCount = (oldMeta.attempt_count || 1) + 1;
    const updatedMeta = JSON.stringify({ ...oldMeta, attempt_count: attemptCount });
    await db.query('UPDATE capture_attempts SET metadata = ? WHERE id = ?', [updatedMeta, attemptId]);
  } else {
    attemptId = crypto.randomUUID();
    const initialMeta = JSON.stringify({ attempt_count: 1, ...(metadata || {}) });
    await db.query(
      'INSERT INTO capture_attempts (id, chat_id, owner_user_id, actor_user_id, attempt_type, detection_method, device_info, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [attemptId, chatId, ownerId, user.id, attemptType || 'SCREENSHOT_ATTEMPT', detectionMethod || 'UNKNOWN', JSON.stringify(deviceInfo || {}), initialMeta]
    );
    // Persistent notification record
    const notificationId = crypto.randomUUID();
    await db.query('INSERT INTO capture_notifications (id, recipient_user_id, capture_attempt_id) VALUES (?, ?, ?)', [notificationId, ownerId, attemptId]);
  }

  // Immutable audit log entry
  const auditId = crypto.randomUUID();
  await db.query(
    'INSERT INTO capture_audit_log (id, capture_attempt_id, actor_user_id, owner_user_id, chat_id, action) VALUES (?, ?, ?, ?, ?, ?)',
    [auditId, attemptId, user.id, ownerId, chatId, 'CAPTURE_ATTEMPT_LOGGED']
  );

  // Rate‑limit real‑time websocket alerts: max 2 alerts per minute per chat per owner
  const throttleKey = `${ownerId}:${chatId}`;
  const nowAlert = Date.now();
  const alertHistory = socketAlertThrottles.get(throttleKey) || [];
  const oneMinuteAgoAlert = nowAlert - 60000;
  const activeAlerts = alertHistory.filter(t => t > oneMinuteAgoAlert);
  if (activeAlerts.length < 2) {
    activeAlerts.push(nowAlert);
    socketAlertThrottles.set(throttleKey, activeAlerts);
    try {
      const io = getIO();
      io.to(`user:${ownerId}`).emit('capture_attempt', {
        type: 'capture_attempt',
        payload: {
          chatId,
          attemptType: attemptType || 'SCREENSHOT_ATTEMPT',
          detectionMethod: detectionMethod || 'UNKNOWN',
          timestamp: new Date().toISOString(),
          actorUserId: user.id,
        },
      });
    } catch (err) {
      console.error('Socket alert dispatch failed:', err.message);
    }
  }

  return res.json({ success: true, attemptId });
}

module.exports = {
  getMessagePermissions,
  getPrivacySettings,
  updatePrivacySettings,
  recordCaptureAttempt,
};
