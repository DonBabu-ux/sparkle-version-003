// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => {
  const actionNames = [
    'setSocketStatus', 'addMessage', 'updateMessage', 'editMessage', 'deleteMessageForEveryone',
    'deleteMessageLocal', 'addReaction', 'removeReaction', 'updateConversationReceipt',
    'setConversations', 'removeExpiredMessages', 'setConversationBlockState',
    'updateSenderMessagePermissions', 'setDisappearingDuration', 'setChatNickname',
    'toggleArchive', 'toggleDelete', 'togglePin', 'toggleFavorite', 'togglePriority',
    'incrementUnreadCount',
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chat: Record<string, any> = {};
  for (const a of actionNames) chat[a] = vi.fn();
  chat.messagesByConversation = {};
  chat.conversations = [];
  chat.activeConversationId = null;

  const user = { user_id: 'me', id: 'me' };
  const transmit = vi.fn();
  const playSound = vi.fn();
  const getNotificationSound = vi.fn(() => null);
  const queue = {
    getPendingMessagesImmediate: vi.fn(() => [] as unknown[]),
    getDueInteractions: vi.fn(() => [] as unknown[]),
    acknowledgeInteraction: vi.fn(),
    markBlocked: vi.fn(),
  };
  const apiGet = vi.fn();
  const current = { socket: null as unknown };
  return { chat, user, transmit, playSound, getNotificationSound, queue, apiGet, current };
});

vi.mock('../useSocket', () => ({ useSocket: () => h.current.socket }));

vi.mock('../../store/chatStore', () => ({
  useChatStore: { getState: () => h.chat },
}));

vi.mock('../../store/userStore', () => ({
  useUserStore: { getState: () => ({ user: h.user }) },
}));

vi.mock('../../store/themeStore', () => ({
  useThemeStore: { getState: () => ({ getNotificationSound: h.getNotificationSound }) },
}));

vi.mock('../../audio/managers/AudioSessionManager', () => ({
  default: { playSound: (...a: unknown[]) => h.playSound(...a) },
}));

vi.mock('../../api/api', () => ({
  default: { get: (...a: unknown[]) => h.apiGet(...a) },
}));

vi.mock('../../services/PersistentOfflineQueue', () => ({
  default: h.queue,
}));

vi.mock('../../services/privacyReconcile', () => ({
  reconcilePrivacySettings: vi.fn(),
}));

vi.mock('../../services/chatSendTransport', () => ({
  transmitMessage: (...a: unknown[]) => h.transmit(...a),
}));

