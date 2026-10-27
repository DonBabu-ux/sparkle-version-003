import { logger } from '../../../utils/logger';
import type { GalleryItem, MediaSourceItem } from '../types';

/**
 * Device media access.
 *
 * Capabilities by environment (honest detection, no fake folders):
 *  - Chromium (desktop/Android WebView ≥ Chrome 122): File System Access API
 *    with persistently cached directory handles → real per-folder listing.
 *  - All other browsers: `<input type=file>` fallback; the OS/SAF picker
 *    provides folders natively (Android Storage Access Framework).
 *  - Browser file inputs cannot enumerate "WhatsApp" or "Screenshots"
 *    album names without native APIs — sources are reported only when the
 *    platform actually exposes them.
 */

interface CachedDir {
  name: string;
  handle: FileSystemDirectoryHandle;
}

const DIR_CACHE_KEY = 'sparkle_reel_dirs';

function fsaSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

async function readDirCache(): Promise<CachedDir[]> {
  try {
    const raw = localStorage.getItem(DIR_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{ name: string; handle: FileSystemDirectoryHandle }>;
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

async function writeDirCache(entries: CachedDir[]): Promise<void> {
  try {
    // Only names are persisted; handles must be re-permissioned per session.
    localStorage.setItem(DIR_CACHE_KEY, JSON.stringify(entries.map(e => ({ name: e.name, handle: e.handle }))));
  } catch (_) { /* quota or structured-clone failure — cache is optional */ }
}

export function canPickDirectory(): boolean {
  return fsaSupported();
}

/** Prompt the user to pick a device folder (File System Access API). */
export async function pickDirectory(): Promise<CachedDir | null> {
  if (!fsaSupported()) return null;
  try {
    const handle = (await (window as unknown as {
      showDirectoryPicker: (opts?: unknown) => Promise<FileSystemDirectoryHandle>;
    }).showDirectoryPicker({ mode: 'read', id: 'sparkle-reel-media' })) as FileSystemDirectoryHandle;
    const entry = { name: handle.name, handle };
    const cache = await readDirCache();
    const next = [entry, ...cache.filter(c => c.name !== handle.name)].slice(0, 12);
    await writeDirCache(next);
    return entry;
  } catch (err) {
    // AbortError = user cancelled — not an error worth surfacing
    if ((err as DOMException)?.name !== 'AbortError') {
      logger.warn('[MediaLibrary] directory picker failed:', err);
    }
    return null;
  }
}

/** Folders previously granted (names only — handles live for this session). */
export async function getCachedFolders(): Promise<string[]> {
  const cache = await readDirCache();
  return cache.map(c => c.name);
}

async function getDirByName(name: string): Promise<FileSystemDirectoryHandle | null> {
  const cache = await readDirCache();
  return cache.find(c => c.name === name)?.handle ?? null;
}

const MEDIA_EXT = /\.(jpe?g|png|gif|webp|avif|heic|heif|mp4|webm|mov|m4v|3gp)$/i;

function isMediaFile(file: File): boolean {
  if (file.type.startsWith('video/') || file.type.startsWith('image/')) return true;
  // Some Android providers report empty MIME types — fall back to extension
  return !file.type && MEDIA_EXT.test(file.name);
}

function kindOf(file: File): 'video' | 'image' {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('image/')) return 'image';
  return /\.(mp4|webm|mov|m4v|3gp)$/i.test(file.name) ? 'video' : 'image';
}

let thumbIdCounter = 0;

async function makeVideoThumb(file: File): Promise<{ url: string; durationSec: number; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const meta = await probeVideo(url);
    // Poster became a data URL — the probe blob is no longer referenced.
    // (If the frame capture fell back to `url` itself, it stays as the thumbnail.)
    if (meta.posterUrl !== url) URL.revokeObjectURL(url);
    return { url: meta.posterUrl, durationSec: meta.durationSec, width: meta.width, height: meta.height };
  } catch (_) {
    return { url, durationSec: 0, width: 0, height: 0 };
  }
}

/** Probe a video's real duration/resolution and capture a poster frame. */
export function probeVideo(url: string): Promise<{ durationSec: number; width: number; height: number; posterUrl: string }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    let done = false;

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
    };

    const fail = (msg: string) => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error(msg));
    };

    const timer = setTimeout(() => fail('video metadata timeout'), 8000);

    video.onloadedmetadata = () => {
      const durationSec = Number.isFinite(video.duration) ? video.duration : 0;
      const width = video.videoWidth;
      const height = video.videoHeight;
      // Seek near 0.1s so a frame is decodable for the poster capture
      video.currentTime = Math.min(0.1, Math.max(0, durationSec / 2));
      video.onseeked = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        let posterUrl = url;
        try {
          const canvas = document.createElement('canvas');
          canvas.width = Math.min(width || 320, 320);
          canvas.height = Math.round((canvas.width * (height || width || 320)) / (width || height || 320));
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            posterUrl = canvas.toDataURL('image/jpeg', 0.7);
          }
        } catch (_) {
          posterUrl = url; // fall back to the object URL for the thumbnail
        }
        cleanup();
        resolve({ durationSec, width, height, posterUrl });
      };
    };
    video.onerror = () => {
      clearTimeout(timer);
      fail('video load error');
    };
    video.src = url;
  });
}

