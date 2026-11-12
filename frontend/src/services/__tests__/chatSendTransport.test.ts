import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The four `send-message` emit sites in pages/Messages.tsx were rewired onto
 * transmitMessage(). These tests pin the reconciliation contract that used to
 * live in four slightly-different inline ack handlers:
 *
 *  - a successful ack swaps the client UUID for the server id and keeps the
 *    server's ordering key and timestamp;
 *  - a blocked conversation is NOT a delivery failure (no retry accrual, the
 *    thread flips to blocked);
 *  - an unacknowledged transmit always fails the bubble, via the 10s timer if
 *    the server never answers at all.
 */

const h = vi.hoisted(() => {
  const state: any = {
    messagesByConversation: {} as Record<string, any[]>,
    setMessages: vi.fn(),
    setConversationBlockState: vi.fn(),
  };
  return {
    state,
    queue: {
      startMessageTimeout: vi.fn(),
      clearMessageTimeout: vi.fn(),
      acknowledge: vi.fn(),
      markFailed: vi.fn(),
      markBlocked: vi.fn(),
    },
    getState: vi.fn(() => state),
    logger: { warn: vi.fn(), log: vi.fn(), error: vi.fn() },
  };
});

vi.mock('../PersistentOfflineQueue', () => ({ PersistentOfflineQueue: h.queue }));
vi.mock('../../store/chatStore', () => ({ useChatStore: { getState: h.getState } }));
vi.mock('../../utils/logger', () => ({ logger: h.logger }));

const { transmitMessage } = await import('../chatSendTransport');

/** Socket stub that hands the ack callback back to the test. */
function makeSocket(connected = true) {
  const acks: Array<(ack: any) => void> = [];
  const emits: Array<{ event: string; payload: any }> = [];
  const socket: any = {
    connected,
    emit: vi.fn((event: string, payload: any, ack?: (ack: any) => void) => {
      emits.push({ event, payload });
      if (ack) acks.push(ack);
    }),
  };
  return { socket, emits, acks };
}

function seedMessages(chatId: string, msgs: any[]) {
  h.state.messagesByConversation[chatId] = msgs;
}

/** Read back what the transport wrote into the store. */
function writtenMessages(chatId: string) {
  const call = h.state.setMessages.mock.calls.at(-1);
  return call && call[0] === chatId ? call[1] : null;
}

const CLIENT_ID = 'client-uuid-1';

beforeEach(() => {
  h.state.messagesByConversation = {};
  h.state.setMessages.mockReset();
  h.state.setConversationBlockState.mockReset();
  Object.values(h.queue).forEach((fn: any) => fn.mockReset());
  h.logger.warn.mockReset();
  h.logger.log.mockReset();
  h.logger.error.mockReset();
});

describe('transmitMessage — offline', () => {
  it('does not touch the socket and starts no timer', () => {
    const { socket, emits } = makeSocket(false);
    const outcome = transmitMessage(socket, { messageId: CLIENT_ID }, { clientMessageId: CLIENT_ID, chatId: 'chat-1' });

    expect(outcome).toBe('offline');
    expect(emits).toHaveLength(0);
    expect(h.queue.startMessageTimeout).not.toHaveBeenCalled();
  });

  it('treats a missing socket as offline', () => {
    expect(transmitMessage(null, {}, { clientMessageId: CLIENT_ID, chatId: 'chat-1' })).toBe('offline');
  });
});