vi.mock('../../utils/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const { useMessageSocket } = await import('../useMessageSocket');
const { reconcilePrivacySettings } = await import('../../services/privacyReconcile');

type Handler = (payload?: unknown) => void;

const makeSocket = () => {
  const handlers = new Map<string, Handler[]>();
  const emitted: Array<{ event: string; payload: unknown; ack?: (res: unknown) => void }> = [];
  const offCalls: Array<{ event: string; handler: Handler }> = [];
  const socket = {
    connected: false,
    sessionId: 'sess-1',
    on(event: string, handler: Handler) {
      const list = handlers.get(event) || [];
      list.push(handler);
      handlers.set(event, list);
    },
    off(event: string, handler: Handler) {
      offCalls.push({ event, handler });
      handlers.set(event, (handlers.get(event) || []).filter((x) => x !== handler));
    },
    emit(event: string, payload: unknown, ack?: (res: unknown) => void) {
      emitted.push({ event, payload, ack });
    },
    handlers,
    emitted,
    offCalls,
    fire(event: string, payload?: unknown) {
      (handlers.get(event) || []).forEach((fn) => fn(payload));
    },
    // Fire connect and let the sync sequence finish by answering the
    // cursor-sync ack (socket.io always eventually acks).
    async connectAndSync() {
      this.fire('connect');
      await new Promise((r) => setTimeout(r, 0));
      this.answerLastAck({ success: true, messages: [] });
      await new Promise((r) => setTimeout(r, 0));
    },
    // Answer the last emit's ack callback (socket.io style).
    answerLastAck(response: unknown) {
      const last = emitted[emitted.length - 1];
      if (last?.ack) last.ack(response);
    },
    has(event: string) {
      return (handlers.get(event) || []).length > 0;
    },
    count(event: string) {
      return (handlers.get(event) || []).length;
    },
  };
  return socket;
};

const mount = () => renderHook(() => useMessageSocket());

beforeEach(() => {
  for (const key of Object.keys(h.chat)) {
    if (typeof h.chat[key] === 'function') h.chat[key].mockReset();
  }
  h.chat.messagesByConversation = {};
  h.chat.conversations = [];
  h.chat.activeConversationId = null;
  h.user.user_id = 'me';
  h.transmit.mockReset().mockImplementation((_socket, _item, opts) => {
    opts?.onSettled?.();
    return Promise.resolve();
  });
  h.playSound.mockReset();
  h.getNotificationSound.mockReset().mockReturnValue(null);
  h.queue.getPendingMessagesImmediate.mockReset().mockReturnValue([]);
  h.queue.getDueInteractions.mockReset().mockReturnValue([]);
  h.queue.acknowledgeInteraction.mockReset();
  h.queue.markBlocked.mockReset();
  h.apiGet.mockReset().mockResolvedValue({ data: [] });
  vi.mocked(reconcilePrivacySettings).mockReset();
});

afterEach(cleanup);

describe('useMessageSocket — listener lifecycle', () => {
  it('registers the realtime listeners on mount', () => {
    h.current.socket = makeSocket();
    mount();

    const s = h.current.socket as ReturnType<typeof makeSocket>;
    for (const event of ['connect', 'disconnect', 'new-message', 'receive_message', 'message-delivered-update', 'message-read-update', 'messages_expired', 'message-edited', 'message-deleted-everyone', 'new-reaction', 'sync-response', 'conversation_updated', 'conversation_blocked', 'sparkly-stream-chunk', 'live_location_started', 'chat:nickname_updated']) {
      expect(s.has(event), `${event} listener registered`).toBe(true);
    }
  });

  it('removes exactly the registered listeners on unmount', () => {
    h.current.socket = makeSocket();
    const s = h.current.socket as ReturnType<typeof makeSocket>;
    const { unmount } = mount();

    unmount();

    expect(s.offCalls.length).toBeGreaterThan(30);
    expect(s.count('new-message')).toBe(0);
    expect(s.count('connect')).toBe(0);
    expect(s.count('live_location_started')).toBe(0);
  });

  it('does nothing without a socket', () => {
    h.current.socket = null;
    expect(() => mount()).not.toThrow();
  });
});

describe('useMessageSocket — reconnect sync sequence', () => {
  it('flushes the outbox, syncs the delta cursor, and re-emits due interactions', async () => {
    const socket = makeSocket();
    socket.connected = true;
    h.current.socket = socket;
    h.queue.getPendingMessagesImmediate.mockReturnValue([
      { messageId: 'm1', chatId: 'c1', type: 'SEND_MESSAGE' },
      { messageId: 'm2', chatId: 'c1', type: 'SEND_MESSAGE' },
      { messageId: 'm3', chatId: 'c1', type: 'SEND_MESSAGE' },
      { messageId: 'm4', chatId: 'c2', type: 'SEND_MESSAGE' },
    ]);
    h.queue.getDueInteractions.mockReturnValue([{ type: 'LIKE_POST', messageId: 'm1' }]);
    h.chat.messagesByConversation = {
      c1: [{ server_sequence: 10 }, { server_sequence: 42 }],
      c2: [{ server_sequence: 7 }],
    };

    mount();
    await act(async () => { socket.fire('connect'); });
    await act(async () => {
      socket.answerLastAck({ success: true, messages: [{ conversation_id: 'c1', message_id: 'new-1' }] });
    });

    expect(h.transmit).toHaveBeenCalledTimes(4);
    expect(h.transmit.mock.calls[0][2]).toMatchObject({ clientMessageId: 'm1', chatId: 'c1' });

    const cursor = socket.emitted.find((e) => e.event === 'cursor-sync-request');
    expect(cursor?.payload).toEqual({ lastCursor: 42 });
    expect(socket.emitted.some((e) => e.event === 'LIKE_POST')).toBe(true);
    expect(h.chat.addMessage).toHaveBeenCalledWith('c1', { conversation_id: 'c1', message_id: 'new-1' });

    expect(h.chat.setSocketStatus).toHaveBeenCalledWith('connecting');
    expect(h.chat.setSocketStatus).toHaveBeenLastCalledWith('connected');
  });

  it('releases the latch so a later reconnect can sync again', async () => {
    const socket = makeSocket();
    socket.connected = true;
    h.current.socket = socket;

    mount();
    await act(async () => { await socket.connectAndSync(); });
    await act(async () => { await socket.connectAndSync(); });

    // Two full sequences ran (two cursor requests), so the latch cleared.
    expect(socket.emitted.filter((e) => e.event === 'cursor-sync-request')).toHaveLength(2);
  });

  it('completes even when socket.io drops the ack (onSettled releases the slot)', async () => {
    const socket = makeSocket();
    socket.connected = true;
    h.current.socket = socket;
    h.queue.getPendingMessagesImmediate.mockReturnValue([
      { messageId: 'm1', chatId: 'c1', type: 'SEND_MESSAGE' },
      { messageId: 'm2', chatId: 'c1', type: 'SEND_MESSAGE' },
      { messageId: 'm3', chatId: 'c1', type: 'SEND_MESSAGE' },
      { messageId: 'm4', chatId: 'c2', type: 'SEND_MESSAGE' },
    ]);
    // Simulate the transport settling without ever receiving the server ack.
    h.transmit.mockImplementation((_socket, _item, opts) => {
      opts?.onSettled?.();
      return Promise.resolve();
    });

    mount();
    await act(async () => { await socket.connectAndSync(); });

    // The sequence finished and the cursor advanced: no bricked sync latch.
    expect(socket.emitted.some((e) => e.event === 'cursor-sync-request')).toBe(true);
    expect(h.chat.setSocketStatus).toHaveBeenLastCalledWith('connected');
  });

  it('refuses to sync while disconnected', async () => {
    const socket = makeSocket();
    socket.connected = false;
    h.current.socket = socket;

    mount();
    await act(async () => { socket.fire('connect'); });

    expect(socket.emitted.some((e) => e.event === 'cursor-sync-request')).toBe(false);
    expect(h.queue.getPendingMessagesImmediate).not.toHaveBeenCalled();
  });

  it('syncs eagerly when the socket is already connected at mount', async () => {
    const socket = makeSocket();
    socket.connected = true;
    h.current.socket = socket;

    mount();
    await act(async () => { await socket.connectAndSync(); });

    expect(socket.emitted.some((e) => e.event === 'cursor-sync-request')).toBe(true);
  });

  it('reconciles privacy for the active conversation after a reconnect', async () => {
    const socket = makeSocket();
    socket.connected = true;
    h.current.socket = socket;
    h.chat.activeConversationId = 'c1';

    mount();
    await act(async () => { await socket.connectAndSync(); });

    expect(vi.mocked(reconcilePrivacySettings)).toHaveBeenCalledWith('c1');
  });

  it('online/focus/visibility events trigger a sync while connected', async () => {
    const socket = makeSocket();
    socket.connected = true;
    h.current.socket = socket;

    mount();
    await act(async () => { await socket.connectAndSync(); });
    const before = socket.emitted.filter((e) => e.event === 'cursor-sync-request').length;

    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await socket.connectAndSync();
    });
    expect(socket.emitted.filter((e) => e.event === 'cursor-sync-request').length).toBe(before + 1);

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await socket.connectAndSync();
    });
    expect(socket.emitted.filter((e) => e.event === 'cursor-sync-request').length).toBe(before + 2);
  });

  it('sets the disconnected status on disconnect', async () => {
    const socket = makeSocket();
    socket.connected = true;
    h.current.socket = socket;

    mount();
    await act(async () => { socket.fire('disconnect', 'transport close'); });

    expect(h.chat.setSocketStatus).toHaveBeenCalledWith('disconnected');
  });
});

