import { UploadEventBus } from '../utils/UploadEventBus';
import { useUploadStore } from '../store/uploadStore';
import { logger } from '../utils/logger';

const TAG = 'sparkle-reel-upload';
const ICON = '/sparklelogo.png';
const THRESHOLDS = [25, 50, 75];

let initialized = false;
const notifiedThresholds = new Map<string, number>();

function ensurePermission(): void {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') {
    // Fire-and-forget; a denial just disables future notifications.
    void Notification.requestPermission().catch(() => { /* denied */ });
  }
}

function notify(body: string, onClick?: () => void): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const n = new Notification('Sparkle', { body, tag: TAG, icon: ICON, silent: false });
    if (onClick) {
      n.onclick = () => {
        try { window.focus(); } catch { /* ignore */ }
        onClick();
        n.close();
      };
    }
  } catch (err) {
    logger.warn('[ReelUploadNotifier] notification failed:', err);
  }
}

/**
 * Web Notifications for background reel (MOMENT) uploads: start, throttled
 * progress milestones, distinct processing state, completion, and failure.
 * Uses a single notification tag so progress updates in place instead of
 * stacking. Permission denial degrades silently to no notifications.
 */
export function initReelUploadNotifications(): void {
  if (initialized) return;
  initialized = true;

  const isMoment = (uploadId: string): boolean => {
    const job = useUploadStore.getState().jobs.find((j) => j.uploadId === uploadId);
    return job?.type === 'MOMENT';
  };

  UploadEventBus.on('UPLOAD_STARTED', (data) => {
    if (!data?.uploadId || !isMoment(data.uploadId)) return;
    ensurePermission();
    notifiedThresholds.set(data.uploadId, 0);
    notify('Uploading your reel…');
  });

  UploadEventBus.on('UPLOAD_PROGRESS', (data) => {
    if (!data?.uploadId || !isMoment(data.uploadId)) return;
    if (data.status === 'PROCESSING' || data.status === 'VERIFYING') {
      if (notifiedThresholds.get(data.uploadId) !== -1) {
        notifiedThresholds.set(data.uploadId, -1);
        notify('Processing your reel…');
      }
      return;
    }
    const pct = Math.round(Number(data.progress) || 0);
    const last = notifiedThresholds.get(data.uploadId) ?? 0;
    if (last >= 0 && pct - last >= 10 && THRESHOLDS.some((t) => pct >= t && last < t)) {
      notifiedThresholds.set(data.uploadId, pct);
      notify(`Uploading your reel… ${pct}%`);
    }
  });

  UploadEventBus.on('UPLOAD_COMPLETED', (data) => {
    if (!data?.uploadId || !isMoment(data.uploadId)) return;
    notifiedThresholds.delete(data.uploadId);
    notify('Your reel is published.', () => {
      window.location.href = '/profile/me?tab=reels';
    });
  });

  UploadEventBus.on('UPLOAD_FAILED', (data) => {
    if (!data?.uploadId || !isMoment(data.uploadId)) return;
    if (data.isRetrying) return; // transient — the job manager will retry
    notifiedThresholds.delete(data.uploadId);
    notify('Reel upload failed. Tap to review it on your profile.', () => {
      window.location.href = '/profile/me?tab=reels';
    });
  });
}
