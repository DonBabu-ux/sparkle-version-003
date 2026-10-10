
// controllers/permission.controller.js

const Message = require('../models/Message');
const PermissionEngine = require('../services/PermissionEngine');
const { canPinMessage, canEditMessage, canDeleteForMe, canDeleteForEveryone, canReactMessage, canForwardMessage } = require('../services/messagePermission');
const db = require('../config/database');
const logger = require('../utils/logger');

// Assuming you have a socket.io instance exported from your server entry
const { getIO } = require('../socket');

/** Extract user_id consistently from req.user */
function extractUserId(user) {
  if (!user) return null;
  return user.user_id || user.userId || user.id || null;
}

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
  try {
    const { messageId } = req.params;
    const user = req.user;
    const userId = extractUserId(user);
    const userObj = user ? { ...user, id: userId, user_id: userId, userId } : null;

    let message = await Message.getById(messageId);
    if (!message) {
      if (messageId && (messageId.startsWith('msg_sparkly_') || messageId.startsWith('temp_'))) {
        return res.json({
          permissions: {
            isSender: false,
            canEdit: false,
            canDeleteForMe: true,
            canDeleteForEveryone: true,
            canPin: false,
            canReact: true,
            canForward: true,
            canReply: true,
            canCopy: true
          }
        });
      }
      return res.status(404).json({ error: 'Message not found' });
    }

    const chatId = message.chat_id || message.conversation_id || message.conversationId || message.chatId || message.personal_chat_id;
    const senderId = message.sender_id || message.senderId;

    // Query sender's privacy settings for this chat
    const [privacyRows] = await db.query(
      'SELECT allow_forward, allow_copy, block_screenshot, blur_screen_recording, privacy_version FROM chat_privacy_settings WHERE chat_id = ? AND user_id = ?',
      [chatId, senderId]
    );

    // Query sender's global defaults as fallback
    const [senderUserRows] = await db.query(
      'SELECT default_allow_forwarding, default_allow_copy_text, default_screenshot_notification FROM users WHERE user_id = ?',
      [senderId]
    );
    const senderDefaults = (senderUserRows && senderUserRows[0]) ? senderUserRows[0] : {};
    const rawSenderPrivacy = (privacyRows && privacyRows[0]) ? privacyRows[0] : {};

    const senderPrivacy = {
      privacy_version: rawSenderPrivacy.privacy_version || 1,
      allow_forward: (rawSenderPrivacy.allow_forward !== null && rawSenderPrivacy.allow_forward !== undefined)
        ? rawSenderPrivacy.allow_forward
        : (senderDefaults.default_allow_forwarding !== undefined ? senderDefaults.default_allow_forwarding : 1),
      allow_copy: (rawSenderPrivacy.allow_copy !== null && rawSenderPrivacy.allow_copy !== undefined)
        ? rawSenderPrivacy.allow_copy
        : (senderDefaults.default_allow_copy_text !== undefined ? senderDefaults.default_allow_copy_text : 1),
      block_screenshot: (rawSenderPrivacy.block_screenshot !== null && rawSenderPrivacy.block_screenshot !== undefined)
        ? rawSenderPrivacy.block_screenshot
        : 0,
      blur_screen_recording: (rawSenderPrivacy.blur_screen_recording !== null && rawSenderPrivacy.blur_screen_recording !== undefined)
        ? rawSenderPrivacy.blur_screen_recording
        : 1
    };

    const permissions = PermissionEngine.computePermissions({
      message,
      senderPrivacy,
      viewerUserId: userId
    });
    return res.json({ permissions });
  } catch (err) {
    console.error('getMessagePermissions error:', err?.message || err);
    return res.json({
      permissions: {
        isSender: false,
        canEdit: false,
        canDeleteForMe: true,
        canDeleteForEveryone: false,
        canPin: false,
        canReact: true,
        canForward: true,
        canReply: true,
        canCopy: true
      },
      fallback: true
    });
  }
}