function probeImage(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = url;
  });
}

function galleryItemFromFile(file: File): Promise<GalleryItem> {
  const id = `f-${Date.now()}-${thumbIdCounter++}`;
  const kind = kindOf(file);
  if (kind === 'video') {
    return makeVideoThumb(file).then(({ url, durationSec, width, height }) => ({
      id,
      name: file.name,
      kind,
      thumbnailUrl: url,
      durationSec,
      file,
      width,
      height,
    }));
  }
  const previewUrl = URL.createObjectURL(file);
  return probeImage(previewUrl).then(({ width, height }) => ({
    id,
    name: file.name,
    kind,
    thumbnailUrl: previewUrl,
    file,
    width,
    height,
  }));
}

/**
 * List media files from a picked device folder (real contents, newest first).
 */
export async function listFolderMedia(folderName: string): Promise<GalleryItem[]> {
  const handle = await getDirByName(folderName);
  if (!handle) throw new Error('FOLDER_REVOKE');
  // queryPermission/requestPermission are part of the File System Access API
  // but missing from older TypeScript DOM libs — probe them structurally.
  const probe = handle as unknown as {
    queryPermission?: (d: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
    requestPermission?: (d: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  };
  const permission = await probe.queryPermission?.({ mode: 'read' }).catch(() => 'granted' as PermissionState);
  if (permission !== 'granted') {
    const req = await probe.requestPermission?.({ mode: 'read' }).catch(() => 'denied' as PermissionState);
    if (req !== 'granted') throw new Error('FOLDER_PERMISSION');
  }
  const files: File[] = [];
  // iterate entries recursively (depth 1 is enough for media folders)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for await (const [name, entry] of handle as any) {
    if (name.startsWith('.')) continue; // skip hidden/dot files
    if (entry.kind === 'file') {
      const file = await entry.getFile();
      if (isMediaFile(file)) files.push(file);
    }
    if (files.length >= 500) break;
  }
  files.sort((a, b) => b.lastModified - a.lastModified);
  return Promise.all(files.slice(0, 300).map(galleryItemFromFile));
}

/**
 * Fallback picker: opens the OS file chooser with multi-select.
 * On Android WebView this launches the Storage Access Framework picker
 * where the user can browse any folder (Camera roll, WhatsApp, Screenshots…).
 */
export function openNativePicker(options: {
  multiple?: boolean;
  accept?: string;
  capture?: string;
}): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = options.accept ?? 'image/*,video/*';
    if (options.multiple) input.multiple = true;
    if (options.capture) input.setAttribute('capture', options.capture);
    input.style.position = 'fixed';
    input.style.left = '-10000px';
    document.body.appendChild(input);
    let settled = false;
    const finish = (files: File[]) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(files);
    };
    input.onchange = () => finish(Array.from(input.files || []).filter(isMediaFile));
    // If the picker is dismissed without a change event, resolve empty after focus returns
    window.addEventListener(
      'focus',
      () => setTimeout(() => finish(Array.from(input.files || []).filter(isMediaFile)), 600),
      { once: true }
    );
    input.click();
  });
}

/**
 * Build the source list for the Gallery section.
 * Only advertises folders the current environment can actually open.
 */
export async function getMediaSources(): Promise<MediaSourceItem[]> {
  const sources: MediaSourceItem[] = [
    { id: 'camera-roll', name: 'Camera roll', kind: 'camera-roll' },
  ];
  if (fsaSupported()) {
    const names = await getCachedFolders();
    for (const name of names) {
      sources.push({ id: `folder:${name}`, name, kind: 'folder' });
    }
    sources.push({ id: 'browse', name: 'Browse folders…', kind: 'browse' });
  } else {
    sources.push({ id: 'browse', name: 'Browse files & albums…', kind: 'browse' });
  }
  return sources;
}

/** Convert picked files into gallery items (thumbnails + real metadata). */
export async function filesToGalleryItems(files: File[]): Promise<GalleryItem[]> {
  const media = files.filter(isMediaFile).slice(0, 60);
  return Promise.all(media.map(galleryItemFromFile));
}

export function revokeGalleryItem(item: GalleryItem): void {
  if (item.thumbnailUrl.startsWith('blob:')) {
    try { URL.revokeObjectURL(item.thumbnailUrl); } catch (_) { /* ignore */ }
  }
}

/** Read a media file's duration (0 for images). */
export function getClipDuration(file: File): Promise<number> {
  if (!file.type.startsWith('video/')) return Promise.resolve(3);
  const url = URL.createObjectURL(file);
  return probeVideo(url)
    .then(p => {
      URL.revokeObjectURL(url);
      return p.durationSec;
    })
    .catch(() => {
      URL.revokeObjectURL(url);
      return 0;
    });
}
