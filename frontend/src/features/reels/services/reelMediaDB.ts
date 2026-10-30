/**
 * Reel draft + sticker storage — everything lives on this device in IndexedDB:
 *  - `reel-media`       : large media Blobs for draft clips
 *  - `drafts`           : draft metadata records
 *  - `sparkle-stickers` : created sticker records (persistent, cross-session)
 * Never base64 in localStorage, never in server DB columns.
 */

import type { ReelDraftRecord } from '../types';

const DB_NAME = 'sparkle-reel-drafts';
const DB_VERSION = 3; // ↑ added sparkle-stickers store
const STORE_MEDIA = 'reel-media';
const STORE_DRAFTS = 'drafts';
const STORE_STICKERS = 'sparkle-stickers';

export interface LocalStickerRecord {
  sticker_id: string;
  /** Server-assigned ID returned by POST /moments/stickers (null until upload succeeds) */
  server_id: string | null;
  /** object URL — regenerated on open; only stable within a session */
  preview_url: string;
  /** The PNG / WEBP blob of the sticker image */
  blob_key: string;
  label: string;
  created_at: string;
  /** Extra key–value metadata (text overlays, source moment id, etc.) */
  meta: Record<string, unknown>;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_MEDIA)) {
        db.createObjectStore(STORE_MEDIA);
      }
      if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
        db.createObjectStore(STORE_DRAFTS);
      }
      if (!db.objectStoreNames.contains(STORE_STICKERS)) {
        db.createObjectStore(STORE_STICKERS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open reel draft DB'));
  });
  return dbPromise;
}

function tx<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const req = fn(t.objectStore(storeName));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('IndexedDB request failed'));
      })
  );
}

export async function saveReelMedia(key: string, blob: Blob): Promise<void> {
  try {
    await tx(STORE_MEDIA, 'readwrite', (store) => store.put(blob, key));
  } catch (err) {
    // Storage quota / private mode — the in-memory session still works;
    // draft resume across reloads is what degrades.
    console.warn('[ReelMediaDB] save failed for', key, err);
  }
}

export async function getReelMedia(key: string): Promise<Blob | undefined> {
  try {
    return (await tx(STORE_MEDIA, 'readonly', (store) => store.get(key))) as Blob | undefined;
  } catch (_) {
    return undefined;
  }
}

export async function deleteReelMedia(key: string): Promise<void> {
  try {
    await tx(STORE_MEDIA, 'readwrite', (store) => store.delete(key));
  } catch (_) { /* ignore */ }
}

/** Persist a draft record (create or overwrite by draft_id). Throws on failure. */
export async function saveLocalDraft(record: ReelDraftRecord): Promise<void> {
  await tx(STORE_DRAFTS, 'readwrite', (store) => store.put(record, record.draft_id));
}

export async function getLocalDraft(draftId: string): Promise<ReelDraftRecord | undefined> {
  return (await tx(STORE_DRAFTS, 'readonly', (store) => store.get(draftId))) as ReelDraftRecord | undefined;
}

/** All draft records on this device. Throws when IndexedDB is unusable. */
export async function listLocalDrafts(): Promise<ReelDraftRecord[]> {
  const all = (await tx(STORE_DRAFTS, 'readonly', (store) => store.getAll())) as ReelDraftRecord[] | undefined;
  return Array.isArray(all) ? all : [];
}

export async function deleteLocalDraft(draftId: string): Promise<void> {
  await tx(STORE_DRAFTS, 'readwrite', (store) => store.delete(draftId));
}

export async function estimateReelStorage(): Promise<number> {
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      return est.usage || 0;
    }
  } catch (_) { /* ignore */ }
  return 0;
}

export function newMediaKey(): string {
  return `reel-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ── Sticker library CRUD ──────────────────────────────────────────────────────

export async function saveLocalSticker(record: LocalStickerRecord): Promise<void> {
  try {
    await tx(STORE_STICKERS, 'readwrite', (store) => store.put(record, record.sticker_id));
  } catch (err) {
    console.warn('[ReelMediaDB] sticker save failed:', err);
  }
}

export async function getLocalSticker(stickerId: string): Promise<LocalStickerRecord | undefined> {
  try {
    return (await tx(STORE_STICKERS, 'readonly', (store) => store.get(stickerId))) as LocalStickerRecord | undefined;
  } catch (_) {
    return undefined;
  }
}

export async function listLocalStickers(): Promise<LocalStickerRecord[]> {
  try {
    const all = (await tx(STORE_STICKERS, 'readonly', (store) => store.getAll())) as LocalStickerRecord[] | undefined;
    return Array.isArray(all) ? all : [];
  } catch (_) {
    return [];
  }
}

export async function deleteLocalSticker(stickerId: string): Promise<void> {
  try {
    await tx(STORE_STICKERS, 'readwrite', (store) => store.delete(stickerId));
  } catch (_) { /* ignore */ }
}
