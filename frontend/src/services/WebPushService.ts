import { Capacitor } from '@capacitor/core';
import api from '../api/api';
import { useUserStore } from '../store/userStore';
import { logger } from '../utils/logger';

const SW_PATH = '/sw.js';

let registrationPromise: Promise<ServiceWorkerRegistration> | null = null;
let vapidKeyPromise: Promise<string> | null = null;

export type WebPushResult = 'subscribed' | 'denied' | 'unsupported' | 'failed';

export function isWebPushSupported(): boolean {
  if (Capacitor.isNativePlatform()) return false;
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function getRegistration(): Promise<ServiceWorkerRegistration> {
  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker.register(SW_PATH).catch((err) => {
      registrationPromise = null;
      throw err;
    });
  }
  return registrationPromise;
}

function getVapidKey(): Promise<string> {
  if (!vapidKeyPromise) {
    vapidKeyPromise = api
      .get('/notifications/vapid-public-key')
      .then(({ data }) => {
        const key = data?.key;
        if (!key) throw new Error('VAPID public key unavailable');
        return key as string;
      })
      .catch((err) => {
        vapidKeyPromise = null;
        throw err;
      });
  }
  return vapidKeyPromise;
}

async function createSubscription(
  registration: ServiceWorkerRegistration
): Promise<PushSubscription> {
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;
  const applicationServerKey = urlBase64ToUint8Array(await getVapidKey());
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });
}

async function persistSubscription(subscription: PushSubscription): Promise<void> {
  await api.post('/notifications/subscribe', subscription.toJSON());
}

export async function enableWebPush(): Promise<WebPushResult> {
  if (!isWebPushSupported()) return 'unsupported';
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';
    const registration = await getRegistration();
    const subscription = await createSubscription(registration);
    await persistSubscription(subscription);
    logger.log('[WebPush] subscribed');
    return 'subscribed';
  } catch (err) {
    logger.warn('[WebPush] subscribe failed:', err);
    return 'failed';
  }
}

export async function disableWebPush(): Promise<void> {
  if (!isWebPushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) await subscription.unsubscribe();
    logger.log('[WebPush] unsubscribed');
  } catch (err) {
    logger.warn('[WebPush] unsubscribe failed:', err);
  }
}

export async function ensureWebPushSubscription(): Promise<void> {
  if (!isWebPushSupported()) return;
  if (Notification.permission !== 'granted') return;
  const state = useUserStore.getState();
  if (!state.token || !state.isAuthenticated) return;
  const pref = state.user?.push_notifications_enabled ?? state.user?.push_notifications;
  if (pref === 0) return;
  try {
    const registration = await getRegistration();
    const subscription = await createSubscription(registration);
    await persistSubscription(subscription);
    logger.log('[WebPush] subscription ensured');
  } catch (err) {
    logger.warn('[WebPush] ensure failed:', err);
  }
}

export async function deregisterWebPush(authToken?: string | null): Promise<void> {
  if (!isWebPushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    const bearer = authToken || useUserStore.getState().token;
    if (bearer) {
      await api.delete('/notifications/subscribe', {
        data: { endpoint },
        headers: { Authorization: `Bearer ${bearer}` },
      });
    }
    logger.log('[WebPush] deregistered for outgoing session');
  } catch (err) {
    logger.warn('[WebPush] deregister failed:', err);
  }
}

export function startWebPushAuthSync(): () => void {
  let lastKey: string | null = null;
  return useUserStore.subscribe((state) => {
    const key = `${state.token || ''}|${state.activeAccountId || ''}`;
    if (key === lastKey) return;
    lastKey = key;
    if (!state.token || !state.isAuthenticated) return;
    void ensureWebPushSubscription();
  });
}
