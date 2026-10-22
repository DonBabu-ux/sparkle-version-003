import { describe, it, expect, vi } from 'vitest';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) {
    return this.store.has(k) ? this.store.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.store.set(k, String(v));
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
  key(i: number) {
    return [...this.store.keys()][i] ?? null;
  }
  get length() {
    return this.store.size;
  }
}
vi.stubGlobal('localStorage', new MemoryStorage());

const { useChatStore } = await import('../chatStore');

const msg = (over: Record<string, unknown> = {}) => ({
  message_id: 'm1',
  sender_id: 'u1',
  sender_name: 'U',
  content: 'hello',
  type: 'text',
  status: 'sent',
  ...over,
});

describe('addMessage duplicate merge (socket echo path)', () => {
  it('merges an incoming status upgrade without throwing', () => {
    useChatStore.getState().addMessage('c1', msg());
    expect(() =>
      useChatStore
        .getState()
        .addMessage('c1', msg({ status: 'delivered', delivered_at: '2026-10-05T00:00:00Z' }))
    ).not.toThrow();

    const msgs = useChatStore.getState().messagesByConversation['c1'];
    expect(msgs).toHaveLength(1);
    expect(msgs[0].status).toBe('delivered');
    expect(msgs[0].delivered_at).toBe('2026-10-05T00:00:00Z');
  });

  it('never downgrades a status', () => {
    useChatStore.getState().addMessage('c2', msg({ message_id: 'm2', status: 'read', is_read: true }));
    useChatStore.getState().addMessage('c2', msg({ message_id: 'm2', status: 'sent' }));

    const msgs = useChatStore.getState().messagesByConversation['c2'];
    expect(msgs).toHaveLength(1);
    expect(msgs[0].status).toBe('read');
    expect(msgs[0].is_read).toBe(true);
  });

  it('preserves reply details when merging existing messages', () => {
    useChatStore.getState().addMessage('c3', msg({
      message_id: 'm3',
      reply_to_message_id: 'parent1',
      reply_content: 'parent message content',
      reply_sender_name: 'Alice',
      reply_type: 'text'
    }));

    // Socket ACK or echo arrives without reply fields
    useChatStore.getState().addMessage('c3', msg({
      message_id: 'm3',
      status: 'delivered'
    }));

    const msgs = useChatStore.getState().messagesByConversation['c3'];
    expect(msgs).toHaveLength(1);
    expect(msgs[0].status).toBe('delivered');
    expect(msgs[0].reply_to_message_id).toBe('parent1');
    expect(msgs[0].reply_content).toBe('parent message content');
    expect(msgs[0].reply_sender_name).toBe('Alice');
  });

  it('maintains strict chronological sequence ordering', async () => {
    const { sortMessagesChronologically } = await import('../chatStore');

    const mSeq2 = msg({ message_id: 'm-seq2', server_sequence: 2, created_at: '2026-10-05T00:00:02Z' });
    const mSeq1 = msg({ message_id: 'm-seq1', server_sequence: 1, created_at: '2026-10-05T00:00:01Z' });
    const mSeq3 = msg({ message_id: 'm-seq3', server_sequence: 3, created_at: '2026-10-05T00:00:03Z' });
    const mOptimistic = msg({ message_id: 'm-opt', server_sequence: null, created_at: '2026-10-05T00:00:04Z' });

    const sorted = sortMessagesChronologically([mSeq3, mOptimistic, mSeq1, mSeq2]);
    expect(sorted.map((m: any) => m.message_id)).toEqual(['m-seq1', 'm-seq2', 'm-seq3', 'm-opt']);
  });
});

