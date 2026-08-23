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
  static computePermissions({ message, senderPrivacy = {}, viewerUserId, isGroup = false }) {
    const senderId = message.sender_id || message.senderId;
    const isSender = String(senderId) === String(viewerUserId);
    const sentAtTime = message.sent_at || message.created_at || message.createdAt;
    const timeDiffMins = sentAtTime ? (Date.now() - new Date(sentAtTime).getTime()) / 60000 : 999;
    const isDeleted = !!message.is_deleted_for_everyone;

    const privacyVersion = senderPrivacy.privacy_version || senderPrivacy.privacyVersion || 1;

    // Sender's privacy settings apply to all viewers
    const allowCopySetting = senderPrivacy.allow_copy !== undefined
      ? (senderPrivacy.allow_copy !== 0 && senderPrivacy.allow_copy !== false)
      : (senderPrivacy.copyProtection !== undefined
          ? !senderPrivacy.copyProtection
          : (senderPrivacy.allowCopy !== undefined ? !!senderPrivacy.allowCopy : true));

    const allowForwardSetting = senderPrivacy.allow_forward !== undefined
      ? (senderPrivacy.allow_forward !== 0 && senderPrivacy.allow_forward !== false)
      : (senderPrivacy.forwardProtection !== undefined
          ? !senderPrivacy.forwardProtection
          : (senderPrivacy.allowForward !== undefined ? !!senderPrivacy.allowForward : true));

    const blockScreenshotSetting = !!(senderPrivacy.block_screenshot || senderPrivacy.screenshotProtection || senderPrivacy.blockScreenshots);
    const blurRecordingSetting = !!(senderPrivacy.blur_screen_recording || senderPrivacy.screenRecordingProtection || senderPrivacy.blurScreenRecording);

    // Effective permission determination
    const canCopy = !isDeleted && allowCopySetting;
    const canForward = !isDeleted && allowForwardSetting;
    const canEdit = isSender && !isDeleted && timeDiffMins <= 15;
    const canDeleteForEveryone = isSender && !isDeleted && timeDiffMins <= 15;
    const canDeleteForMe = true;
    const canReply = !isDeleted;
    const canReact = !isDeleted;
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
      requiresSecureWindow,

      // Layered UI vs Security Separation
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
