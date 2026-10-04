// backend/services/messagePermission.js
// Permission utilities for messaging actions.
// All functions assume a plain JavaScript object for user, message, and conversation.
// Adjust to your actual data models as needed.

/**
 * Determine if the current user can pin the given message.
 * Private chat: only the sender can pin their own message.
 * Group chat: users with role 'admin' or 'moderator' may pin any message.
 */
function canPinMessage(user, message, conversation) {
  if (!conversation) return false;
  // Private (direct) chat
  if (conversation.type === 'private') {
    return message.senderId === user.id;
  }
  // Group chat – check roles
  const allowedRoles = ['admin', 'moderator'];
  return allowedRoles.includes(user.role) || message.senderId === user.id;
}

/**
 * Determine if the user can edit the message.
 * Editable only by the sender within a 5‑minute window (frontend can enforce the timer).
 */
function canEditMessage(user, message) {
  if (message.senderId !== user.id) return false;
  // optional: enforce time window (5 minutes)
  const FIVE_MIN = 5 * 60 * 1000;
  const created = new Date(message.createdAt).getTime();
  const now = Date.now();
  return now - created <= FIVE_MIN;
}

/**
 * Delete for me – any participant can hide a message for themselves.
 */
function canDeleteForMe(user, message) {
  // All users can delete for themselves.
  return !!user && !!message;
}

/**
 * Delete for everyone – only the sender (or admins in a group) may remove the message globally.
 */
function canDeleteForEveryone(user, message, conversation) {
  if (!conversation) return false;
  if (message.senderId === user.id) return true;
  // In groups, admins/moderators can also delete any message.
  const allowedRoles = ['admin', 'moderator'];
  return allowedRoles.includes(user.role);
}

/**
 * React – any participant can react to a message.
 */
function canReactMessage(user, message) {
  return !!user && !!message;
}

/**
 * Forward – any participant can forward a message.
 */
function canForwardMessage(user, message) {
  return !!user && !!message;
}

module.exports = {
  canPinMessage,
  canEditMessage,
  canDeleteForMe,
  canDeleteForEveryone,
  canReactMessage,
  canForwardMessage,
};