describe('transmitMessage — acknowledged', () => {
  it('adopts the server message id, timestamp and ordering key', () => {
    const { socket, acks } = makeSocket();
    seedMessages('chat-1', [
      { message_id: CLIENT_ID, id: CLIENT_ID, status: 'sending', sent_at: 'local-time', content: 'hi' },
    ]);

    expect(transmitMessage(socket, {}, { clientMessageId: CLIENT_ID, chatId: 'chat-1' })).toBe('transmitted');
    acks.at(-1)!({ success: true, messageId: 'server-42', sentAt: 'server-time', server_sequence: 99 });

    const written = writtenMessages('chat-1');
    expect(written[0]).toMatchObject({
      message_id: 'server-42',
      id: 'server-42',
      status: 'sent',
      sent_at: 'server-time',
      server_sequence: 99,
    });
    // Removing the durable copy also clears the delivery timer.
    expect(h.queue.acknowledge).toHaveBeenCalledWith(CLIENT_ID);
  });

  it('merges caller-supplied fields (upload paths carry the final media URL)', () => {
    const { socket, acks } = makeSocket();
    seedMessages('chat-1', [{ message_id: CLIENT_ID, id: CLIENT_ID, status: 'sending', media_url: 'blob:x' }]);

    transmitMessage(socket, {}, {
      clientMessageId: CLIENT_ID,
      chatId: 'chat-1',
      ackFields: { media_url: 'https://cdn/final.png', mediaUrl: 'https://cdn/final.png' },
    });
    acks.at(-1)!({ success: true, messageId: 'server-7', sentAt: 'server-time', server_sequence: 3 });

    expect(writtenMessages('chat-1')[0]).toMatchObject({
      media_url: 'https://cdn/final.png',
      mediaUrl: 'https://cdn/final.png',
      status: 'sent',
    });
  });

  it('omits keys the server did not send rather than writing undefined over them', () => {
    const { socket, acks } = makeSocket();
    seedMessages('chat-1', [
      { message_id: CLIENT_ID, id: CLIENT_ID, status: 'sending', sent_at: 'local-time', server_sequence: 12 },
    ]);

    transmitMessage(socket, {}, { clientMessageId: CLIENT_ID, chatId: 'chat-1' });
    acks.at(-1)!({ success: true, messageId: 'server-9' });

    const written = writtenMessages('chat-1')[0];
    // The prior handler spread `sent_at: response.sentAt` unconditionally, so a
    // sparse ack wiped the local timestamp and the ordering key.
    expect(written.sent_at).toBe('local-time');
    expect(written.server_sequence).toBe(12);
    expect(Object.keys(written)).not.toContain('metadata');
  });

  it('does not adopt a success ack that carries no server message id', () => {
    const { socket, acks } = makeSocket();
    seedMessages('chat-1', [{ message_id: CLIENT_ID, id: CLIENT_ID, status: 'sending' }]);

    transmitMessage(socket, {}, { clientMessageId: CLIENT_ID, chatId: 'chat-1' });
    acks.at(-1)!({ success: true, sentAt: 'server-time' });

    expect(h.queue.acknowledge).not.toHaveBeenCalled();
    expect(h.queue.markFailed).toHaveBeenCalledWith(CLIENT_ID);
    expect(writtenMessages('chat-1')[0].status).toBe('failed');
  });

  it('runs the caller side effect after the reconciliation', () => {
    const { socket, acks } = makeSocket();
    const onAck = vi.fn();
    seedMessages('chat-1', [{ message_id: CLIENT_ID, id: CLIENT_ID, status: 'sending' }]);

    transmitMessage(socket, {}, { clientMessageId: CLIENT_ID, chatId: 'chat-1', onAck });
    acks.at(-1)!({ success: true, messageId: 'server-1', sentAt: 't', server_sequence: 1 });

    expect(onAck).toHaveBeenCalledTimes(1);
    expect(onAck.mock.calls[0][0]).toMatchObject({ messageId: 'server-1' });
  });
});

describe('transmitMessage — not acknowledged', () => {
  it('fails the bubble and records the attempt on the outbox ladder', () => {
    const { socket, acks } = makeSocket();
    seedMessages('chat-1', [{ message_id: CLIENT_ID, id: CLIENT_ID, status: 'sending' }]);

    transmitMessage(socket, {}, { clientMessageId: CLIENT_ID, chatId: 'chat-1' });
    acks.at(-1)!({ success: false, code: 'MESSAGE_ERROR', error: 'db down' });

    expect(h.queue.markFailed).toHaveBeenCalledWith(CLIENT_ID);
    // The timer must go, or it fires at 10s and double-counts this failure.
    expect(h.queue.clearMessageTimeout).toHaveBeenCalledWith(CLIENT_ID);
    expect(writtenMessages('chat-1')[0].status).toBe('failed');
  });

  it('fires the 10s timer so an unanswered emit still fails the bubble', () => {
    const { socket } = makeSocket();
    seedMessages('chat-1', [{ message_id: CLIENT_ID, id: CLIENT_ID, status: 'sending' }]);

    transmitMessage(socket, {}, { clientMessageId: CLIENT_ID, chatId: 'chat-1' });
    expect(h.queue.startMessageTimeout).toHaveBeenCalledTimes(1);

    // The server never answers: only the timer callback runs.
    const onTimeout = h.queue.startMessageTimeout.mock.calls[0][1];
    onTimeout();

    expect(writtenMessages('chat-1')[0].status).toBe('failed');
  });

  it('does not fail the bubble while it is merely queued for a retry', () => {
    const { socket } = makeSocket();
    seedMessages('chat-1', [{ message_id: CLIENT_ID, id: CLIENT_ID, status: 'sending' }]);

    transmitMessage(socket, {}, { clientMessageId: CLIENT_ID, chatId: 'chat-1' });
    // No ack yet — the bubble must still read 'sending', not 'failed'.
    expect(h.state.setMessages).not.toHaveBeenCalled();
  });
});

describe('transmitMessage — blocked conversation', () => {
  it.each([
    ['isBlocked flag', { success: false, isBlocked: true, error: 'You cannot message this user (blocked)' }],
    ['MESSAGE_BLOCKED code', { success: false, code: 'MESSAGE_BLOCKED', error: 'nope' }],
    ['error text', { success: false, error: 'conversation is blocked' }],
  ])('recognises a block via %s and never retries it', (_label, ack) => {
    const { socket, acks } = makeSocket();
    seedMessages('chat-1', [{ message_id: CLIENT_ID, id: CLIENT_ID, status: 'sending' }]);
    const onFailure = vi.fn();

    transmitMessage(socket, {}, { clientMessageId: CLIENT_ID, chatId: 'chat-1', onFailure });
    acks.at(-1)!(ack as any);

    expect(h.queue.markBlocked).toHaveBeenCalledWith(CLIENT_ID);
    expect(h.queue.markFailed).not.toHaveBeenCalled();
    expect(writtenMessages('chat-1')[0].status).toBe('blocked');
    expect(h.state.setConversationBlockState).toHaveBeenCalledWith('chat-1', {
      is_blocked: true,
      conversation_status: 'blocked',
      can_send_messages: false,
    });
    expect(onFailure).not.toHaveBeenCalled();
  });
});
