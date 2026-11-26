import { describe, it, expect, vi, beforeEach } from 'vitest';

const getNotifications = vi.fn();
const getUnreadCount = vi.fn();
const markReadApi = vi.fn();
const markAllReadApi = vi.fn();
vi.mock('../../api/api', () => ({
  notificationsApi: {
    getNotifications: (...a: unknown[]) => getNotifications(...a),
    getUnreadCount: () => getUnreadCount(),
    markRead: (id: string) => markReadApi(id),
    markAllRead: () => markAllReadApi(),
  },
}));

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null; }
  setItem(k: string, v: string) { this.store.set(k, String(v)); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
}
vi.stubGlobal('localStorage', new MemoryStorage());

const { useNotificationStore } = await import('../notificationStore');

import type { SparkleNotification } from '../../types/notification';

const notif = (over: Partial<SparkleNotification> = {}): SparkleNotification => ({
  id: 'n1',
  type: 'social',
  senderId: 'u1',
  title: 'New spark',
  body: 'Someone sparked your post',
  icon: 'spark',
  entities: [],
  actions: [],
  priority: 'normal',
  category: 'social',
  isOfficial: false,
  isRead: false,
  createdAt: '2026-11-01T00:00:00Z',
  ...over,
} as SparkleNotification);

const state = () => useNotificationStore.getState();

describe('notification store — dedup, cache, optimistic read', () => {
  beforeEach(() => {
    localStorage.clear();
    useNotificationStore.setState({
      notifications: [], unreadCount: 0, lastSyncAt: null,
      loading: false, hasMore: true, page: 1,
    });
    getNotifications.mockReset().mockResolvedValue({ data: [] });
    getUnreadCount.mockReset().mockResolvedValue({ data: { unreadCount: 0 } });
    markReadApi.mockReset().mockResolvedValue({});
    markAllReadApi.mockReset().mockResolvedValue({});
  });

  it('deduplicates by id when a page repeats an item', async () => {
    getNotifications.mockResolvedValue({ data: [notif(), notif({ id: 'n2' }), notif()] });

    await state().fetchNotifications(true);

    const ids = state().notifications.map((n) => n.id);
    expect(ids).toEqual(['n1', 'n2']);
  });

  it('appends a later page and tracks hasMore by the 20-item page size', async () => {
    getNotifications.mockResolvedValueOnce({ data: [notif()] });
    await state().fetchNotifications(true);

    const many = Array.from({ length: 20 }, (_, i) => notif({ id: `p2-${i}` }));
    getNotifications.mockResolvedValueOnce({ data: many });
    await state().fetchNotifications(false);

    expect(state().notifications).toHaveLength(21);
    expect(state().hasMore).toBe(true);
    expect(getNotifications).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, limit: 20 }));
  });

  it('caches the first page and stamps lastSyncAt for offline loads', async () => {
    getNotifications.mockResolvedValue({ data: [notif()] });
    await state().fetchNotifications(true);

    const cached = JSON.parse(localStorage.getItem('sparkle_notif_cached_list') || '[]');
    expect(cached).toHaveLength(1);
    expect(localStorage.getItem('sparkle_notif_last_sync_at')).toBe(state().lastSyncAt);
  });

  it('hydrates unreadCount from the server, not the cache', async () => {
    getNotifications.mockResolvedValue({ data: [notif()] });
    getUnreadCount.mockResolvedValue({ data: { unreadCount: 7 } });
    await state().fetchNotifications(true);
    expect(state().unreadCount).toBe(7);
  });

  it('fetchDelta merges new-first and computes unread locally', async () => {
    useNotificationStore.setState({ notifications: [notif()], lastSyncAt: '2026-11-01T00:00:00Z' });
    getNotifications.mockResolvedValue({ data: [notif({ id: 'n2', isRead: false }), notif({ id: 'n3', isRead: true })] });

    await state().fetchDelta();

    expect(state().notifications[0].id).toBe('n2');
    expect(state().notifications).toHaveLength(3);
    expect(state().unreadCount).toBe(2);
    expect(localStorage.getItem('sparkle_notif_last_sync_at')).toBe(state().lastSyncAt);
  });

  it('markRead is optimistic and never drives the count below zero', async () => {
    useNotificationStore.setState({ notifications: [notif()], unreadCount: 0 });
    await state().markRead('n1');

    expect(state().notifications[0].isRead).toBe(true);
    expect(state().unreadCount).toBe(0);
    expect(markReadApi).toHaveBeenCalledWith('n1');
  });

  it('markRead rolls back when the server rejects', async () => {
    markReadApi.mockRejectedValue(new Error('offline'));
    useNotificationStore.setState({
      notifications: [notif(), notif({ id: 'n2' })],
      unreadCount: 2,
    });

    await state().markRead('n1');

    expect(state().notifications.find((n) => n.id === 'n1')!.isRead).toBe(false);
    expect(state().unreadCount).toBe(2);
  });

  it('markAllRead is optimistic and rolls back the whole list on failure', async () => {
    useNotificationStore.setState({
      notifications: [notif(), notif({ id: 'n2' })],
      unreadCount: 2,
    });
    markAllReadApi.mockRejectedValue(new Error('offline'));

    await state().markAllRead();

    expect(state().notifications.every((n) => !n.isRead)).toBe(true);
    expect(state().unreadCount).toBe(2);
  });

  it('addNotification prepends, dedups, and only counts unread', () => {
    useNotificationStore.setState({ notifications: [notif()], unreadCount: 1 });

    state().addNotification(notif({ id: 'n2', isRead: false }));
    expect(state().notifications[0].id).toBe('n2');
    expect(state().unreadCount).toBe(2);

    state().addNotification(notif({ id: 'n3', isRead: true }));
    expect(state().unreadCount).toBe(2);

    state().addNotification(notif({ id: 'n1', isRead: false })); // repeat id
    expect(state().notifications).toHaveLength(3);
  });

  it('survives a corrupt localStorage cache', async () => {
    localStorage.setItem('sparkle_notif_cached_list', '{not json');
    getNotifications.mockResolvedValue({ data: [notif()] });
    await expect(state().fetchNotifications(true)).resolves.toBeUndefined();
  });

  it('clears loading when a fetch fails', async () => {
    getNotifications.mockRejectedValue(new Error('offline'));
    await state().fetchNotifications(true);
    expect(state().loading).toBe(false);
  });
});