// Helper to validate a participant (personal or group chat)
async function checkParticipant(chatId, userId) {
  if (!userId) {
    return { isParticipant: false };
  }

  try {
    // Check personal chats
    const [personalRows] = await db.query(
      'SELECT participant1_id, participant2_id FROM personal_chats WHERE chat_id = ?',
      [chatId]
    );
    if (personalRows && personalRows.length > 0) {
      const chat = personalRows[0];
      const p1 = String(chat.participant1_id);
      const p2 = String(chat.participant2_id);
      const u = String(userId);
      if (p1 === u || p2 === u) {
        return { isParticipant: true, isGroup: false, partnerId: p1 === u ? chat.participant2_id : chat.participant1_id };
      }
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
  } catch (err) {
    console.error('checkParticipant db error:', err?.message || err);
    // On temporary DB exhaustion, fail open as participant so user is not locked out
    return { isParticipant: true, isGroup: false, partnerId: null };
  }
}

// Helper to map a DB row to a privacy settings object with global defaults inheritance
function rowToPrivacy(row, disappearingDuration = 0, userDefaults = {}) {
  const defaultReadReceipts = userDefaults.default_read_receipts !== undefined ? (userDefaults.default_read_receipts !== 0) : true;
  const defaultTypingIndicator = userDefaults.default_typing_indicator !== undefined ? (userDefaults.default_typing_indicator !== 0) : true;
  const defaultAllowForward = userDefaults.default_allow_forwarding !== undefined ? (userDefaults.default_allow_forwarding !== 0) : true;
  const defaultAllowCopy = userDefaults.default_allow_copy_text !== undefined ? (userDefaults.default_allow_copy_text !== 0) : true;
  const defaultNotifyScreenshot = userDefaults.default_screenshot_notification !== undefined ? (userDefaults.default_screenshot_notification !== 0) : true;

  const rawOverrides = {
    allowForward: (row && row.allow_forward !== null && row.allow_forward !== undefined) ? (row.allow_forward !== 0 && row.allow_forward !== false) : null,
    allowCopy: (row && row.allow_copy !== null && row.allow_copy !== undefined) ? (row.allow_copy !== 0 && row.allow_copy !== false) : null,
    blockScreenshot: (row && row.block_screenshot !== null && row.block_screenshot !== undefined) ? !!row.block_screenshot : null,
    blurScreenRecording: (row && row.blur_screen_recording !== null && row.blur_screen_recording !== undefined) ? !!row.blur_screen_recording : null,
    notifyScreenshotAttempts: (row && row.notify_screenshot_attempts !== null && row.notify_screenshot_attempts !== undefined) ? !!row.notify_screenshot_attempts : null,
    readReceipts: (row && row.read_receipts_enabled !== null && row.read_receipts_enabled !== undefined) ? (row.read_receipts_enabled !== 0) : null,
    typingIndicator: (row && row.typing_indicator_enabled !== null && row.typing_indicator_enabled !== undefined) ? (row.typing_indicator_enabled !== 0) : null,
  };

  const effective = {
    allowForward: rawOverrides.allowForward !== null ? rawOverrides.allowForward : defaultAllowForward,
    allowCopy: rawOverrides.allowCopy !== null ? rawOverrides.allowCopy : defaultAllowCopy,
    blockScreenshot: rawOverrides.blockScreenshot !== null ? rawOverrides.blockScreenshot : false,
    blurScreenRecording: rawOverrides.blurScreenRecording !== null ? rawOverrides.blurScreenRecording : true,
    notifyScreenshotAttempts: rawOverrides.notifyScreenshotAttempts !== null ? rawOverrides.notifyScreenshotAttempts : defaultNotifyScreenshot,
    readReceipts: rawOverrides.readReceipts !== null ? rawOverrides.readReceipts : defaultReadReceipts,
    typingIndicator: rawOverrides.typingIndicator !== null ? rawOverrides.typingIndicator : defaultTypingIndicator,
  };

  return {
    screenshotProtection: effective.blockScreenshot,
    screenRecordingProtection: effective.blurScreenRecording,
    copyProtection: !effective.allowCopy,
    forwardProtection: !effective.allowForward,
    captureNotifications: effective.notifyScreenshotAttempts,
    readReceipts: effective.readReceipts,
    typingIndicator: effective.typingIndicator,
    disappearingDuration: disappearingDuration || (row && row.disappearing_duration) || 0,
    privacyVersion: (row && row.privacy_version) || 1,
    rawOverrides,
    effective,
    defaults: {
      readReceipts: defaultReadReceipts,
      typingIndicator: defaultTypingIndicator,
      allowForward: defaultAllowForward,
      allowCopy: defaultAllowCopy,
      notifyScreenshotAttempts: defaultNotifyScreenshot,
    }
  };
}

// GET privacy settings for a chat
async function getPrivacySettings(req, res) {
  try {
    const { chatId } = req.params;
    const user = req.user;
    const userId = extractUserId(user);

    const { isParticipant, isGroup, partnerId } = await checkParticipant(chatId, userId);
    if (!isParticipant) {
      return res.status(403).json({ error: 'Access denied: not a participant of this chat' });
    }

    // Fetch disappearing_duration from chat table
    let disappearingDuration = 0;
    if (isGroup) {
      const [gc] = await db.query('SELECT disappearing_duration FROM group_chats WHERE chat_id = ?', [chatId]);
      if (gc && gc[0]) disappearingDuration = gc[0].disappearing_duration || 0;
    } else {
      const [pc] = await db.query('SELECT disappearing_duration FROM personal_chats WHERE chat_id = ?', [chatId]);
      if (pc && pc[0]) disappearingDuration = pc[0].disappearing_duration || 0;
    }

    // Fetch user's global defaults
    const [userRows] = await db.query(
      'SELECT default_read_receipts, default_typing_indicator, default_allow_media_download, default_allow_copy_text, default_allow_reactions, default_allow_forwarding, default_screenshot_notification FROM users WHERE user_id = ?',
      [userId]
    );
    const userDefaults = (userRows && userRows[0]) ? userRows[0] : {};

    // Fetch the user's OWN settings (what they set for this chat)
    const [ownRows] = await db.query(
      'SELECT allow_forward, allow_copy, block_screenshot, blur_screen_recording, notify_screenshot_attempts, read_receipts_enabled, typing_indicator_enabled, privacy_version FROM chat_privacy_settings WHERE chat_id = ? AND user_id = ?',
      [chatId, userId]
    );
    const mySettings = rowToPrivacy(ownRows && ownRows[0], disappearingDuration, userDefaults);

    let enforcedSettings;
    if (isGroup) {
      // Group chat: Strictest Rule Wins across all members
      const [allMemberSettings] = await db.query(
        `SELECT cps.*, u.default_allow_forwarding, u.default_allow_copy_text, u.default_screenshot_notification 
         FROM chat_privacy_settings cps
         JOIN users u ON cps.user_id = u.user_id
         WHERE cps.chat_id = ? AND cps.user_id != ?`,
        [chatId, userId]
      );
      let screenshotProtection = false;
      let screenRecordingProtection = false;
      let copyProtection = false;
      let forwardProtection = false;
      let captureNotifications = true;
      let maxVersion = 1;

      (allMemberSettings || []).forEach(row => {
        const mAllowForward = row.allow_forward !== null ? (row.allow_forward !== 0 && row.allow_forward !== false) : (row.default_allow_forwarding !== 0);
        const mAllowCopy = row.allow_copy !== null ? (row.allow_copy !== 0 && row.allow_copy !== false) : (row.default_allow_copy_text !== 0);
        const mBlockScreenshot = row.block_screenshot !== null ? !!row.block_screenshot : false;
        const mBlurRecording = row.blur_screen_recording !== null ? !!row.blur_screen_recording : true;
        const mNotifyScreenshot = row.notify_screenshot_attempts !== null ? !!row.notify_screenshot_attempts : (row.default_screenshot_notification !== 0);

        if (mBlockScreenshot) screenshotProtection = true;
        if (mBlurRecording) screenRecordingProtection = true;
        if (!mAllowCopy) copyProtection = true;
        if (!mAllowForward) forwardProtection = true;
        if (row.privacy_version > maxVersion) maxVersion = row.privacy_version;
      });

      enforcedSettings = {
        screenshotProtection,
        screenRecordingProtection,
        copyProtection,
        forwardProtection,
        captureNotifications,
        readReceipts: mySettings.readReceipts,
        typingIndicator: mySettings.typingIndicator,
        disappearingDuration,
        privacyVersion: maxVersion,
      };
    } else {
      // Personal 1-on-1 chat: partner's settings apply
      let partnerSettings = null;
      if (partnerId) {
        const [partnerRows] = await db.query(
          'SELECT allow_forward, allow_copy, block_screenshot, blur_screen_recording, notify_screenshot_attempts, read_receipts_enabled, typing_indicator_enabled, privacy_version FROM chat_privacy_settings WHERE chat_id = ? AND user_id = ?',
          [chatId, partnerId]
        );
        const [partnerUserRows] = await db.query(
          'SELECT default_read_receipts, default_typing_indicator, default_allow_media_download, default_allow_copy_text, default_allow_reactions, default_allow_forwarding, default_screenshot_notification FROM users WHERE user_id = ?',
          [partnerId]
        );
        const partnerDefaults = (partnerUserRows && partnerUserRows[0]) ? partnerUserRows[0] : {};
        partnerSettings = rowToPrivacy(partnerRows && partnerRows[0], disappearingDuration, partnerDefaults);
      }
      enforcedSettings = partnerSettings || rowToPrivacy(null, disappearingDuration, {});
    }

    return res.json({
      mySettings,
      enforcedSettings,
      // Legacy flat format for backward compat
      ...enforcedSettings,
      disappearingDuration,
      readReceipts: mySettings.readReceipts,
      typingIndicator: mySettings.typingIndicator,
      allowForward: !mySettings.forwardProtection,
      allowCopy: !mySettings.copyProtection,
      blockScreenshots: mySettings.screenshotProtection,
      blurScreenRecording: mySettings.screenRecordingProtection,
      notifyScreenshotAttempts: mySettings.captureNotifications,
      rawOverrides: mySettings.rawOverrides,
      defaults: mySettings.defaults
    });
  } catch (err) {
    console.error('getPrivacySettings error:', err?.message || err);
    const fallbackSettings = rowToPrivacy(null, 0, {});
    return res.json({
      mySettings: fallbackSettings,
      enforcedSettings: fallbackSettings,
      ...fallbackSettings,
      disappearingDuration: 0,
      readReceipts: fallbackSettings.readReceipts,
      typingIndicator: fallbackSettings.typingIndicator,
      allowForward: !fallbackSettings.forwardProtection,
      allowCopy: !fallbackSettings.copyProtection,
      blockScreenshots: fallbackSettings.screenshotProtection,
      blurScreenRecording: fallbackSettings.screenRecordingProtection,
      notifyScreenshotAttempts: fallbackSettings.captureNotifications,
      rawOverrides: fallbackSettings.rawOverrides,
      defaults: fallbackSettings.defaults,
      fallback: true
    });
  }
}

const crypto = require('crypto');

// In‑memory stores for rate‑limiting settings changes and websocket alerts
const settingsRateLimits = new Map(); // key: `${userId}:${chatId}` → timestamps[]
const socketAlertThrottles = new Map(); // key: `${ownerId}:${chatId}` → timestamps[]

// Helper to parse 3-state nullable boolean input
function parseNullableBoolInput(explicitVal, altVal) {
  const target = explicitVal !== undefined ? explicitVal : altVal;
  if (target === undefined) return undefined;
  if (target === null || target === 'inherit' || target === 'default') return null;
  return (target === true || target === 1 || target === '1' || target === 'true') ? 1 : 0;
}

// PATCH privacy settings for a user in a conversation
async function updatePrivacySettings(req, res) {
  try {
    const { chatId } = req.params;
  const user = req.user;
  const userId = extractUserId(user);
  const {
    screenshotProtection,
    screenRecordingProtection,
    copyProtection,
    forwardProtection,
    captureNotifications,
    allowForward,
    allowCopy,
    blockScreenshots,
    blurScreenRecording,
    notifyScreenshotAttempts,
    readReceipts,
    typingIndicator,
    disappearingDuration,
    disappearing_duration
  } = req.body;

  const { isParticipant, isGroup, partnerId } = await checkParticipant(chatId, userId);
  if (!isParticipant) {
    return res.status(403).json({ error: 'Access denied: not a participant of this chat' });
  }

  // Rate limiting: max 15 changes per minute per user per chat
  const limitKey = `${userId}:${chatId}`;
  const now = Date.now();
  const userHistory = settingsRateLimits.get(limitKey) || [];
  const oneMinuteAgo = now - 60000;
  const activeRequests = userHistory.filter(t => t > oneMinuteAgo);
  if (activeRequests.length >= 15) {
    return res.status(429).json({ error: 'Too many settings changes. Limit is 15 per minute.' });
  }
  activeRequests.push(now);
  settingsRateLimits.set(limitKey, activeRequests);

  // Fetch current chat privacy row
  const [existingRows] = await db.query(
    'SELECT * FROM chat_privacy_settings WHERE chat_id = ? AND user_id = ?',
    [chatId, userId]
  );
  const existing = (existingRows && existingRows[0]) ? existingRows[0] : {};

  // Parse values (support null for inherit)
  let allowForwardVal = parseNullableBoolInput(
    allowForward, 
    forwardProtection !== undefined ? (forwardProtection === null || forwardProtection === 'inherit' ? null : !forwardProtection) : undefined
  );
  if (allowForwardVal === undefined) allowForwardVal = existing.allow_forward !== undefined ? existing.allow_forward : null;

  let allowCopyVal = parseNullableBoolInput(
    allowCopy, 
    copyProtection !== undefined ? (copyProtection === null || copyProtection === 'inherit' ? null : !copyProtection) : undefined
  );
  if (allowCopyVal === undefined) allowCopyVal = existing.allow_copy !== undefined ? existing.allow_copy : null;

  let blockScreenshotsVal = parseNullableBoolInput(blockScreenshots, screenshotProtection);
  if (blockScreenshotsVal === undefined) blockScreenshotsVal = existing.block_screenshot !== undefined ? existing.block_screenshot : null;

  let blurScreenRecordingVal = parseNullableBoolInput(blurScreenRecording, screenRecordingProtection);
  if (blurScreenRecordingVal === undefined) blurScreenRecordingVal = existing.blur_screen_recording !== undefined ? existing.blur_screen_recording : null;

  let notifyScreenshotVal = parseNullableBoolInput(notifyScreenshotAttempts, captureNotifications);
  if (notifyScreenshotVal === undefined) notifyScreenshotVal = existing.notify_screenshot_attempts !== undefined ? existing.notify_screenshot_attempts : null;

  let readReceiptsVal = parseNullableBoolInput(readReceipts, undefined);
  if (readReceiptsVal === undefined) readReceiptsVal = existing.read_receipts_enabled !== undefined ? existing.read_receipts_enabled : null;

  let typingIndicatorVal = parseNullableBoolInput(typingIndicator, undefined);
  if (typingIndicatorVal === undefined) typingIndicatorVal = existing.typing_indicator_enabled !== undefined ? existing.typing_indicator_enabled : null;

  const targetDisappearing = disappearingDuration !== undefined ? disappearingDuration : disappearing_duration;

  if (targetDisappearing !== undefined) {
    const durSecs = parseInt(targetDisappearing, 10) || 0;
    if (isGroup) {
      await db.query('UPDATE group_chats SET disappearing_duration = ? WHERE chat_id = ?', [durSecs, chatId]);
    } else {
      await db.query('UPDATE personal_chats SET disappearing_duration = ? WHERE chat_id = ?', [durSecs, chatId]);
    }
  }

  const settingId = existing.id || crypto.randomUUID();

  // Upsert with privacy_version increment
  await db.query(
    `INSERT INTO chat_privacy_settings (id, chat_id, user_id, allow_forward, allow_copy, block_screenshot, blur_screen_recording, notify_screenshot_attempts, read_receipts_enabled, typing_indicator_enabled, privacy_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
     allow_forward = VALUES(allow_forward),
     allow_copy = VALUES(allow_copy),
     block_screenshot = VALUES(block_screenshot),
     blur_screen_recording = VALUES(blur_screen_recording),
     notify_screenshot_attempts = VALUES(notify_screenshot_attempts),
     read_receipts_enabled = VALUES(read_receipts_enabled),
     typing_indicator_enabled = VALUES(typing_indicator_enabled),
     privacy_version = privacy_version + 1`,
    [
      settingId,
      chatId,
      userId,
      allowForwardVal,
      allowCopyVal,
      blockScreenshotsVal,
      blurScreenRecordingVal,
      notifyScreenshotVal,
      readReceiptsVal,
      typingIndicatorVal,
    ]
  );

  // Fetch user's global defaults to resolve effective response
  const [userRows] = await db.query(
    'SELECT default_read_receipts, default_typing_indicator, default_allow_media_download, default_allow_copy_text, default_allow_reactions, default_allow_forwarding, default_screenshot_notification FROM users WHERE user_id = ?',
    [userId]
  );
  const userDefaults = (userRows && userRows[0]) ? userRows[0] : {};

  // Fetch the new privacy_version after increment
  const [versionRow] = await db.query(
    'SELECT privacy_version FROM chat_privacy_settings WHERE chat_id = ? AND user_id = ?',
    [chatId, userId]
  );
  const privacyVersion = (versionRow && versionRow[0]) ? versionRow[0].privacy_version : 1;

  // Fetch current disappearing duration
  let currentDisappearing = 0;
  if (targetDisappearing !== undefined) {
    currentDisappearing = parseInt(targetDisappearing, 10) || 0;
  } else {
    const table = isGroup ? 'group_chats' : 'personal_chats';
    const [dRow] = await db.query(`SELECT disappearing_duration FROM ${table} WHERE chat_id = ?`, [chatId]);
    if (dRow && dRow[0]) currentDisappearing = dRow[0].disappearing_duration || 0;
  }

  const defaultReadReceipts = userDefaults.default_read_receipts !== undefined ? (userDefaults.default_read_receipts !== 0) : true;
  const defaultTypingIndicator = userDefaults.default_typing_indicator !== undefined ? (userDefaults.default_typing_indicator !== 0) : true;
  const defaultAllowForward = userDefaults.default_allow_forwarding !== undefined ? (userDefaults.default_allow_forwarding !== 0) : true;
  const defaultAllowCopy = userDefaults.default_allow_copy_text !== undefined ? (userDefaults.default_allow_copy_text !== 0) : true;
  const defaultNotifyScreenshot = userDefaults.default_screenshot_notification !== undefined ? (userDefaults.default_screenshot_notification !== 0) : true;

  const effective = {
    allowForward: allowForwardVal !== null ? (allowForwardVal !== 0) : defaultAllowForward,
    allowCopy: allowCopyVal !== null ? (allowCopyVal !== 0) : defaultAllowCopy,
    blockScreenshot: blockScreenshotsVal !== null ? (blockScreenshotsVal !== 0) : false,
    blurScreenRecording: blurScreenRecordingVal !== null ? (blurScreenRecordingVal !== 0) : true,
    notifyScreenshotAttempts: notifyScreenshotVal !== null ? (notifyScreenshotVal !== 0) : defaultNotifyScreenshot,
    readReceipts: readReceiptsVal !== null ? (readReceiptsVal !== 0) : defaultReadReceipts,
    typingIndicator: typingIndicatorVal !== null ? (typingIndicatorVal !== 0) : defaultTypingIndicator,
  };

  const privacySettings = {
    screenshotProtection: effective.blockScreenshot,
    screenRecordingProtection: effective.blurScreenRecording,
    copyProtection: !effective.allowCopy,
    forwardProtection: !effective.allowForward,
    captureNotifications: effective.notifyScreenshotAttempts,
    readReceipts: effective.readReceipts,
    typingIndicator: effective.typingIndicator,
    disappearingDuration: currentDisappearing,
    privacyVersion,
    allow_copy: allowCopyVal,
    allow_forward: allowForwardVal,
    block_screenshot: blockScreenshotsVal,
    blur_screen_recording: blurScreenRecordingVal,
    read_receipts_enabled: readReceiptsVal,
    typing_indicator_enabled: typingIndicatorVal,
    allowForward: effective.allowForward,
    allowCopy: effective.allowCopy,
    blockScreenshots: effective.blockScreenshot,
    blurScreenRecording: effective.blurScreenRecording,
    notifyScreenshotAttempts: effective.notifyScreenshotAttempts,
    rawOverrides: {
      allowForward: allowForwardVal !== null ? (allowForwardVal !== 0) : null,
      allowCopy: allowCopyVal !== null ? (allowCopyVal !== 0) : null,
      blockScreenshot: blockScreenshotsVal !== null ? (blockScreenshotsVal !== 0) : null,
      blurScreenRecording: blurScreenRecordingVal !== null ? (blurScreenRecordingVal !== 0) : null,
      notifyScreenshotAttempts: notifyScreenshotVal !== null ? (notifyScreenshotVal !== 0) : null,
      readReceipts: readReceiptsVal !== null ? (readReceiptsVal !== 0) : null,
      typingIndicator: typingIndicatorVal !== null ? (typingIndicatorVal !== 0) : null,
    },
    effective
  };

  const computedPermissions = PermissionEngine.computePermissions({
    message: { sender_id: userId },
    senderPrivacy: privacySettings,
    viewerUserId: userId
  });

  try {
    const io = getIO();
    // Build a flat + nested payload so all listeners (Messages.tsx, useMessageSocket.ts) can read top-level or nested
    const socketPayload = {
      chatId,
      senderId: userId,
      privacyVersion,
      privacySettings,
      disappearingDuration: currentDisappearing,
      permissions: computedPermissions,
      // Flat aliases for backwards-compat with Messages.tsx handlePrivacyUpdated
      screenshotProtection: privacySettings.screenshotProtection,
      screenRecordingProtection: privacySettings.screenRecordingProtection,
      copyProtection: privacySettings.copyProtection,
      forwardProtection: privacySettings.forwardProtection,
      captureNotifications: privacySettings.captureNotifications,
      readReceipts: privacySettings.readReceipts,
      typingIndicator: privacySettings.typingIndicator,
      allowCopy: privacySettings.allowCopy,
      allowForward: privacySettings.allowForward,
    };

    // Broadcast conversation_privacy_updated to ALL room members & user sockets
    io.to(`conversation:${chatId}`).to(`chat:${chatId}`).to(`user:${userId}`).emit('conversation_privacy_updated', socketPayload);

    if (partnerId) {
      io.to(`user:${partnerId}`).emit('conversation_privacy_updated', socketPayload);
    }
  } catch (err) {
    console.error('Socket error during privacy broadcast:', err.message);
  }

  return res.json({ success: true, privacySettings, permissions: computedPermissions, disappearingDuration: currentDisappearing });
  } catch (err) {
    console.error('updatePrivacySettings error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to update privacy settings', details: err?.message || err });
  }
}

