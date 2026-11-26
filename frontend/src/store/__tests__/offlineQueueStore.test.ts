import { describe, it, expect, vi, beforeEach } from 'vitest';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null; }
  setItem(k: string, v: string) { this.store.set(k, String(v)); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
  key(i: number) { return [...this.store.keys()][i] ?? null; }
  get length() { return this.store.size; }
}
vi.stubGlobal('localStorage', new MemoryStorage());

const apiPost = vi.fn();
const apiPut = vi.fn();
const apiDelete = vi.fn();
vi.mock('../../api/api', () => ({
  default: {
    post: (...a: unknown[]) => apiPost(...a),
    put: (...a: unknown[]) => apiPut(...a),
    delete: (...a: unknown[]) => apiDelete(...a),
  },
}));

const setOnline = (v: boolean) => {
  Object.defineProperty(navigator, 'onLine', { value: v, configurable: true });
};

const { useOfflineQueueStore } = await import('../offlineQueueStore');
import type { QueueAction } from '../offlineQueueStore';

const action = (over: Partial<Omit<QueueAction, 'id' | 'timestamp'>> = {}): Omit<QueueAction, 'id' | 'timestamp'> => ({
  type: 'LIKE_POST',
  payload: { post_id: 'p1' },
  endpoint: '/posts/p1/like',
  method: 'POST',
  ...over,
});

const state = () => useOfflineQueueStore.getState();
const reset = () => useOfflineQueueStore.setState({ queue: [], isProcessing: false });

describe('offline queue — ordering and replay rules', () => {
  beforeEach(() => {
    reset();
    setOnline(true);
    apiPost.mockReset().mockResolvedValue({});
    apiPut.mockReset().mockResolvedValue({});
    apiDelete.mockReset().mockResolvedValue({});
  });

  it('enqueues actions in order with an id and timestamp', () => {
    state().enqueueAction(action());
    state().enqueueAction(action({ type: 'COMMENT_POST', endpoint: '/posts/p1/comments', payload: { content: 'hi' } }));

    const q = state().queue;
    expect(q).toHaveLength(2);
    expect(q[0].id).toBeTruthy();
    expect(q[0].timestamp).toBeGreaterThan(0);
    expect(q[1].endpoint).toBe('/posts/p1/comments');
  });

  it('replays sequentially with the right verb per action', async () => {
    state().enqueueAction(action());
    state().enqueueAction(action({ method: 'PUT', endpoint: '/posts/p1', type: 'CREATE_POST' }));
    state().enqueueAction(action({ method: 'DELETE', endpoint: '/posts/p1', type: 'SEND_MESSAGE' }));

    await state().processQueue();

    expect(apiPost).toHaveBeenCalledWith('/posts/p1/like', { post_id: 'p1' });
    expect(apiPut).toHaveBeenCalledWith('/posts/p1', { post_id: 'p1' });
    expect(apiDelete).toHaveBeenCalledWith('/posts/p1', { data: { post_id: 'p1' } });
    expect(state().queue).toHaveLength(0);
    expect(state().isProcessing).toBe(false);
  });

  it('preserves order (create-then-comment) even when the second call is slower', async () => {
    const calls: string[] = [];
    apiPost.mockImplementation((url: string) => {
      calls.push(url);
      return url.endsWith('/comments')
        ? new Promise((r) => setTimeout(() => r({}), 5))
        : Promise.resolve({});
    });

    state().enqueueAction(action({ endpoint: '/posts', type: 'CREATE_POST' }));
    state().enqueueAction(action({ endpoint: '/posts/p1/comments', type: 'COMMENT_POST' }));

    await state().processQueue();
    expect(calls).toEqual(['/posts', '/posts/p1/comments']);
  });

  it('drops a permanently-failed action (4xx) and continues with the rest', async () => {
    apiPost
      .mockRejectedValueOnce({ response: { status: 400 } })
      .mockResolvedValueOnce({});

    state().enqueueAction(action({ endpoint: '/a' }));
    state().enqueueAction(action({ endpoint: '/b' }));

    await state().processQueue();

    expect(apiPost).toHaveBeenCalledTimes(2);
    expect(state().queue).toHaveLength(0);
  });

  it('stops the queue on a 5xx and retries the failed action later', async () => {
    apiPost.mockRejectedValueOnce({ response: { status: 503 } });

    state().enqueueAction(action({ endpoint: '/a' }));
    state().enqueueAction(action({ endpoint: '/b' }));
    await state().processQueue();

    expect(apiPost).toHaveBeenCalledTimes(1);
    // The failed action stays (it is retried, not dropped) and the rest of
    // the queue is untouched for this run.
    expect(state().queue.map((a) => a.endpoint)).toEqual(['/a', '/b']);
    expect(state().isProcessing).toBe(false);
  });

  it('stops the queue on a network error (no response) and retries later', async () => {
    apiPost.mockRejectedValueOnce(new Error('Network Error'));

    state().enqueueAction(action({ endpoint: '/a' }));
    state().enqueueAction(action({ endpoint: '/b' }));
    await state().processQueue();

    expect(state().queue).toHaveLength(2);
    expect(state().isProcessing).toBe(false);
  });

  it('does nothing while the device is offline', async () => {
    setOnline(false);
    state().enqueueAction(action());
    await state().processQueue();
    expect(apiPost).not.toHaveBeenCalled();
    expect(state().queue).toHaveLength(1);
  });

  it('refuses to run two replays at once', async () => {
    let release: (v: unknown) => void = () => {};
    apiPost.mockImplementation(() => new Promise((r) => { release = r; }));

    state().enqueueAction(action());
    const first = state().processQueue();
    await state().processQueue(); // second call must be a no-op
    expect(apiPost).toHaveBeenCalledTimes(1);

    release({});
    await first;
    expect(state().isProcessing).toBe(false);
  });

  it('removes and clears individual actions', () => {
    state().enqueueAction(action());
    state().enqueueAction(action({ endpoint: '/b' }));
    const [first] = state().queue;
    state().removeAction(first.id);
    expect(state().queue).toHaveLength(1);

    state().clearQueue();
    expect(state().queue).toHaveLength(0);
  });

  it('persists the queue but never the in-flight lock', () => {
    useOfflineQueueStore.setState({ isProcessing: true });
    // A crash mid-replay must not rehydrate a stuck lock that blocks forever.
    useOfflineQueueStore.getState().enqueueAction(action());
    const persisted = JSON.parse(localStorage.getItem('sparkle-offline-queue') || '{}');
    expect(persisted.state.isProcessing).toBeUndefined();
    expect(persisted.state.queue).toHaveLength(1);
  });
});