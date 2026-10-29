/**
 * Reel draft storage — everything lives on this device in IndexedDB:
 * large media files as Blobs in the `reel-media` store, draft metadata
 * (composer state + media refs + size) as records in the `drafts` store.
 * Never base64 in localStorage and never in ordinary database columns.
 */

import type { ReelDraftRecord } from '../types';

const DB_NAME = 'sparkle-reel-drafts';
const DB_VERSION = 2;
const STORE_MEDIA = 'reel-media';
const STORE_DRAFTS = 'drafts';

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
