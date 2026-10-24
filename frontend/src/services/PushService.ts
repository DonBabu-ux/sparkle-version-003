import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import { logger } from '../utils/logger';
import { setupNativeNotificationChannels, channelForType } from './notificationChannels';

const FCM_TOKEN_KEY = 'sparkle_fcm_token';

let initialized = false;
let listenersReady = false;
let lastSyncKey: string | null = null;

/** Notification types that deserve a native heads-up while the app is open.
 *  Social events (likes/follows/comments) stay in the bell + in-app surface
 *  while foregrounded — the system tray takes over once the app is backgrounded. */
const FOREGROUND_HEADS_UP_TYPES = new Set(['message', 'marketplace_contact', 'call']);

// In-memory conversation aggregation for recent messages (Phase 3 & 4)
interface RecentMessageRecord {
  senderName: string;
  preview: string;
  timestamp: number;
}
const recentChatMessages = new Map<string, RecentMessageRecord[]>();

/**
 * Generate a deterministic, stable 31-bit positive integer ID for a chat notification.
 * Retries and consecutive messages from the same chat update the existing notification card.
 */
function getStableNotificationId(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 2_000_000_000 || 1;
}

const SUMMARY_NOTIFICATION_ID = 999_999_001;

/**
 * Clear notification(s) for a specific conversation when the user opens or reads it.
 */
export async function clearNotificationForChat(chatId: string): Promise<void> {
  if (!Capacitor.isNativePlatform() || !chatId) return;
  try {
    recentChatMessages.delete(chatId);
    const notifId = getStableNotificationId(`chat_${chatId}`);
    await LocalNotifications.cancel({ notifications: [{ id: notifId }] }).catch(() => {});
    
    // If no more active chat messages, dismiss summary notification as well
    if (recentChatMessages.size === 0) {
      await LocalNotifications.cancel({ notifications: [{ id: SUMMARY_NOTIFICATION_ID }] }).catch(() => {});
    }
  } catch (err) {
    logger.warn('[Push] clearNotificationForChat failed:', err);
  }
}

/** Deep link target from an FCM/local notification data payload. */
function urlFromData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;

  // Direct target URL property (e.g. url, action_url, link, targetUrl)
  if (typeof d.url === 'string' && d.url.startsWith('/')) return d.url;
  if (typeof d.action_url === 'string' && d.action_url.startsWith('/')) return d.action_url;
  if (typeof d.targetUrl === 'string' && d.targetUrl.startsWith('/')) return d.targetUrl;

  const type = String(d.type || '');
  const chatId = d.chatId || d.chat_id || d.conversationId || d.conversation_id;
  if ((type === 'message' || type === 'chat' || type === 'capture_attempt') && chatId) {
    return `/messages?chat=${String(chatId)}`;
  }
  if (d.conversationId) {
    return `/marketplace/messages/${String(d.conversationId)}`;
  }

  // Social / Post / Moments / Stories / Profile targets
  const postId = d.postId || d.post_id || d.related_id;
  if ((type === 'post' || type === 'like' || type === 'spark' || type === 'comment' || type === 'mention') && postId) {
    const commentId = d.commentId || d.comment_id;
    return `/post/${String(postId)}${commentId ? `?commentId=${String(commentId)}` : ''}`;
  }

  const momentId = d.momentId || d.moment_id;
  if ((type === 'moment' || type === 'moment_like' || type === 'moment_comment' || type === 'moment_spark') && (momentId || d.related_id)) {
    return `/moment/${String(momentId || d.related_id)}`;
  }

  const storyId = d.storyId || d.story_id;
  if ((type === 'story' || type === 'story_like' || type === 'story_view' || type === 'story_share') && (storyId || d.related_id)) {
    return `/story/${String(storyId || d.related_id)}`;
  }

  const userId = d.userId || d.user_id || d.actor_id || d.actor_username;
  if ((type === 'follow' || type === 'follow_request' || type === 'poke' || type === 'profile') && userId) {
    return `/profile/${String(userId)}`;
  }

  const listingId = d.listingId || d.listing_id || d.item_id;
  if (type === 'marketplace' && (listingId || d.related_id)) {
    return `/marketplace/listing/${String(listingId || d.related_id)}`;
  }

  const orderId = d.orderId || d.order_id;
  if (type === 'order' && (orderId || d.related_id)) {
    return `/orders/${String(orderId || d.related_id)}`;
  }

  const groupId = d.groupId || d.group_id;
  if ((type === 'group' || type === 'group_invite') && (groupId || d.related_id)) {
    return `/groups/${String(groupId || d.related_id)}`;
  }

  const confessionId = d.confessionId || d.confession_id;
  if (type === 'confession' && (confessionId || d.related_id)) {
    return `/confessions?id=${String(confessionId || d.related_id)}`;
  }

  return null;
}

/** Ask the app router (App.tsx listens for this) to navigate. */
function openUrl(url: string | null): void {
  if (!url || !url.startsWith('/')) return;
  window.dispatchEvent(new CustomEvent('sparkle:navigate', { detail: { url } }));
}

/** POST the cached device token for the CURRENT account (server reassigns
 *  the token to that account and detaches it from any other). */