// POST capture attempt logging & alerts
async function recordCaptureAttempt(req, res) {
  try {
    const { chatId } = req.params;
    const user = req.user;
    const userId = extractUserId(user);
    const { attemptType, detectionMethod, deviceInfo, metadata } = req.body;

    const { isParticipant, partnerId } = await checkParticipant(chatId, userId);
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
      [userId, chatId]
    );

    let attemptId;
    if (existingAttempts && existingAttempts.length > 0) {
      attemptId = existingAttempts[0].id;
      let oldMeta = {};
      try {
        oldMeta = typeof existingAttempts[0].metadata === 'string' ? JSON.parse(existingAttempts[0].metadata) : (existingAttempts[0].metadata || {});
      } catch (e) {
        logger.debug(`recordCaptureAttempt: existing metadata JSON.parse fallback (attempt ${existingAttempts[0].id})`, e?.message || e);
      }
      const attemptCount = (oldMeta.attempt_count || 1) + 1;
      const updatedMeta = JSON.stringify({ ...oldMeta, attempt_count: attemptCount });
      await db.query('UPDATE capture_attempts SET metadata = ? WHERE id = ?', [updatedMeta, attemptId]);
    } else {
      attemptId = crypto.randomUUID();
      const initialMeta = JSON.stringify({ attempt_count: 1, ...(metadata || {}) });
      await db.query(
        'INSERT INTO capture_attempts (id, chat_id, owner_user_id, actor_user_id, attempt_type, detection_method, device_info, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [attemptId, chatId, ownerId, userId, attemptType || 'SCREENSHOT_ATTEMPT', detectionMethod || 'UNKNOWN', JSON.stringify(deviceInfo || {}), initialMeta]
      );
      // Persistent notification record
      const notificationId = crypto.randomUUID();
      await db.query('INSERT INTO capture_notifications (id, recipient_user_id, capture_attempt_id) VALUES (?, ?, ?)', [notificationId, ownerId, attemptId]);
    }

    // Immutable audit log entry
    const auditId = crypto.randomUUID();
    await db.query(
      'INSERT INTO capture_audit_log (id, capture_attempt_id, actor_user_id, owner_user_id, chat_id, action) VALUES (?, ?, ?, ?, ?, ?)',
      [auditId, attemptId, userId, ownerId, chatId, 'CAPTURE_ATTEMPT_LOGGED']
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
            actorUserId: userId,
          },
        });
      } catch (err) {
        console.error('Socket alert dispatch failed:', err.message);
      }
    }

    return res.json({ success: true, attemptId });
  } catch (err) {
    console.error('recordCaptureAttempt error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to record capture attempt', details: err?.message || err });
  }
}

module.exports = {
  getMessagePermissions,
  getPrivacySettings,
  updatePrivacySettings,
  recordCaptureAttempt,
};
