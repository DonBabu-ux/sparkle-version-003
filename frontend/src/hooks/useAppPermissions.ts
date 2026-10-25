import { useEffect, useRef } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Camera } from '@capacitor/camera';
import { useUserStore } from '../store/userStore';
import { logger } from '../utils/logger';

const STORAGE_KEY = 'sparkle_app_permissions_v1';

type GrantState = 'granted' | 'denied' | 'unavailable';

/**
 * One-time, app-open permission pass.
 *
 * Messaging surfaces (camera, voice notes, uploads), stories, calls and push
 * all need the SAME handful of permissions. Requesting them piecemeal at
 * point-of-use produced mid-chat system dialogs at the worst moments. This
 * asks once — shortly after the first authenticated boot — and never again:
 * the flag is written even when the user declines, so denials are respected
 * and every surface falls back to its in-context explanation.
 *
 * Individual failures never abort the rest of the sequence (native plugin
 * missing, browser blocks the API, user denies one prompt…).
 */
export function requestAppPermissionsOnce(): void {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(STORAGE_KEY)) return;
  } catch {
    /* storage unavailable — run the pass anyway */
  }

  const run = async () => {
    const results: Record<string, GrantState> = {};

    // 1. Local notifications (reminders, delivery alerts)
    try {
      const r = await LocalNotifications.requestPermissions();
      results.localNotifications = r.display === 'granted' ? 'granted' : 'denied';
    } catch {
      results.localNotifications = 'unavailable';
    }

    // 2. Push notifications (offline DM delivery)
    try {
      const r = await PushNotifications.requestPermissions();
      results.push = r.receive === 'granted' ? 'granted' : 'denied';
    } catch {
      results.push = 'unavailable';
    }

    // 3. Camera + photo library (camera flow, attachments)
    try {
      const r = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
      results.camera = r.camera === 'granted' ? 'granted' : 'denied';
      results.photos = r.photos === 'granted' ? 'granted' : 'denied';
    } catch {
      results.camera = 'unavailable';
      results.photos = 'unavailable';
    }

    // 4. Microphone + web camera (voice notes, calls): brief probe so the
    //    system dialog appears NOW, not mid-call. Tracks are stopped at once —
    //    nothing is recorded and no indicator remains.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach((t) => t.stop());
      results.microphone = 'granted';
      results.webCamera = 'granted';
    } catch (e) {
      const denied = (e as DOMException)?.name === 'NotAllowedError' || (e as DOMException)?.name === 'SecurityError';
      results.microphone = denied ? 'denied' : 'unavailable';
    }

    logger.log('[AppPermissions] one-time permission pass complete:', results);
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ at: new Date().toISOString(), results })
      );
    } catch {
      /* ignore */
    }
  };

  // Small delay: first paint and session restore must never wait on dialogs.
  setTimeout(() => { void run(); }, 1500);
}

/** Runs the one-time permission pass after the first authenticated boot. */
export function useAppPermissions(): void {
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const started = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || started.current) return;
    started.current = true;
    requestAppPermissionsOnce();
  }, [isAuthenticated]);
}

export default useAppPermissions;
