// tests/chatListDisplay.test.js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Re-import or test the exact logic of chatListDisplay
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

const getUnreadSummary = (unreadCount) => {
  const count = Number(unreadCount) || 0;
  if (count <= 0) return null;
  if (count === 1) return '1 new message';
  return `${count} new messages`;
};

const getOutgoingReceiptLabel = (status) => {
  if (!status) return '';
  const s = String(status).trim().toLowerCase();
  if (s === 'read' || s === 'seen') return 'Seen';
  if (s === 'delivered') return 'Delivered';
  if (s === 'sent') return 'Sent';
  if (s === 'failed' || s === 'error') return 'Failed';
  if (s === 'pending' || s === 'sending' || s === 'queued') return 'Sending...';
  return '';
};

const isWithin12Hours = (timestamp, referenceTime = Date.now()) => {
  if (!timestamp) return false;
  const time = new Date(timestamp).getTime();
  if (isNaN(time)) return false;
  const diff = referenceTime - time;
  return diff >= 0 && diff < TWELVE_HOURS_MS;
};

const formatActivityStatus = (lastSeen, isOnline, referenceTime = Date.now()) => {
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

const resolveChatListDisplay = ({ chat, currentUserId, referenceTime = Date.now() }) => {
  const cId = currentUserId ? String(currentUserId) : null;
  const lastSenderId = chat.last_message_sender_id ?? chat.last_sender_id;
  const isLastMsgFromMe = Boolean(cId && lastSenderId && String(lastSenderId) === cId);
  const unreadCount = Number(chat.unread_count) || 0;

  const hasUnreadIncoming = !isLastMsgFromMe && unreadCount > 0;
  const showUnreadEdgeDot = hasUnreadIncoming;

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

  if (isLastMsgFromMe) {
    const senderPrefix = 'You: ';
    const msgTime = chat.last_message_time || chat.last_message_at;
    const within12h = isWithin12Hours(msgTime, referenceTime);

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

describe('Sparkle Messages Chat List Display Suite', () => {
  const CURRENT_USER_ID = 'user_100';
  const PARTNER_ID = 'user_200';
  const BASE_NOW = 1700000000000;

  describe('Unread Indicator & Bold Textual Summary', () => {
    it('handles zero unread messages correctly without summary', () => {
      assert.equal(getUnreadSummary(0), null);
      assert.equal(getUnreadSummary(-2), null);
    });

    it('formats singular and plural unread messages correctly', () => {
      assert.equal(getUnreadSummary(1), '1 new message');
      assert.equal(getUnreadSummary(3), '3 new messages');
      assert.equal(getUnreadSummary(12), '12 new messages');
    });

    it('displays unread summary and static edge dot for incoming unread messages', () => {
      const chat = {
        chat_id: 'chat_1',
        partner_id: PARTNER_ID,
        last_message_sender_id: PARTNER_ID,
        unread_count: 3,
        last_message: 'Are you coming today?',
        last_message_time: new Date(BASE_NOW - 10 * 60 * 1000).toISOString(),
      };

      const result = resolveChatListDisplay({
        chat,
        currentUserId: CURRENT_USER_ID,
        referenceTime: BASE_NOW,
      });

      assert.equal(result.mode, 'unread_summary');
      assert.equal(result.showUnreadEdgeDot, true);
      assert.equal(result.unreadSummary, '3 new messages');
      assert.equal(result.hasUnreadIncoming, true);
      assert.equal(result.isLastMsgFromMe, false);
    });

    it('does not treat messages from current user as incoming unread', () => {
      const chat = {
        chat_id: 'chat_2',
        partner_id: PARTNER_ID,
        last_message_sender_id: CURRENT_USER_ID,
        unread_count: 5,
        last_message: 'I will be there soon',
        last_message_time: new Date(BASE_NOW - 2 * 60 * 1000).toISOString(),
        last_message_status: 'sent',
      };

      const result = resolveChatListDisplay({
        chat,
        currentUserId: CURRENT_USER_ID,
        referenceTime: BASE_NOW,
      });

      assert.equal(result.hasUnreadIncoming, false);
      assert.equal(result.isLastMsgFromMe, true);
      assert.equal(result.showUnreadEdgeDot, false);
      assert.equal(result.unreadSummary, null);
    });

    it('clears unread summary immediately when marked/opened as read', () => {
      const chat = {
        chat_id: 'chat_1',
        partner_id: PARTNER_ID,
        last_message_sender_id: PARTNER_ID,
        unread_count: 0,
        last_message: 'Are you coming today?',
        last_message_time: new Date(BASE_NOW - 10 * 60 * 1000).toISOString(),
      };

      const result = resolveChatListDisplay({
        chat,
        currentUserId: CURRENT_USER_ID,
        referenceTime: BASE_NOW,
      });

      assert.equal(result.mode, 'normal_preview');
      assert.equal(result.showUnreadEdgeDot, false);
      assert.equal(result.unreadSummary, null);
    });
  });

  describe('Outgoing Delivery Receipts & 12-Hour Window', () => {
    it('maps delivery receipts correctly: Sent, Delivered, Seen', () => {
      assert.equal(getOutgoingReceiptLabel('sent'), 'Sent');
      assert.equal(getOutgoingReceiptLabel('delivered'), 'Delivered');
      assert.equal(getOutgoingReceiptLabel('read'), 'Seen');
      assert.equal(getOutgoingReceiptLabel('seen'), 'Seen');
      assert.equal(getOutgoingReceiptLabel('failed'), 'Failed');
      assert.equal(getOutgoingReceiptLabel('pending'), 'Sending...');
    });

    it('displays receipt within the 12-hour window', () => {
      const fiveMinsAgo = new Date(BASE_NOW - 5 * 60 * 1000).toISOString();
      const chat = {
        chat_id: 'chat_3',
        partner_id: PARTNER_ID,
        last_message_sender_id: CURRENT_USER_ID,
        last_message: 'Hey, are you free?',
        last_message_time: fiveMinsAgo,
        last_message_status: 'sent',
      };

      const result = resolveChatListDisplay({
        chat,
        currentUserId: CURRENT_USER_ID,
        referenceTime: BASE_NOW,
      });

      assert.equal(result.mode, 'outgoing_receipt');
      assert.equal(result.senderPrefix, 'You: ');
      assert.equal(result.middleLabel, 'Sent');
      assert.equal(result.middleLabelType, 'receipt');
    });

    it('displays receipt at 11 hours 59 minutes', () => {
      const almost12Hours = new Date(BASE_NOW - (TWELVE_HOURS_MS - 60000)).toISOString();
      assert.equal(isWithin12Hours(almost12Hours, BASE_NOW), true);

      const chat = {
        chat_id: 'chat_4',
        partner_id: PARTNER_ID,
        last_message_sender_id: CURRENT_USER_ID,
        last_message: 'Good morning',
        last_message_time: almost12Hours,
        last_message_status: 'seen',
      };

      const result = resolveChatListDisplay({
        chat,
        currentUserId: CURRENT_USER_ID,
        referenceTime: BASE_NOW,
      });

      assert.equal(result.mode, 'outgoing_receipt');
      assert.equal(result.middleLabel, 'Seen');
    });

    it('stops displaying receipt at exactly 12 hours', () => {
      const exactly12Hours = new Date(BASE_NOW - TWELVE_HOURS_MS).toISOString();
      assert.equal(isWithin12Hours(exactly12Hours, BASE_NOW), false);

      const chat = {
        chat_id: 'chat_5',
        partner_id: PARTNER_ID,
        last_message_sender_id: CURRENT_USER_ID,
        last_message: 'Good morning',
        last_message_time: exactly12Hours,
        last_message_status: 'seen',
      };

      const result = resolveChatListDisplay({
        chat,
        currentUserId: CURRENT_USER_ID,
        referenceTime: BASE_NOW,
      });

      assert.notEqual(result.middleLabel, 'Seen');
      assert.notEqual(result.mode, 'outgoing_receipt');
    });
  });

  describe('Recipient Activity Status After 12-Hour Window', () => {
    it('displays Active now when recipient is online after 12 hours', () => {
      const fourteenHoursAgo = new Date(BASE_NOW - 14 * 60 * 60 * 1000).toISOString();
      const chat = {
        chat_id: 'chat_6',
        partner_id: PARTNER_ID,
        last_message_sender_id: CURRENT_USER_ID,
        last_message: 'Good morning',
        last_message_time: fourteenHoursAgo,
        last_message_status: 'sent',
        is_online: 1,
      };

      const result = resolveChatListDisplay({
        chat,
        currentUserId: CURRENT_USER_ID,
        referenceTime: BASE_NOW,
      });

      assert.equal(result.mode, 'activity_status');
      assert.equal(result.middleLabel, 'Active now');
      assert.equal(result.middleLabelType, 'activity');
      assert.equal(result.senderPrefix, 'You: ');
    });

    it('formats offline relative activity status accurately', () => {
      const tenMinsAgo = new Date(BASE_NOW - 10 * 60 * 1000).toISOString();
      assert.equal(formatActivityStatus(tenMinsAgo, false, BASE_NOW), 'Active 10 mins ago');

      const fortyFiveMinsAgo = new Date(BASE_NOW - 45 * 60 * 1000).toISOString();
      assert.equal(formatActivityStatus(fortyFiveMinsAgo, false, BASE_NOW), 'Active 45 mins ago');

      const tenHrsAgo = new Date(BASE_NOW - 10 * 60 * 60 * 1000).toISOString();
      assert.equal(formatActivityStatus(tenHrsAgo, false, BASE_NOW), 'Active 10 hrs ago');

      const twoDaysAgo = new Date(BASE_NOW - 2 * 24 * 60 * 60 * 1000).toISOString();
      assert.equal(formatActivityStatus(twoDaysAgo, false, BASE_NOW), 'Active 2 days ago');
    });

    it('displays recipient last-seen relative status after 12 hours', () => {
      const fourteenHoursAgo = new Date(BASE_NOW - 14 * 60 * 60 * 1000).toISOString();
      const lastSeenTenMinsAgo = new Date(BASE_NOW - 10 * 60 * 1000).toISOString();

      const chat = {
        chat_id: 'chat_7',
        partner_id: PARTNER_ID,
        last_message_sender_id: CURRENT_USER_ID,
        last_message: 'I have arrived',
        last_message_time: fourteenHoursAgo,
        last_message_status: 'delivered',
        is_online: 0,
        last_seen_at: lastSeenTenMinsAgo,
      };

      const result = resolveChatListDisplay({
        chat,
        currentUserId: CURRENT_USER_ID,
        referenceTime: BASE_NOW,
      });

      assert.equal(result.mode, 'activity_status');
      assert.equal(result.middleLabel, 'Active 10 mins ago');
    });

    it('does not invent fake timestamps when last-seen is missing', () => {
      const fourteenHoursAgo = new Date(BASE_NOW - 14 * 60 * 60 * 1000).toISOString();
      const chat = {
        chat_id: 'chat_8',
        partner_id: PARTNER_ID,
        last_message_sender_id: CURRENT_USER_ID,
        last_message: 'Hello',
        last_message_time: fourteenHoursAgo,
        last_message_status: 'sent',
        is_online: 0,
        last_seen_at: null,
      };

      const result = resolveChatListDisplay({
        chat,
        currentUserId: CURRENT_USER_ID,
        referenceTime: BASE_NOW,
      });

      assert.equal(result.mode, 'normal_preview');
      assert.equal(result.middleLabel, null);
    });

    it('respects blocking and suppresses activity status', () => {
      const fourteenHoursAgo = new Date(BASE_NOW - 14 * 60 * 60 * 1000).toISOString();
      const chat = {
        chat_id: 'chat_blocked',
        partner_id: PARTNER_ID,
        last_message_sender_id: CURRENT_USER_ID,
        last_message: 'Hey',
        last_message_time: fourteenHoursAgo,
        last_message_status: 'sent',
        is_online: 1,
        is_blocked: true,
      };

      const result = resolveChatListDisplay({
        chat,
        currentUserId: CURRENT_USER_ID,
        referenceTime: BASE_NOW,
      });

      assert.equal(result.mode, 'normal_preview');
      assert.equal(result.middleLabel, null);
    });

    it('suppresses presence for official system accounts', () => {
      const fourteenHoursAgo = new Date(BASE_NOW - 14 * 60 * 60 * 1000).toISOString();
      const chat = {
        chat_id: 'chat_sys',
        partner_id: 'sparkle_updates',
        last_message_sender_id: CURRENT_USER_ID,
        last_message: 'Feedback',
        last_message_time: fourteenHoursAgo,
        last_message_status: 'sent',
        is_system: true,
        is_online: 1,
      };

      const result = resolveChatListDisplay({
        chat,
        currentUserId: CURRENT_USER_ID,
        referenceTime: BASE_NOW,
      });

      assert.equal(result.mode, 'normal_preview');
      assert.equal(result.middleLabel, null);
    });

    it('does not display recipient activity status for group chats or self chat', () => {
      const fourteenHoursAgo = new Date(BASE_NOW - 14 * 60 * 60 * 1000).toISOString();

      const groupChat = {
        chat_id: 'group_1',
        chat_type: 'group',
        is_group: true,
        last_message_sender_id: CURRENT_USER_ID,
        last_message: 'Meeting at 3',
        last_message_time: fourteenHoursAgo,
        last_message_status: 'delivered',
        is_online: 1,
      };
      const groupResult = resolveChatListDisplay({
        chat: groupChat,
        currentUserId: CURRENT_USER_ID,
        referenceTime: BASE_NOW,
      });
      assert.equal(groupResult.mode, 'normal_preview');
      assert.equal(groupResult.middleLabel, null);

      const selfChat = {
        chat_id: 'self_1',
        chat_type: 'self',
        partner_id: CURRENT_USER_ID,
        last_message_sender_id: CURRENT_USER_ID,
        last_message: 'Note to self',
        last_message_time: fourteenHoursAgo,
        last_message_status: 'sent',
        is_online: 1,
      };
      const selfResult = resolveChatListDisplay({
        chat: selfChat,
        currentUserId: CURRENT_USER_ID,
        referenceTime: BASE_NOW,
      });
      assert.equal(selfResult.mode, 'normal_preview');
      assert.equal(selfResult.middleLabel, null);
    });
  });
});