describe('useMessageSocket — message events', () => {
  let socket: ReturnType<typeof makeSocket>;
  beforeEach(() => {
    socket = makeSocket();
    socket.connected = true;
    h.current.socket = socket;
  });

  it('adds an incoming message and acks delivery for someone else', async () => {
    mount();

    await act(async () => {
      socket.fire('new-message', { conversation_id: 'c1', message_id: 'x1', sender_id: 'them' });
    });

    expect(h.chat.addMessage).toHaveBeenCalledWith('c1', expect.objectContaining({ message_id: 'x1' }));
    expect(socket.emitted).toContainEqual(
      expect.objectContaining({ event: 'message-delivered-ack', payload: { messageId: 'x1', sessionId: 'sess-1' } })
    );
  });

  it('does not ack or sound my own message', async () => {
    mount();

    await act(async () => {
      socket.fire('new-message', { conversation_id: 'c1', message_id: 'x2', sender_id: 'me' });
    });

    expect(h.chat.addMessage).toHaveBeenCalled();
    expect(socket.emitted.some((e) => e.event === 'message-delivered-ack')).toBe(false);
    expect(h.playSound).not.toHaveBeenCalled();
  });

  it('raises the unread badge only for a background chat from someone else', async () => {
    h.chat.activeConversationId = 'c1';
    mount();

    await act(async () => {
      socket.fire('new-message', { conversation_id: 'c1', message_id: 'a', sender_id: 'them' });
    });
    expect(h.chat.incrementUnreadCount).not.toHaveBeenCalled();

    await act(async () => {
      socket.fire('new-message', { conversation_id: 'c2', message_id: 'b', sender_id: 'them' });
    });
    expect(h.chat.incrementUnreadCount).toHaveBeenCalledWith('c2');
  });

  it('plays the custom sound when one is configured', async () => {
    h.getNotificationSound.mockReturnValue('sparkle_pop');
    mount();

    await act(async () => {
      socket.fire('new-message', { conversation_id: 'c1', message_id: 'a', sender_id: 'them' });
    });

    expect(h.playSound).toHaveBeenCalledWith('sparkle_pop');
  });

  it('plays receive for the active chat and outchat otherwise', async () => {
    h.chat.activeConversationId = 'c1';
    mount();

    await act(async () => {
      socket.fire('new-message', { conversation_id: 'c1', message_id: 'a', sender_id: 'them' });
    });
    expect(h.playSound).toHaveBeenCalledWith('receive');

    h.playSound.mockClear();
    await act(async () => {
      socket.fire('new-message', { conversation_id: 'c2', message_id: 'b', sender_id: 'them' });
    });
    expect(h.playSound).toHaveBeenCalledWith('outchat');
  });

  it('stays silent for a muted conversation', async () => {
    h.chat.conversations = [{ chat_id: 'c1', is_muted: true }];
    mount();

    await act(async () => {
      socket.fire('new-message', { conversation_id: 'c1', message_id: 'a', sender_id: 'them' });
    });

    expect(h.playSound).not.toHaveBeenCalled();
  });

  it('marks my messages read on another reader, and ignores my own read', async () => {
    h.chat.messagesByConversation = {
      c1: [
        { message_id: 'm1', sender_id: 'me' },
        { message_id: 'm2', sender_id: 'them' },
      ],
    };
    mount();

    await act(async () => {
      socket.fire('message-read-update', { chatId: 'c1', readerUserId: 'them', readAt: 'T1' });
    });
    expect(h.chat.updateMessage).toHaveBeenCalledWith('c1', 'm1', expect.objectContaining({ status: 'read' }));
    expect(h.chat.updateMessage).not.toHaveBeenCalledWith('c1', 'm2', expect.anything());
    expect(h.chat.updateConversationReceipt).toHaveBeenCalledWith('c1', 'read', 'T1');

    h.chat.updateMessage.mockClear();
    await act(async () => {
      socket.fire('message-read-update', { chatId: 'c1', readerUserId: 'ME', readAt: 'T2' });
    });
    expect(h.chat.updateMessage).not.toHaveBeenCalled();
  });

  it('applies edits, deletes, reactions and pins', async () => {
    mount();

    await act(async () => {
      socket.fire('message-edited', { chatId: 'c1', messageId: 'm1', content: 'new text' });
    });
    expect(h.chat.editMessage).toHaveBeenCalledWith('c1', 'm1', 'new text');

    await act(async () => {
      socket.fire('message-deleted-everyone', { chatId: 'c1', messageId: 'm2' });
    });
    expect(h.chat.deleteMessageForEveryone).toHaveBeenCalledWith('c1', 'm2', 'This message was deleted');

    await act(async () => {
      socket.fire('message-deleted-me', { chatId: 'c1', messageId: 'm3' });
    });
    expect(h.chat.deleteMessageLocal).toHaveBeenCalledWith('c1', 'm3');

    await act(async () => {
      socket.fire('new-reaction', { chatId: 'c1', messageId: 'm4', userId: 'them', emoji: '🔥' });
    });
    expect(h.chat.addReaction).toHaveBeenCalledWith('c1', 'm4', 'them', '🔥');

    await act(async () => {
      socket.fire('message-pinned', { chatId: 'c1', messageId: 'm5', pinnedBy: 'them' });
    });
    expect(h.chat.updateMessage).toHaveBeenCalledWith('c1', 'm5', expect.objectContaining({ pinned: true }));
  });

  it('restores the original content when a delete is rejected', async () => {
    mount();
    await act(async () => {
      socket.fire('delete-rejected', { chatId: 'c1', messageId: 'm1', originalContent: 'keep me' });
    });
    expect(h.chat.editMessage).toHaveBeenCalledWith('c1', 'm1', 'keep me');
  });

  it('drops expired messages for the chat', async () => {
    mount();
    await act(async () => {
      socket.fire('messages_expired', { chatId: 'c1', messageIds: ['m1', 'm2'] });
    });
    expect(h.chat.removeExpiredMessages).toHaveBeenCalledWith('c1', ['m1', 'm2']);
  });

  it('replays the sync-response event log', async () => {
    mount();

    await act(async () => {
      socket.fire('sync-response', {
        chatId: 'c1',
        events: [
          { event_type: 'reaction_added', payload: JSON.stringify({ messageId: 'm1', userId: 'them', emoji: '🔥' }) },
          { event_type: 'message_edited', payload: { messageId: 'm2', content: 'edited' } },
          { event_type: 'message_pinned', payload: { messageId: 'm3' } },
        ],
      });
    });

    expect(h.chat.addReaction).toHaveBeenCalledWith('c1', 'm1', 'them', '🔥');
    expect(h.chat.editMessage).toHaveBeenCalledWith('c1', 'm2', 'edited');
    expect(h.chat.updateMessage).toHaveBeenCalledWith('c1', 'm3', expect.objectContaining({ pinned: true }));
  });
});

