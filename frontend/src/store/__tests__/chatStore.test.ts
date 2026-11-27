// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useChatStore, getStatusRank, sortMessagesChronologically } from '../chatStore';
import { useUserStore } from '../userStore';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CLEAN = {
  conversations: [] as unknown[],
  activeConversationId: null as string | null,
  messagesByConversation: {} as Record<string, unknown[]>,
  chatPaging: {} as Record<string, unknown>,
  typingUsers: {} as Record<string, unknown[]>,
  drafts: {} as Record<string, string>,
  unreadCounts: {} as Record<string, number>,
  editing: {} as Record<string, unknown>,
  socketStatus: 'disconnected' as const,
  replyTargets: {} as Record<string, string>,
  onlineUsers: [] as string[],
  chatNicknames: {} as Record<string, Record<string, string>>,
};

const msg = (over: Record<string, unknown> = {}) => ({
  message_id: 'm1',
  sender_id: 'them',
  content: 'hello',
  created_at: '2026-11-01T00:00:00Z',
  status: 'sent',
  type: 'text',
  ...over,
});

const conv = (over: Record<string, unknown> = {}) => ({
  chat_id: 'c1',
  partner_id: 'u2',
  partner_name: 'They',
  partner_username: 'they',
  unread_count: 0,
  last_message_status: 'sent',
  is_archived: false,
  ...over,
});

const s = () => useChatStore.getState();

beforeEach(() => {
  useUserStore.setState({ user: { user_id: 'me', id: 'me' } as never });
  useChatStore.setState(CLEAN as never);
  localStorage.clear();
});

afterEach(() => {
  useChatStore.setState(CLEAN as never);
});

describe('chatStore — exported helpers', () => {
  it('ranks statuses from failed to read', () => {
    expect(getStatusRank('failed')).toBe(-1);
    expect(getStatusRank('error')).toBe(-1);
    expect(getStatusRank('pending')).toBe(1);
    expect(getStatusRank('sending')).toBe(1);
    expect(getStatusRank('sent')).toBe(2);
    expect(getStatusRank('delivered')).toBe(3);
    expect(getStatusRank('read')).toBe(4);
    expect(getStatusRank('seen')).toBe(4);
    expect(getStatusRank('')).toBe(0);
    expect(getStatusRank(null)).toBe(0);
    expect(getStatusRank('  READ ')).toBe(4);
  });

  it('sorts by server_sequence, then created_at, then id', () => {
    const a = { message_id: 'a', created_at: '2026-11-01T00:00:02Z', server_sequence: 5 };
    const b = { message_id: 'b', created_at: '2026-11-01T00:00:01Z', server_sequence: 9 };
    const c = { message_id: 'c', created_at: '2026-11-01T00:00:03Z' };

    expect(sortMessagesChronologically([a, b, c]).map((m) => m.message_id)).toEqual(['a', 'b', 'c']);
    expect(sortMessagesChronologically('not-an-array' as never)).toEqual([]);
  });
});

describe('chatStore — setMessages', () => {
  it('replaces the list wholesale, sorted chronologically', () => {
    s().setMessages('c1', [
      msg({ message_id: 'm2', created_at: '2026-11-01T00:00:02Z' }),
      msg({ message_id: 'm1', created_at: '2026-11-01T00:00:01Z' }),
    ]);

    const msgs = s().messagesByConversation.c1;
    expect(msgs).toHaveLength(2);
    expect(msgs.map((m) => m.message_id)).toEqual(['m1', 'm2']);
  });

  it('keeps locally deleted messages deleted on every reload', () => {
    s().setMessages('c1', [msg(), msg({ message_id: 'm2' })]);
    s().deleteMessageLocal('c1', 'm1');
    expect(s().messagesByConversation.c1).toHaveLength(1);

    // A refetch (e.g. reopening the chat) must not resurrect the deleted row.
    s().setMessages('c1', [msg(), msg({ message_id: 'm2' })]);
    expect(s().messagesByConversation.c1.map((m) => m.message_id)).toEqual(['m2']);
  });

  it('re-applies expired-message removals', () => {
    s().setMessages('c1', [msg(), msg({ message_id: 'm2' })]);
    s().removeExpiredMessages('c1', ['m1']);

    s().setMessages('c1', [msg(), msg({ message_id: 'm2' })]);
    expect(s().messagesByConversation.c1.map((m) => m.message_id)).toEqual(['m2']);
  });
});

