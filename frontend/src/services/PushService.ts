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

/** Deep link target from an FCM/local notification data payload. */
function urlFromData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (typeof d.url === 'string' && d.url.startsWith('/')) return d.url;
  if (d.type === 'message' && d.chatId) return `/messages?chat=${String(d.chatId)}`;
  if (d.conversationId) return `/marketplace/messages/${String(d.conversationId)}`;
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
  const type = data && typeof data === 'object' ? String((data as Record<string, unknown>).type || '') : '';
  const extra: Record<string, unknown> =
    data && typeof data === 'object' ? { ...(data as Record<string, unknown>) } : {};
  extra.url = urlFromData(data) || '';
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Date.now() % 1_000_000),
          title: title || 'Sparkle',
          body: body || '',
          channelId: channelForType(type),
          extra,
        },
      ],
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

      // Tap on a system-tray push (background → app).
      await PushNotifications.addListener('pushNotificationActionPerformed', (n) => {
        openUrl(urlFromData(n.notification?.data));
      });

      // Tap on a heads-up we scheduled ourselves while foregrounded.
      await LocalNotifications.addListener('localNotificationActionPerformed', (n) => {
        const extra = n.notification?.extra as Record<string, unknown> | undefined;
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