async function registerToken(): Promise<void> {
  const authToken = useUserStore.getState().token;
  const fcmToken = typeof localStorage !== 'undefined' ? localStorage.getItem(FCM_TOKEN_KEY) : null;
  if (!authToken || !fcmToken) return;
  try {
    await api.post('/notifications/register-fcm-token', {
      token: fcmToken,
      deviceType: Capacitor.getPlatform(),
    });
    logger.log('[Push] FCM token registered for current account');
  } catch (err) {
    logger.warn('[Push] FCM token registration failed:', err);
  }
}

/** Detach this device's token from `authToken`'s account (best-effort).
 *  Called from userStore.logout with the OUTGOING session token captured
 *  before the store is cleared. */
export async function deregisterPushToken(authToken?: string | null): Promise<void> {
  const bearer = authToken ?? useUserStore.getState().token;
  let fcmToken: string | null = null;
  try {
    fcmToken = localStorage.getItem(FCM_TOKEN_KEY);
  } catch { /* storage unavailable */ }
  if (!bearer || !fcmToken) return;
  try {
    await api.post(
      '/notifications/deregister-fcm-token',
      { token: fcmToken },
      { headers: { Authorization: `Bearer ${bearer}` } }
    );
    logger.log('[Push] FCM token deregistered for outgoing session');
  } catch (err) {
    logger.warn('[Push] FCM token deregistration failed:', err);
  }
}

async function showForegroundHeadsUp(title: string | undefined, body: string | undefined, data: unknown): Promise<void> {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const type = String(d.type || '');
  const extra: Record<string, unknown> = { ...d };
  extra.url = urlFromData(data) || '';

  const chatId = String(d.chatId || d.conversationId || '');
  const senderName = String(d.senderName || title || 'Sparkle');
  const preview = String(d.preview || body || '');
  const senderAvatar = typeof d.senderAvatar === 'string' ? d.senderAvatar : undefined;
  const mediaImage = typeof d.image === 'string' ? d.image : undefined;

  // Track recent messages for this chat (keep up to 5)
  if (chatId) {
    const list = recentChatMessages.get(chatId) || [];
    list.push({ senderName, preview, timestamp: Date.now() });
    if (list.length > 5) list.shift();
    recentChatMessages.set(chatId, list);
  }

  const notificationId = chatId ? getStableNotificationId(`chat_${chatId}`) : Math.floor(Date.now() % 1_000_000);
  const unreadInChat = Number(d.unreadInChat) || (chatId && recentChatMessages.get(chatId)?.length) || 1;

  // Format inbox list preview lines for expanded Android layout
  const chatHistory = chatId ? recentChatMessages.get(chatId) || [] : [];
  const inboxList: string[] = chatHistory.map(m => `${m.senderName}: ${m.preview}`).slice(-5);

  let finalTitle = senderName;
  let finalBody = preview;
  if (unreadInChat > 1 && !finalBody.startsWith('(')) {
    finalBody = `(${unreadInChat}) ${preview}`;
  }

  try {
    const isChatMessage = type === 'message' || type === 'chat_message' || !type;
    const notificationsToSchedule: any[] = [
      {
        id: notificationId,
        title: finalTitle,
        body: finalBody,
        channelId: channelForType(type),
        smallIcon: 'ic_notification',
        iconColor: '#FF1493',
        largeIcon: senderAvatar || 'https://sparkleweb.app.vercel.app/logo.png',
        actionTypeId: isChatMessage ? 'SPARKLE_CHAT_ACTIONS' : undefined,
        group: 'sparkle_messages',
        inboxList: inboxList.length > 1 ? inboxList : undefined,
        attachments: mediaImage ? [{ id: 'media_preview', url: mediaImage }] : undefined,
        extra,
      }
    ];

    // If unread messages arrive across multiple chats, show/update the group summary notification
    if (recentChatMessages.size > 1) {
      const totalChats = recentChatMessages.size;
      let totalMsgs = 0;
      recentChatMessages.forEach(arr => { totalMsgs += arr.length; });
      notificationsToSchedule.push({
        id: SUMMARY_NOTIFICATION_ID,
        title: 'Sparkle Messages',
        body: `${totalMsgs} new messages from ${totalChats} chats`,
        channelId: 'messages',
        smallIcon: 'ic_notification',
        iconColor: '#FF1493',
        group: 'sparkle_messages',
        groupSummary: true,
        extra: { url: '/messages' }
      });
    }

    await LocalNotifications.schedule({
      notifications: notificationsToSchedule
    });
  } catch (err) {
    logger.warn('[Push] Foreground heads-up failed:', err);
  }
}

/**
 * Boot native push notifications (Android APK only):
 *  1. create the Sparkle notification channels,
 *  2. request POST_NOTIFICATIONS (Android 13+),
 *  3. wire foreground heads-up + tap-to-navigate listeners,
 *  4. obtain the FCM token and register it for the current account.
 *
 * Idempotent — safe to call from App's authenticated-boot effect.
 */
