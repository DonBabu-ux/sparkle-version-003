import { Capacitor, registerPlugin } from '@capacitor/core';

const MediaStoreSaver = registerPlugin<{
  saveToDownloads(options: {
    data: string;
    mimeType: string;
    fileName: string;
  }): Promise<{ path: string; fileName: string }>;
}>('MediaStoreSaver');

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  apk: 'application/vnd.android.package-archive',
};

export const guessMediaMime = (fileName: string, fallback = 'application/octet-stream'): string => {
  const ext = (fileName || '').split('?')[0].split('#')[0].split('.').pop()?.toLowerCase() || '';
  return MIME_BY_EXT[ext] || fallback;
};

const deriveFileName = (url: string, mimeType: string): string => {
  try {
    const pathname = new URL(url).pathname;
    const last = decodeURIComponent(pathname.split('/').pop() || '');
    if (last && last.includes('.')) {
      return last.replace(/[^\w.-]+/g, '_').slice(-80);
    }
  } catch {
    // relative/blob URLs fall through
  }
  const ext = Object.keys(MIME_BY_EXT).find((e) => MIME_BY_EXT[e] === mimeType) || 'bin';
  return `sparkle-${Date.now()}.${ext}`;
};

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : '');
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read media'));
    reader.readAsDataURL(blob);
  });

/**
 * Downloads media to the device.
 * - Web: fetch → blob → anchor download.
 * - Native (Android): fetch → base64 → MediaStore Downloads (visible in the
 *   system Files/Downloads apps, survives app uninstall on API 29+).
 * Never fabricates success: rejects with a real error on any failure.
 */
export async function downloadMedia(url: string, fileName?: string): Promise<string> {
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) {
    throw new Error('This media is not available for download yet.');
  }

  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) {
    throw new Error(`Download failed (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  if (!blob || blob.size === 0) {
    throw new Error('Downloaded file is empty');
  }

  const mimeType = blob.type || guessMediaMime(fileName || url);
  const name = fileName || deriveFileName(url, mimeType);

  if (Capacitor.isNativePlatform()) {
    const base64 = await blobToBase64(blob);
    if (!base64) {
      throw new Error('Could not encode media for saving');
    }
    const result = await MediaStoreSaver.saveToDownloads({ data: base64, mimeType, fileName: name });
    return result.path;
  }

  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = name;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a beat to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
  return name;
}

/** Fetches a remote URL into a File (used for Set-as-avatar / share-to-story). */
export async function fetchMediaAsFile(url: string, preferredName?: string): Promise<File> {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) {
    throw new Error(`Could not fetch media (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  if (!blob || blob.size === 0) {
    throw new Error('Fetched media is empty');
  }
  const mimeType = blob.type || 'image/jpeg';
  const name = preferredName || deriveFileName(url, mimeType);
  return new File([blob], name, { type: mimeType });
}