describe('useMessageSocket — conversation events', () => {
  let socket: ReturnType<typeof makeSocket>;
  beforeEach(() => {
    socket = makeSocket();
    socket.connected = true;
    h.current.socket = socket;
  });

  it('maps conversation_updated actions onto the store toggles', async () => {
    mount();

    const cases: Array<[string, string, string]> = [
      ['archived', 'toggleArchive', 'true'],
      ['pinned', 'togglePin', 'true'],
      ['favorited', 'toggleFavorite', 'true'],
      ['priority_on', 'togglePriority', 'true'],
      ['deleted', 'toggleDelete', 'noop'],
    ];
    for (const [action, actionName] of cases) {
      h.chat[actionName].mockClear();
      await act(async () => {
        socket.fire('conversation_updated', { chatId: 'c1', action });
      });
      expect(h.chat[actionName], action).toHaveBeenCalled();
    }
    expect(h.chat.toggleArchive).toHaveBeenCalledWith('c1', true);
    expect(h.chat.togglePin).toHaveBeenCalledWith('c1', true);
    expect(h.chat.toggleDelete).toHaveBeenCalledWith('c1');
  });

  it('sets the blocked state and announces it on window', async () => {
    const seen: string[] = [];
    const listener = (e: Event) => seen.push((e as CustomEvent).type);
    window.addEventListener('sparkle_conversation_blocked', listener);
    mount();

    await act(async () => {
      socket.fire('conversation_blocked', { chatId: 'c1', isBlockedByMe: true, amIBlocked: false });
    });

    expect(h.chat.setConversationBlockState).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ is_blocked: true, conversation_status: 'blocked', can_send_messages: false })
    );
    expect(seen).toContain('sparkle_conversation_blocked');
    window.removeEventListener('sparkle_conversation_blocked', listener);
  });

  it('marks the conversation blocked from a rejected send and parks the message', async () => {
    mount();

    await act(async () => {
      socket.fire('message-error', { chatId: 'c1', clientMessageId: 'tmp-1', code: 'MESSAGE_BLOCKED' });
    });

    expect(h.chat.updateMessage).toHaveBeenCalledWith('c1', 'tmp-1', expect.objectContaining({ status: 'blocked' }));
    expect(h.chat.setConversationBlockState).toHaveBeenCalled();
    expect(h.queue.markBlocked).toHaveBeenCalledWith('tmp-1');
  });

  it('acks both successful and failed queue operations off the persistent queue', async () => {
    mount();

    await act(async () => {
      socket.fire('operation-confirmed', { operationId: 'op-1' });
      socket.fire('operation-failed', { operationId: 'op-2' });
    });

    expect(h.queue.acknowledgeInteraction).toHaveBeenCalledWith('op-1');
    expect(h.queue.acknowledgeInteraction).toHaveBeenCalledWith('op-2');
  });

  it('re-dispatches live location events on window with the same detail', async () => {
    const seen: Array<{ type: string; detail: unknown }> = [];
    const listener = (e: Event) => seen.push({ type: e.type, detail: (e as CustomEvent).detail });
    window.addEventListener('sparkle_live_location_started', listener);
    mount();

    await act(async () => {
      socket.fire('live_location_started', { liveLocationId: 'l1', chatId: 'c1' });
    });

    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual({ type: 'sparkle_live_location_started', detail: { liveLocationId: 'l1', chatId: 'c1' } });
    window.removeEventListener('sparkle_live_location_started', listener);
  });

  it('applies disappearing-message and nickname updates', async () => {
    mount();

    await act(async () => {
      socket.fire('disappearing_messages_update', { chatId: 'c1', duration: 3600, version: 2 });
    });
    expect(h.chat.setDisappearingDuration).toHaveBeenCalledWith('c1', 3600, 2);

    await act(async () => {
      socket.fire('nickname_updated', { chatId: 'c1', targetUserId: 'them', nickname: 'Bobby' });
    });
    expect(h.chat.setChatNickname).toHaveBeenCalledWith('c1', 'them', 'Bobby');
  });

  it('refreshes the inbox list when a group is created', async () => {
    h.apiGet.mockResolvedValue({ data: { data: [{ chat_id: 'g1' }] } });
    mount();

    await act(async () => {
      socket.fire('new_group_created', { chatId: 'g1' });
    });

    expect(h.apiGet).toHaveBeenCalledWith('/messages/inbox');
    expect(h.chat.setConversations).toHaveBeenCalledWith([{ chat_id: 'g1' }]);
  });
});