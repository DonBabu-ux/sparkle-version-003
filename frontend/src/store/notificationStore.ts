import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { SparkleNotification, NotificationCategory, NotificationPriority } from '../types/notification';
import { notificationsApi } from '../api/api';
import { logger } from '../utils/logger';

interface NotificationState {
  notifications: SparkleNotification[];
  unreadCount: number;
  lastSyncAt: string | null;
  loading: boolean;
  hasMore: boolean;
  page: number;

  // Actions
  fetchNotifications: (reset?: boolean, category?: NotificationCategory, priority?: NotificationPriority) => Promise<void>;
  fetchDelta: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  addNotification: (notification: SparkleNotification) => void;
  setNotifications: (list: SparkleNotification[]) => void;
}

const STORAGE_KEY_LAST_SYNC = 'sparkle_notif_last_sync_at';
const STORAGE_KEY_CACHED_NOTIFS = 'sparkle_notif_cached_list';

export const useNotificationStore = create<NotificationState>()(
  devtools((set, get) => {
    // Helper to load cached state
    const getCachedNotifications = (): SparkleNotification[] => {
      try {
        const cached = localStorage.getItem(STORAGE_KEY_CACHED_NOTIFS);
        return cached ? JSON.parse(cached) : [];
      } catch (e) {
        return [];
      }
    };

    const getCachedLastSync = (): string | null => {
      return localStorage.getItem(STORAGE_KEY_LAST_SYNC);
    };

    return {
      notifications: getCachedNotifications(),
      unreadCount: 0,
      lastSyncAt: getCachedLastSync(),
      loading: false,
      hasMore: true,
      page: 1,

      setNotifications: (list) => {
        set({ notifications: list });
        try {
          localStorage.setItem(STORAGE_KEY_CACHED_NOTIFS, JSON.stringify(list));
        } catch (e) {}
      },

      fetchNotifications: async (reset = false, category, priority) => {
        if (get().loading) return;
        set({ loading: true });

        const targetPage = reset ? 1 : get().page;
        try {
          const params = {
            page: targetPage,
            limit: 20,
            category,
            priority,
          };

          const { data } = await notificationsApi.getNotifications(params);
          
          let newNotifications = reset ? data : [...get().notifications, ...data];
          // Deduplicate by ID
          const uniqueMap = new Map<string, SparkleNotification>();
          newNotifications.forEach((n: SparkleNotification) => uniqueMap.set(n.id, n));
          const deduplicated = Array.from(uniqueMap.values());

          set({
            notifications: deduplicated,
            hasMore: data.length === 20,
            page: targetPage + 1,
            loading: false,
          });

          // Save to local storage cache (only first page for offline load)
          if (reset && !category && !priority) {
            localStorage.setItem(STORAGE_KEY_CACHED_NOTIFS, JSON.stringify(deduplicated.slice(0, 40)));
            const nowIso = new Date().toISOString();
            set({ lastSyncAt: nowIso });
            localStorage.setItem(STORAGE_KEY_LAST_SYNC, nowIso);
          }
          
          // Refresh unread count
          const countRes = await notificationsApi.getUnreadCount();
          set({ unreadCount: countRes.data.unreadCount });
        } catch (err) {
          logger.error('Failed to fetch notifications:', err);
          set({ loading: false });
        }
      },

      fetchDelta: async () => {
        const since = get().lastSyncAt;
        if (!since) {
          return get().fetchNotifications(true);
        }

        try {
          const { data } = await notificationsApi.getNotifications({ since });
          if (data && data.length > 0) {
            const currentList = get().notifications;
            const uniqueMap = new Map<string, SparkleNotification>();
            
            // Put new ones first, then current ones
            data.forEach((n: SparkleNotification) => uniqueMap.set(n.id, n));
            currentList.forEach((n: SparkleNotification) => {
              if (!uniqueMap.has(n.id)) {
                uniqueMap.set(n.id, n);
              }
            });

            const merged = Array.from(uniqueMap.values());
            // Compute unread count locally — no extra HTTP round-trip needed
            const unreadCount = merged.filter((n: SparkleNotification) => !n.isRead).length;
            set({ notifications: merged, unreadCount });
            localStorage.setItem(STORAGE_KEY_CACHED_NOTIFS, JSON.stringify(merged.slice(0, 40)));
          }

          const nowIso = new Date().toISOString();
          set({ lastSyncAt: nowIso });
          localStorage.setItem(STORAGE_KEY_LAST_SYNC, nowIso);
        } catch (err) {
          logger.error('Failed to fetch notification deltas:', err);
        }
      },

      markRead: async (id) => {
        // Optimistic update
        const originalList = get().notifications;
        const updatedList = originalList.map((n) =>
          n.id === id ? { ...n, isRead: true } : n
        );
        set({
          notifications: updatedList,
          unreadCount: Math.max(0, get().unreadCount - 1),
        });

        try {
          await notificationsApi.markRead(id);
        } catch (err) {
          logger.error(`Failed to mark notification ${id} as read:`, err);
          // Rollback if error
          set({
            notifications: originalList,
            unreadCount: originalList.filter((n) => !n.isRead).length,
          });
        }
      },

      markAllRead: async () => {
        // Optimistic update
        const originalList = get().notifications;
        const updatedList = originalList.map((n) => ({ ...n, isRead: true }));
        set({
          notifications: updatedList,
          unreadCount: 0,
        });

        try {
          await notificationsApi.markAllRead();
        } catch (err) {
          logger.error('Failed to mark all notifications as read:', err);
          // Rollback
          set({
            notifications: originalList,
            unreadCount: originalList.filter((n) => !n.isRead).length,
          });
        }
      },

      addNotification: (notification) => {
        const uniqueMap = new Map<string, SparkleNotification>();
        uniqueMap.set(notification.id, notification);
        get().notifications.forEach((n) => {
          if (!uniqueMap.has(n.id)) {
            uniqueMap.set(n.id, n);
          }
        });

        const merged = Array.from(uniqueMap.values());
        set({
          notifications: merged,
          unreadCount: get().unreadCount + (notification.isRead ? 0 : 1),
        });
        
        try {
          localStorage.setItem(STORAGE_KEY_CACHED_NOTIFS, JSON.stringify(merged.slice(0, 40)));
        } catch (e) {}
      },
    };
  })
);
