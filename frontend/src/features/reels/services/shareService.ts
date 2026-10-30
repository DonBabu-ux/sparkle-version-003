import { Capacitor, registerPlugin } from '@capacitor/core';
import { logger } from '../../../utils/logger';

/**
 * Share & save-to-device helpers.
 * - Android native: Web Share API (chooser) + MediaStoreSaver plugin for downloads.
 * - Web: navigator.share when available, otherwise navigator.clipboard link.
 */

interface MediaStoreSaverLike {
  saveToDownloads(options: { data: string; mimeType: string; fileName: string }): Promise<unknown>;
}
let saverPlugin: MediaStoreSaverLike | null = null;
try {
  saverPlugin = registerPlugin<MediaStoreSaverLike>('MediaStoreSaver');
} catch (_) {
  saverPlugin = null;
}

export type ShareChannel = 'whatsapp' | 'facebook' | 'instagram' | 'sms' | 'system';

function reelLink(momentId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://sparkleapp.com';
  return `${origin}/moments/${momentId}`;
}

const INTENT_URLS: Record<Exclude<ShareChannel, 'system'>, (text: string) => string> = {
  whatsapp: (text) => `https://wa.me/?text=${encodeURIComponent(text)}`,
  facebook: (text) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(text)}`,
  instagram: () => '', // no web intent — fall through to system share sheet
  sms: (text) => `sms:?&body=${encodeURIComponent(text)}`,
};

export interface ShareOutcome {
  status: 'shared' | 'cancelled' | 'unavailable' | 'failed';
  message?: string;
}

/** Open a real share target for the published reel. Never auto-sends. */
export async function shareReel(momentId: string, channel: ShareChannel): Promise<ShareOutcome> {
  const link = reelLink(momentId);
  const text = `Check out my reel on Sparkle: ${link}`;

  try {
    if (channel === 'system' || channel === 'instagram') {
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        try {
          await navigator.share({ title: 'Sparkle reel', text, url: link });
          return { status: 'shared' };
        } catch (err) {
          if ((err as DOMException)?.name === 'AbortError') return { status: 'cancelled' };
          // NotAllowedError etc. → fall through
        }
      }
      // Web Share unavailable → clipboard fallback (explicit user action, no auto-send)
      try {
        await navigator.clipboard.writeText(link);
        return { status: 'shared', message: 'Link copied — paste it wherever you like.' };
      } catch (_) {
        return { status: 'unavailable', message: 'Sharing is not supported on this device.' };
      }
    }

    const url = INTENT_URLS[channel](channel === 'facebook' ? link : text);
    if (!url) return { status: 'unavailable' };
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) return { status: 'unavailable', message: 'The share window was blocked by your browser.' };
    return { status: 'shared' };
  } catch (_) {
    return { status: 'failed', message: 'Sharing failed. Please try again.' };
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Save the finished reel to the device.
 * Resolves only when the save genuinely succeeded (native MediaStore write
 * or a browser download hand-off) — callers must not claim success before.
 */
export async function saveReelToDevice(file: Blob, fileName: string): Promise<ShareOutcome> {
  try {
    if (Capacitor.isNativePlatform() && saverPlugin) {
      const data = await blobToBase64(file);
      await saverPlugin.saveToDownloads({ data, mimeType: file.type || 'video/mp4', fileName });
      return { status: 'shared', message: 'Saved to your device Downloads.' };
    }
    // Browser: programmatic download
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return { status: 'shared', message: 'Download started.' };
  } catch (err) {
    logger.warn('[Reels] save to device failed:', err);
    return {
      status: 'failed',
      message: 'Could not save the video. Check storage permissions and free space.',
    };
  }
}