export async function initPushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform() || initialized) return;
  initialized = true;

  try {
    await setupNativeNotificationChannels();

    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') {
      logger.warn('[Push] Notification permission denied — push disabled for this session');
      return;
    }
    // Local heads-ups (foreground display) share POST_NOTIFICATIONS; ask so
    // the local plugin's own permission state is granted on Android 13+.
    await LocalNotifications.requestPermissions().catch(() => {});

    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: 'SPARKLE_CHAT_ACTIONS',
          actions: [
            {
              id: 'reply',
              title: 'Reply',
              input: true,
              inputButtonTitle: 'Send',
              inputPlaceholder: 'Type a message...',
            },
            {
              id: 'mark_read',
              title: 'Mark as read',
            },
          ],
        },
      ],
    }).catch(err => {
      logger.warn('[Push] Failed to register action types:', err);
    });

    if (!listenersReady) {
      listenersReady = true;

      await PushNotifications.addListener('registration', (t) => {
        if (!t?.value) return;
        try {
          localStorage.setItem(FCM_TOKEN_KEY, t.value);
        } catch { /* storage unavailable */ }
        void registerToken();
      });

      await PushNotifications.addListener('registrationError', (err) => {
        logger.warn('[Push] registrationError:', err);
      });

      // Foreground: system does NOT auto-display notification payloads —
      // surface message-ish events as a native heads-up ourselves.
      await PushNotifications.addListener('pushNotificationReceived', (n) => {
        const type = n.data ? String((n.data as Record<string, unknown>).type || '') : '';
        if (!FOREGROUND_HEADS_UP_TYPES.has(type)) return;
        void showForegroundHeadsUp(n.title, n.body, n.data);
      });

      // Tap or action on a system-tray push (background → app).
      await PushNotifications.addListener('pushNotificationActionPerformed', async (n) => {
        const data = (n.notification?.data || {}) as Record<string, unknown>;
        const actionId = (n as any).actionId;
        const inputValue = (n as any).inputValue;
        const chatId = String(data.chatId || data.conversationId || '');

        if (actionId === 'mark_read' && chatId) {
          try {
            await api.post(`/messages/read/${chatId}`);
          } catch (e) {
            logger.warn('[Push] Failed to mark as read from push notification:', e);
          }
          return;
        }

        if (actionId === 'reply' && chatId && inputValue?.trim()) {
          try {
            await api.post('/messages/send', {
              chatId,
              content: inputValue.trim(),
              type: 'text',
              partnerId: data.partnerId || data.senderId
            });
          } catch (e) {
            logger.warn('[Push] Failed to send quick reply from push notification:', e);
          }
          return;
        }

        openUrl(urlFromData(n.notification?.data));
      });

      // Tap or action on a heads-up / local notification.
      await LocalNotifications.addListener('localNotificationActionPerformed', async (n) => {
        const extra = (n.notification?.extra || {}) as Record<string, unknown>;
        const actionId = n.actionId;
        const inputValue = (n as any).inputValue;
        const chatId = String(extra.chatId || extra.conversationId || '');

        if (actionId === 'mark_read' && chatId) {
          try {
            await api.post(`/messages/read/${chatId}`);
            recentChatMessages.delete(chatId);
            const notifId = getStableNotificationId(`chat_${chatId}`);
            await LocalNotifications.cancel({ notifications: [{ id: notifId }] }).catch(() => {});
          } catch (e) {
            logger.warn('[Push] Failed to mark as read from local notification action:', e);
          }
          return;
        }

        if (actionId === 'reply' && chatId && inputValue?.trim()) {
          try {
            await api.post('/messages/send', {
              chatId,
              content: inputValue.trim(),
              type: 'text',
              partnerId: extra.partnerId || extra.senderId
            });
            const list = recentChatMessages.get(chatId) || [];
            list.push({ senderName: 'You', preview: inputValue.trim(), timestamp: Date.now() });
            recentChatMessages.set(chatId, list);
            const notifId = getStableNotificationId(`chat_${chatId}`);
            await LocalNotifications.cancel({ notifications: [{ id: notifId }] }).catch(() => {});
          } catch (e) {
            logger.warn('[Push] Failed to quick reply from local notification action:', e);
          }
          return;
        }

        openUrl(urlFromData(extra));
      });
    }

    // Resolves the (possibly cached) device token → `registration` event.
    await PushNotifications.register();
    // Belt: also POST immediately when a token is already cached from a
    // previous run and the registration event coalesces.
    await registerToken();
  } catch (err) {
    logger.warn('[Push] Native push initialization failed:', err);
  }
}

/**
 * Re-sync the device token whenever the authenticated account changes
 * (login, account switch, token rotation). Logout deregistration is handled
 * explicitly in userStore.logout/removeAccount. Returns an unsubscribe fn.
 */
export function startPushAuthSync(): () => void {
  lastSyncKey = null;
  return useUserStore.subscribe((state) => {
    const key = `${state.token || ''}|${state.activeAccountId || ''}`;
    if (key === lastSyncKey) return;
    lastSyncKey = key;
    // Only act when there is a live session (server upserts the token onto
    // this account and detaches it from any other — covers login + switch).
    if (!state.token || !state.isAuthenticated) return;
    void registerToken();
  });
}
