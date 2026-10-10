/**
 * frontend/src/utils/chatListDisplay.ts
 *
 * Deterministic display rules for the Sparkle Messages chat list:
 * 1. Bold unread summary ("1 new message", "3 new messages") when incoming messages are unread.
 * 2. Static unread edge indicator without bounce/jump animations.
 * 3. Outgoing message receipts (Sent, Delivered, Seen) for the first 12 hours from message timestamp.
 * 4. Recipient activity status ("Active now", "Active 10 mins ago", etc.) after 12 hours when allowed.
 * 5. Calm fallback to normal message preview and relative timestamp.
 */

export const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

export interface ChatListDisplayParams {
  chat: any;
  currentUserId: string | number | null | undefined;
  referenceTime?: number;
}

export type ChatRowDisplayMode = 'unread_summary' | 'outgoing_receipt' | 'activity_status' | 'normal_preview';

export interface ChatListDisplayResult {
  mode: ChatRowDisplayMode;
  showUnreadEdgeDot: boolean;
  unreadSummary: string | null;
  senderPrefix: string;
  middleLabel: string | null;
  middleLabelType: 'receipt' | 'activity' | null;
  hasUnreadIncoming: boolean;
  isLastMsgFromMe: boolean;
}

/**
 * Returns a concise, grammatically correct unread summary:
 * - 0 unread: null
 * - 1 unread: "1 new message"
 * - 2+ unread: "X new messages"
 */
export const getUnreadSummary = (unreadCount: number): string | null => {
  const count = Number(unreadCount) || 0;
  if (count <= 0) return null;
  if (count === 1) return '1 new message';
  return `${count} new messages`;
};

/**
 * Resolves authoritative delivery status for outgoing messages:
 * Sent → Delivered → Seen
 */
export const getOutgoingReceiptLabel = (status?: string | null): string => {
  if (!status) return '';
  const s = String(status).trim().toLowerCase();
  if (s === 'read' || s === 'seen') return 'Seen';
  if (s === 'delivered') return 'Delivered';
  if (s === 'sent') return 'Sent';
  if (s === 'failed' || s === 'error') return 'Failed';
  if (s === 'pending' || s === 'sending' || s === 'queued') return 'Sending...';
  return '';
};

/**
 * Determines whether a message was sent within the last 12 hours.
 * Window is calculated strictly from the server-authoritative timestamp.
 */
export const isWithin12Hours = (
  timestamp?: string | Date | null,
  referenceTime: number = Date.now()
): boolean => {
  if (!timestamp) return false;
  const time = new Date(timestamp).getTime();
  if (isNaN(time)) return false;
  const diff = referenceTime - time;
  return diff >= 0 && diff < TWELVE_HOURS_MS;
};

/**
 * Formats recipient activity status with natural relative time:
 * - Online: "Active now"
 * - Offline within 1 min: "Active just now"
 * - Offline minutes: "Active 10 mins ago" (singular: "Active 1 min ago")
 * - Offline hours: "Active 10 hrs ago" (singular: "Active 1 hr ago")
 * - Offline days: "Active 2 days ago" (singular: "Active 1 day ago")
 * - Returns null if last-seen is missing or unavailable.
 */
