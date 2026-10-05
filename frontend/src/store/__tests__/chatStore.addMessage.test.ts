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
});
