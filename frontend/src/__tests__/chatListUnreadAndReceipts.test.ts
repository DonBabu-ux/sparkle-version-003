import { describe, it, expect } from 'vitest';
import {
  getUnreadSummary,
  getOutgoingReceiptLabel,
  isWithin12Hours,
  formatActivityStatus,
  resolveChatListDisplay,
  TWELVE_HOURS_MS,
} from '../utils/chatListDisplay';

describe('Chat List Unread Indicators, Receipts & Activity Status', () => {
  const CURRENT_USER_ID = 'user_100';
  const PARTNER_ID = 'user_200';
  const BASE_NOW = 1700000000000; // Fixed reference timestamp

  describe('1. Unread State & Summary Formatting', () => {
    it('returns null unread summary for 0 unread messages', () => {
      expect(getUnreadSummary(0)).toBeNull();
      expect(getUnreadSummary(-1)).toBeNull();
    });

    it('returns singular "1 new message" for 1 unread message', () => {
      expect(getUnreadSummary(1)).toBe('1 new message');
    });

    it('returns plural "3 new messages" for 3 unread messages', () => {
      expect(getUnreadSummary(3)).toBe('3 new messages');
    });

    it('returns plural "12 new messages" for 12 unread messages', () => {
      expect(getUnreadSummary(12)).toBe('12 new messages');
    });

    it('displays unread summary and edge dot for incoming unread messages', () => {
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

      expect(result.mode).toBe('unread_summary');
      expect(result.showUnreadEdgeDot).toBe(true);
      expect(result.unreadSummary).toBe('3 new messages');
      expect(result.hasUnreadIncoming).toBe(true);
      expect(result.isLastMsgFromMe).toBe(false);
    });

    it('messages sent by current user never count as incoming unread', () => {
      const chat = {
        chat_id: 'chat_2',
        partner_id: PARTNER_ID,
        last_message_sender_id: CURRENT_USER_ID,
        unread_count: 5, // Even if corrupted or stale
        last_message: 'I will be there soon',
        last_message_time: new Date(BASE_NOW - 2 * 60 * 1000).toISOString(),
        last_message_status: 'sent',
      };

      const result = resolveChatListDisplay({
        chat,
        currentUserId: CURRENT_USER_ID,
        referenceTime: BASE_NOW,
      });

      expect(result.hasUnreadIncoming).toBe(false);
      expect(result.isLastMsgFromMe).toBe(true);
      expect(result.showUnreadEdgeDot).toBe(false);
      expect(result.unreadSummary).toBeNull();
    });

    it('clears unread summary and edge dot when conversation is opened/read', () => {
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

      expect(result.mode).toBe('normal_preview');
      expect(result.showUnreadEdgeDot).toBe(false);
      expect(result.unreadSummary).toBeNull();
      expect(result.hasUnreadIncoming).toBe(false);
    });
  });

  describe('2. Message Delivery Receipts & 12-Hour Window', () => {
    it('maps delivery statuses with correct precedence: Sent, Delivered, Seen', () => {
      expect(getOutgoingReceiptLabel('sent')).toBe('Sent');
      expect(getOutgoingReceiptLabel('delivered')).toBe('Delivered');
      expect(getOutgoingReceiptLabel('read')).toBe('Seen');
      expect(getOutgoingReceiptLabel('seen')).toBe('Seen');
      expect(getOutgoingReceiptLabel('failed')).toBe('Failed');
      expect(getOutgoingReceiptLabel('sending')).toBe('Sending...');
    });

    it('shows delivery receipts for outgoing messages sent within 12 hours', () => {
      const fiveMinsAgo = new Date(BASE_NOW - 5 * 60 * 1000).toISOString();
      const chatSent = {
        chat_id: 'chat_3',
        partner_id: PARTNER_ID,
        last_message_sender_id: CURRENT_USER_ID,
        last_message: 'Hey, are you free?',
        last_message_time: fiveMinsAgo,
        last_message_status: 'sent',
      };

      const resultSent = resolveChatListDisplay({
        chat: chatSent,
        currentUserId: CURRENT_USER_ID,
        referenceTime: BASE_NOW,
      });

      expect(resultSent.mode).toBe('outgoing_receipt');
      expect(resultSent.senderPrefix).toBe('You: ');
      expect(resultSent.middleLabel).toBe('Sent');
      expect(resultSent.middleLabelType).toBe('receipt');

      // Delivered
      const chatDelivered = { ...chatSent, last_message_status: 'delivered' };
      const resultDelivered = resolveChatListDisplay({
        chat: chatDelivered,
        currentUserId: CURRENT_USER_ID,
        referenceTime: BASE_NOW,
      });
      expect(resultDelivered.middleLabel).toBe('Delivered');

      // Seen
      const chatSeen = { ...chatSent, last_message_status: 'read' };
      const resultSeen = resolveChatListDisplay({
        chat: chatSeen,
        currentUserId: CURRENT_USER_ID,
        referenceTime: BASE_NOW,
      });
      expect(resultSeen.middleLabel).toBe('Seen');
    });

    it('receipt is visible at 11 hours 59 minutes', () => {
      const almost12Hours = new Date(BASE_NOW - (TWELVE_HOURS_MS - 60000)).toISOString();
      expect(isWithin12Hours(almost12Hours, BASE_NOW)).toBe(true);

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

      expect(result.mode).toBe('outgoing_receipt');
      expect(result.middleLabel).toBe('Seen');
    });

    it('receipt disappears at exactly 12 hours and does not reset on app refresh', () => {
      const exactly12Hours = new Date(BASE_NOW - TWELVE_HOURS_MS).toISOString();
      expect(isWithin12Hours(exactly12Hours, BASE_NOW)).toBe(false);

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

      // Receipt must NOT be shown
      expect(result.middleLabel).not.toBe('Seen');
      expect(result.mode).not.toBe('outgoing_receipt');
    });
  });

  describe('3. Recipient Activity Status After 12 Hours', () => {
    it('displays "Active now" when recipient is currently online after 12 hours', () => {
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

      expect(result.mode).toBe('activity_status');
      expect(result.middleLabel).toBe('Active now');
      expect(result.middleLabelType).toBe('activity');
      expect(result.senderPrefix).toBe('You: ');
    });

    it('formats offline relative activity status accurately', () => {
      // 10 mins ago
      const tenMinsAgo = new Date(BASE_NOW - 10 * 60 * 1000).toISOString();
      expect(formatActivityStatus(tenMinsAgo, false, BASE_NOW)).toBe('Active 10 mins ago');

      // 45 mins ago
      const fortyFiveMinsAgo = new Date(BASE_NOW - 45 * 60 * 1000).toISOString();
      expect(formatActivityStatus(fortyFiveMinsAgo, false, BASE_NOW)).toBe('Active 45 mins ago');

      // 10 hrs ago
      const tenHrsAgo = new Date(BASE_NOW - 10 * 60 * 60 * 1000).toISOString();
      expect(formatActivityStatus(tenHrsAgo, false, BASE_NOW)).toBe('Active 10 hrs ago');

      // 2 days ago
      const twoDaysAgo = new Date(BASE_NOW - 2 * 24 * 60 * 60 * 1000).toISOString();
      expect(formatActivityStatus(twoDaysAgo, false, BASE_NOW)).toBe('Active 2 days ago');
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

      expect(result.mode).toBe('activity_status');
      expect(result.middleLabel).toBe('Active 10 mins ago');
    });

    it('does not invent fake timestamps when last-seen is missing or recipient never online', () => {
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

      expect(result.mode).toBe('normal_preview');
      expect(result.middleLabel).toBeNull();
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

      expect(result.mode).toBe('normal_preview');
      expect(result.middleLabel).toBeNull();
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

      expect(result.mode).toBe('normal_preview');
      expect(result.middleLabel).toBeNull();
    });

    it('does not display recipient activity status for group chats or self chat', () => {
      const fourteenHoursAgo = new Date(BASE_NOW - 14 * 60 * 60 * 1000).toISOString();

      // Group chat
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
      expect(groupResult.mode).toBe('normal_preview');
      expect(groupResult.middleLabel).toBeNull();

      // Self chat
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
      expect(selfResult.mode).toBe('normal_preview');
      expect(selfResult.middleLabel).toBeNull();
    });
  });
});