export const formatActivityStatus = (
  lastSeen?: string | Date | null,
  isOnline?: boolean | number | null,
  referenceTime: number = Date.now()
): string | null => {
  if (Boolean(isOnline)) {
    return 'Active now';
  }

  if (!lastSeen) return null;
  const date = new Date(lastSeen);
  const time = date.getTime();
  if (isNaN(time)) return null;

  const diffMs = referenceTime - time;
  if (diffMs < 0) return 'Active just now';

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Active just now';
  if (diffMin === 1) return 'Active 1 min ago';
  if (diffMin < 60) return `Active ${diffMin} mins ago`;
  if (diffHr === 1) return 'Active 1 hr ago';
  if (diffHr < 24) return `Active ${diffHr} hrs ago`;
  if (diffDays === 1) return 'Active 1 day ago';
  if (diffDays < 30) return `Active ${diffDays} days ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return 'Active 1 month ago';
  if (diffMonths < 12) return `Active ${diffMonths} months ago`;

  const diffYears = Math.floor(diffDays / 365);
  if (diffYears === 1) return 'Active 1 year ago';
  return `Active ${diffYears} years ago`;
};

/**
 * Deterministic display resolution for a conversation row.
 */
export const resolveChatListDisplay = ({
  chat,
  currentUserId,
  referenceTime = Date.now(),
}: ChatListDisplayParams): ChatListDisplayResult => {
  const cId = currentUserId ? String(currentUserId) : null;
  const lastSenderId = chat.last_message_sender_id ?? chat.last_sender_id;
  const isLastMsgFromMe = Boolean(cId && lastSenderId && String(lastSenderId) === cId);
  const unreadCount = Number(chat.unread_count) || 0;

  // Incoming unread messages rule:
  // Messages sent by the current user must never count as incoming unread.
  const hasUnreadIncoming = !isLastMsgFromMe && unreadCount > 0;

  // Static edge indicator visibility strictly tracks incoming unread state.
  const showUnreadEdgeDot = hasUnreadIncoming;

  // 1. Priority: Incoming unread messages get bold unread summary
  if (hasUnreadIncoming) {
    return {
      mode: 'unread_summary',
      showUnreadEdgeDot: true,
      unreadSummary: getUnreadSummary(unreadCount),
      senderPrefix: '',
      middleLabel: null,
      middleLabelType: null,
      hasUnreadIncoming: true,
      isLastMsgFromMe: false,
    };
  }

  // 2. Outgoing message flow
  if (isLastMsgFromMe) {
    const senderPrefix = 'You: ';
    const msgTime = chat.last_message_time || chat.last_message_at;
    const within12h = isWithin12Hours(msgTime, referenceTime);

    // 2a. Within 12 hours: display delivery receipt (Sent, Delivered, Seen, Failed, Sending...)
    if (within12h) {
      const receiptLabel = getOutgoingReceiptLabel(chat.last_message_status);
      return {
        mode: receiptLabel ? 'outgoing_receipt' : 'normal_preview',
        showUnreadEdgeDot: false,
        unreadSummary: null,
        senderPrefix,
        middleLabel: receiptLabel || null,
        middleLabelType: receiptLabel ? 'receipt' : null,
        hasUnreadIncoming: false,
        isLastMsgFromMe: true,
      };
    }

    // 2b. After 12 hours: transition to recipient activity status when allowed
    const isPersonal = chat.chat_type !== 'group' && !chat.is_group;
    const isSelfChat = chat.chat_type === 'self' || (cId && String(chat.partner_id) === cId);
    const isSys = Boolean(chat.is_system || chat.is_system_account);
    const isBlocked = Boolean(chat.is_blocked || chat.is_blocked_by_me || chat.am_i_blocked);

    if (isPersonal && !isSelfChat && !isSys && !isBlocked) {
      const isOnline = chat.is_online || chat.partner_online;
      const activityLabel = formatActivityStatus(chat.last_seen_at, isOnline, referenceTime);

      if (activityLabel) {
        return {
          mode: 'activity_status',
          showUnreadEdgeDot: false,
          unreadSummary: null,
          senderPrefix,
          middleLabel: activityLabel,
          middleLabelType: 'activity',
          hasUnreadIncoming: false,
          isLastMsgFromMe: true,
        };
      }
    }

    // 2c. Fallback for older outgoing message when no activity info is available
    return {
      mode: 'normal_preview',
      showUnreadEdgeDot: false,
      unreadSummary: null,
      senderPrefix,
      middleLabel: null,
      middleLabelType: null,
      hasUnreadIncoming: false,
      isLastMsgFromMe: true,
    };
  }

  // 3. Normal incoming message (already read or unread === 0)
  return {
    mode: 'normal_preview',
    showUnreadEdgeDot: false,
    unreadSummary: null,
    senderPrefix: '',
    middleLabel: null,
    middleLabelType: null,
    hasUnreadIncoming: false,
    isLastMsgFromMe: false,
  };
};