describe('chatStore — addMessage tiers', () => {
  it('merges an exact-id match and never downgrades the status', () => {
    s().setMessages('c1', [msg({ status: 'sent' })]);

    s().addMessage('c1', msg({ status: 'delivered', delivered_at: 'T1' }));
    expect(s().messagesByConversation.c1[0].status).toBe('delivered');
    expect(s().messagesByConversation.c1).toHaveLength(1);

    // A late-arriving older event must not walk the status back.
    s().addMessage('c1', msg({ status: 'pending' }));
    expect(s().messagesByConversation.c1[0].status).toBe('delivered');
  });

  it('resolves an optimistic temp message with the server payload', () => {
    useChatStore.setState({ messagesByConversation: { c1: [] } });
    s().addMessage('c1', msg({ message_id: 'temp-1', sender_id: 'me', status: 'sending', content: 'my message' }));

    s().addMessage('c1', msg({ message_id: 'real-1', sender_id: 'me', status: 'sent', content: 'my message' }));

    const msgs = s().messagesByConversation.c1;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].message_id).toBe('real-1');
    expect(msgs[0].status).toBe('sent');
  });

  it('appends a genuinely new message in chronological order', () => {
    s().addMessage('c1', msg({ message_id: 'm2', created_at: '2026-11-01T00:00:05Z' }));
    s().addMessage('c1', msg({ message_id: 'm1', created_at: '2026-11-01T00:00:01Z' }));

    expect(s().messagesByConversation.c1.map((m) => m.message_id)).toEqual(['m1', 'm2']);
  });

  it('raises the conversation unread badge only for a background chat from someone else', () => {
    // addMessage writes the badge on the conversation row; the badge tab's
    // unreadCounts map is maintained by incrementUnreadCount (which the
    // socket handler calls separately). Both surfaces are asserted below.
    useChatStore.setState({ activeConversationId: 'c1', conversations: [conv(), conv({ chat_id: 'c2', partner_id: 'u3' })] });

    s().addMessage('c1', msg({ message_id: 'a1', sender_id: 'them' }));
    expect(s().conversations.find((c) => c.chat_id === 'c1')!.unread_count).toBe(0);

    s().addMessage('c2', msg({ message_id: 'b1', sender_id: 'them' }));
    expect(s().conversations.find((c) => c.chat_id === 'c2')!.unread_count).toBe(1);

    // My own message resets the background badge to zero (isFromMe -> 0).
    s().setDraft('c2', 'half-typed');
    s().addMessage('c2', msg({ message_id: 'b2', sender_id: 'me' }));
    expect(s().conversations.find((c) => c.chat_id === 'c2')!.unread_count).toBe(0);
    expect(s().drafts.c2).toBe('');

    // incrementUnreadCount keeps the badge map in step.
    s().incrementUnreadCount('c2');
    expect(s().unreadCounts.c2).toBe(1);
  });

  it('clears the draft when my own message lands', () => {
    s().setDraft('c1', 'half-typed thought');
    expect(s().drafts.c1).toBe('half-typed thought');

    s().addMessage('c1', msg({ sender_id: 'me' }));
    expect(s().drafts.c1).toBe('');

    // Someone else's message leaves the draft alone.
    s().setDraft('c1', 'still typing');
    s().addMessage('c1', msg({ sender_id: 'them' }));
    expect(s().drafts.c1).toBe('still typing');
  });
});

describe('chatStore — message edits and receipts', () => {
  it('editMessage stamps the edited flags', () => {
    s().setMessages('c1', [msg({ content: 'original' })]);
    s().editMessage('c1', 'm1', 'edited text');

    const m = s().messagesByConversation.c1[0];
    expect(m.content).toBe('edited text');
    expect(m.is_edited).toBe(true);
    expect(m.edited_at).toBeTruthy();
  });

  it('editMessage on an unknown id leaves the list untouched', () => {
    s().setMessages('c1', [msg({ content: 'original' })]);
    s().editMessage('c1', 'ghost', 'edited text');
    expect(s().messagesByConversation.c1[0].content).toBe('original');
  });

  it('the receipt ratchet never regresses', () => {
    s().setConversations([conv({ last_message_status: 'delivered' })]);

    s().updateConversationReceipt('c1', 'read', 'T1');
    expect(s().conversations[0].last_message_status).toBe('read');
    expect(s().conversations[0].last_read_at).toBe('T1');

    // A stale delivered event must not walk the row back.
    s().updateConversationReceipt('c1', 'delivered', 'T2');
    expect(s().conversations[0].last_message_status).toBe('read');
  });

  it('receipts match the conversation by chat_id or partner_id', () => {
    s().setConversations([conv()]);
    s().updateConversationReceipt('u2', 'read', 'T1');
    expect(s().conversations[0].last_message_status).toBe('read');
  });
});

