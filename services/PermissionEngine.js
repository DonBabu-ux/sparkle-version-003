/**
 * services/PermissionEngine.js
 * Sparkle Messenger Enterprise Privacy Enforcement Engine (v2)
 *
 * Single authoritative source of truth for per-message permissions.
 * Computes both UI visibility flags and backend security enforcement controls.
 */

'use strict';

class PermissionEngine {
  /**
   * Compute authoritative per-message effective permissions
   * @param {Object} params
   * @param {Object} params.message - Raw message database object
   * @param {Object} params.senderPrivacy - Privacy settings of the message sender { allow_copy, allow_forward, block_screenshot, blur_screen_recording, privacy_version }
   * @param {string} params.viewerUserId - User ID of the user requesting/viewing the message
   * @param {boolean} [params.isGroup] - Is this a group conversation
   * @returns {Object} Structured effective permissions object
   */
  static computePermissions({ message = {}, senderPrivacy = {}, viewerUserId, isGroup = false, isBlocked = false }) {
    const msg = message || {};
    const senderId = msg.sender_id || msg.senderId;
    const isSender = String(senderId) === String(viewerUserId);
    const sentAtTime = msg.sent_at || msg.created_at || msg.createdAt;
    const timeDiffMins = sentAtTime ? (Date.now() - new Date(sentAtTime).getTime()) / 60000 : 999;
    const isDeleted = !!(msg.is_deleted_for_everyone || msg.isDeleted);
    const isPinned = !!(msg.pinned || msg.is_pinned || (msg.permissions && msg.permissions.pinned));

    const privacyVersion = senderPrivacy.privacy_version || senderPrivacy.privacyVersion || 1;

    // Sender's privacy settings apply to all viewers (Default: allow copy & forward unless explicitly restricted)
    const allowCopySetting = senderPrivacy.allow_copy !== undefined
      ? (senderPrivacy.allow_copy !== 0 && senderPrivacy.allow_copy !== false && senderPrivacy.allow_copy !== '0' && senderPrivacy.allow_copy !== 'false')
      : (senderPrivacy.copyProtection !== undefined
          ? !senderPrivacy.copyProtection
          : (senderPrivacy.allowCopy !== undefined ? (senderPrivacy.allowCopy === true || senderPrivacy.allowCopy === 1) : true));

    const allowForwardSetting = senderPrivacy.allow_forward !== undefined
      ? (senderPrivacy.allow_forward !== 0 && senderPrivacy.allow_forward !== false && senderPrivacy.allow_forward !== '0' && senderPrivacy.allow_forward !== 'false')
      : (senderPrivacy.forwardProtection !== undefined
          ? !senderPrivacy.forwardProtection
          : (senderPrivacy.allowForward !== undefined ? (senderPrivacy.allowForward === true || senderPrivacy.allowForward === 1) : true));

    const blockScreenshotSetting = !!(senderPrivacy.block_screenshot || senderPrivacy.screenshotProtection || senderPrivacy.blockScreenshots);
    const blurRecordingSetting = !!(senderPrivacy.blur_screen_recording || senderPrivacy.screenRecordingProtection || senderPrivacy.blurScreenRecording);

    // Canonical effective permissions determination
    const canCopy = !isDeleted && allowCopySetting;
    const canForward = !isDeleted && !isBlocked && allowForwardSetting;
    const canEdit = isSender && !isDeleted && !isBlocked && timeDiffMins <= 15;
    const canDeleteForEveryone = isSender && !isDeleted && timeDiffMins <= 15;
    const canDeleteForMe = true;
    const canReply = !isDeleted && !isBlocked;
    const canReact = !isDeleted && !isBlocked;
    const canPin = !isDeleted;
    const requiresSecureWindow = blockScreenshotSetting || blurRecordingSetting;

    return {
      isSender,
      privacyVersion,
      canCopy,
      canForward,
      canEdit,
      canDeleteForMe,
      canDeleteForEveryone,
      canReply,
      canReact,
      canPin,
      pinned: isPinned,
      requiresSecureWindow,

      // Derived UI and security helpers mirroring single canonical fields
      ui: {
        showCopy: canCopy,
        showForward: canForward,
        showShare: canForward,
        showReply: canReply,
        showReact: canReact,
        showPin: canPin,
        showEdit: canEdit,
        showDeleteForEveryone: canDeleteForEveryone,
        showDeleteForMe: canDeleteForMe,
      },
      security: {
        canCopy,
        canForward,
        canExport: canCopy && canForward,
        secureWindow: requiresSecureWindow,
      },
    };
  }
}

module.exports = PermissionEngine;