describe('chatStore — read state and unread surfaces', () => {
  it('markRead marks incoming messages and clears the badge', () => {
    s().setMessages('c1', [msg({ sender_id: 'them' }), msg({ message_id: 'm2', sender_id: 'me' })]);
    s().incrementUnreadCount('c1');
    expect(s().unreadCounts.c1).toBe(1);

    s().markRead('c1', 'm1');

    const msgs = s().messagesByConversation.c1;
    expect(msgs.find((m) => m.message_id === 'm1')!.is_read).toBe(true);
    // Own message is never marked read.
    expect(Boolean(msgs.find((m) => m.message_id === 'm2')!.is_read)).toBe(false);
    expect(s().unreadCounts.c1).toBe(0);
    expect(s().conversations[0]?.unread_count).toBe(0);
  });

  it('unread counters write both the map and the conversation row', () => {
    s().setConversations([conv({ unread_count: 0 })]);

    s().incrementUnreadCount('c1');
    expect(s().unreadCounts.c1).toBe(1);
    expect(s().conversations[0].unread_count).toBe(1);

    s().toggleUnread('c1', false);
    expect(s().unreadCounts.c1).toBe(0);
    expect(s().conversations[0].unread_count).toBe(0);

    s().toggleUnread('c1', true);
    expect(s().unreadCounts.c1).toBe(1);
    expect(s().conversations[0].unread_count).toBe(1);

    s().clearUnreadCount('c1');
    expect(s().unreadCounts.c1).toBe(0);
    expect(s().conversations[0].unread_count).toBe(0);
  });
});

describe('chatStore — conversation metadata', () => {
  it('setConversations zeroes unread and backfills the partner name', () => {
    s().setConversations([conv({ unread_count: 7, partner_name: null }) as never]);

    expect(s().conversations[0].unread_count).toBe(0);
    expect(s().conversations[0].partner_name).toBe('they');
  });

  it('setConversations falls back to the generic partner name', () => {
    s().setConversations([conv({ partner_name: null, partner_username: null }) as never]);
    expect(s().conversations[0].partner_name).toBe('Sparkle User');
  });

  it('toggleArchive matches the chat_id exactly', () => {
    s().setConversations([conv()]);
    s().toggleArchive('c1', true);
    expect(s().conversations[0].is_archived).toBe(true);
  });

  it('toggleDelete removes the conversation and its messages', () => {
    s().setConversations([conv()]);
    s().setMessages('c1', [msg()]);

    s().toggleDelete('c1');

    expect(s().conversations).toHaveLength(0);
    expect(s().messagesByConversation.c1).toEqual([]);
  });

  it('drafts are per-chat', () => {
    s().setDraft('c1', 'a');
    s().setDraft('c2', 'b');
    expect(s().drafts).toEqual({ c1: 'a', c2: 'b' });
  });

  it('reactions add, update and remove', () => {
    s().setMessages('c1', [msg()]);
    s().addReaction('c1', 'm1', 'them', '🔥');
    expect(s().messagesByConversation.c1[0].reactions?.[0]).toMatchObject({ user_id: 'them', emoji: '🔥' });

    s().removeReaction('c1', 'm1', 'them', '🔥');
    expect(s().messagesByConversation.c1[0].reactions).toEqual([]);
  });

  it('nicknames and disappearing durations land on the conversation', () => {
    s().setConversations([conv()]);

    s().setChatNickname('c1', 'them', 'Bobby');
    expect(s().chatNicknames.c1.them).toBe('Bobby');

    s().setDisappearingDuration('c1', 86400, 3);
    expect((s().conversations[0] as unknown as { disappearing_duration: number }).disappearing_duration).toBe(86400);
    expect((s().conversations[0] as unknown as { disappearing_version: number }).disappearing_version).toBe(3);
  });

  it('setActiveConversationId tracks the open chat', () => {
    s().setActiveConversationId('c1');
    expect(s().activeConversationId).toBe('c1');
    s().setActiveConversationId(null);
    expect(s().activeConversationId).toBeNull();
  });

  it('persists only conversations and drafts (not the message bodies)', () => {
    const src = readFileSync(join(process.cwd(), 'src/store/chatStore.ts'), 'utf8');
    expect(src).toContain("name: 'sparkle-chat-storage'");
    expect(src).toMatch(/conversations: state\.conversations/);
    expect(src).toMatch(/drafts: state\.drafts/);
    expect(src).toMatch(/messagesByConversation is intentionally NOT persisted/);
  });
});