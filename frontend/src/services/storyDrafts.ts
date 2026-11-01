/**
 * Local story-draft persistence — mirrors the reels draft service
 * (`features/reels/services/draftService.ts` + `reelMediaDB.ts`):
 *  - `story-media` : the media Blobs for each draft page
 *  - `story-drafts`: the editor state (pages, stickers, music, audience, text)
 * Everything lives in IndexedDB on this device; nothing is sent to a server.
 */

export interface StoryDraftPage {
  id: string;
  /** IndexedDB key for this page's media blob (null for a text-only page). */
  mediaKey: string | null;
  name: string;
  kind: 'image' | 'video' | 'text';
  /** Page-local stickers. */
  stickers: unknown[];
  isVideo: boolean;
  /** Cover-frame / trim choices made in the media tools. */
  trimStart?: number | null;
  trimDuration?: number | null;
  coverUrl?: string | null;
}

export interface StoryDraftRecord {
  draft_id: string;
  title: string;
  thumbnail_url: string | null;
  /** Blob keys + sizes for the pages' media. */
  mediaRefs: Array<{ key: string; name: string; kind: string; isVideo: boolean; storageBytes: number }>;
  /** Full editor state to restore. */
  metadata: {
    pages: StoryDraftPage[];
    stickers: unknown[];
    selectedMusic: unknown | null;
    audience: string;
    textStoryContent: string;
    textStoryContentTitle: string;
    editorText: string;
    mode: string;
    savedAt: string;
  };
  storageBytes: number;
  created_at: string;
  updated_at: string;
}

const DB_NAME = 'sparkle-story-drafts';
const DB_VERSION = 1;
const STORE_MEDIA = 'story-media';
const STORE_DRAFTS = 'story-drafts';

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
    req.onerror = () => reject(req.error || new Error('Failed to open story draft DB'));
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

export async function saveStoryMedia(key: string, blob: Blob): Promise<void> {
  try {
    await tx(STORE_MEDIA, 'readwrite', (store) => store.put(blob, key));
  } catch (err) {
    // Quota / private mode: the in-session draft still works; resume across
    // reloads is what degrades. Same policy as the reels draft DB.
    console.warn('[StoryDrafts] media save failed for', key, err);
  }
}

export async function getStoryMedia(key: string): Promise<Blob | undefined> {
  try {
    return (await tx(STORE_MEDIA, 'readonly', (store) => store.get(key))) as Blob | undefined;
  } catch {
    // Media lost (quota, private mode, cleared app data) — behave as absent.
    return undefined;
  }
}

/** Drop a draft plus every media blob it references. Used after publish. */
export async function deleteStoryDraft(draftId: string): Promise<void> {
  const record = await getDraft(draftId).catch(() => undefined);
  if (record) {
    const keys = (record.mediaRefs || []).map((r) => r.key);
    await Promise.all(keys.map((key) => tx(STORE_MEDIA, 'readwrite', (s) => s.delete(key)).catch(() => undefined)));
  }
  await tx(STORE_DRAFTS, 'readwrite', (store) => store.delete(draftId)).catch(() => undefined);
}

export async function saveDraft(record: StoryDraftRecord): Promise<void> {
  await tx(STORE_DRAFTS, 'readwrite', (store) => store.put(record, record.draft_id));
}

export async function getDraft(draftId: string): Promise<StoryDraftRecord | undefined> {
  return (await tx(STORE_DRAFTS, 'readonly', (store) => store.get(draftId))) as StoryDraftRecord | undefined;
}

export async function listDrafts(): Promise<StoryDraftRecord[]> {
  try {
    const all = (await tx(STORE_DRAFTS, 'readonly', (store) => store.getAll())) as StoryDraftRecord[] | undefined;
    return Array.isArray(all) ? all : [];
  } catch {
    // IndexedDB unusable — an empty list, not a crash.
    return [];
  }
}

/** First page's media, rendered as an object URL for the draft list tile. */
export async function getDraftPreview(draft: StoryDraftRecord): Promise<{ url: string; kind: 'image' | 'video' } | null> {
  const ref = (draft.mediaRefs || [])[0];
  if (!ref) return null;
  const blob = await getStoryMedia(ref.key);
  if (!blob) return null;
  return { url: URL.createObjectURL(blob), kind: ref.isVideo ? 'video' : 'image' };
}

/**
 * Restore a draft: the caller owns the returned page list and must
 * `URL.revokeObjectURL` every `previewUrl` when the editor unmounts.
 */
export async function loadDraftMedia(draft: StoryDraftRecord): Promise<Array<StoryDraftPage & { previewUrl: string }>> {
  const restored = [];
  for (const page of draft.metadata.pages || []) {
    if (page.kind === 'text') {
      restored.push({ ...page, previewUrl: '' });
      continue;
    }
    if (!page.mediaKey) continue;
    const blob = await getStoryMedia(page.mediaKey);
    if (!blob) continue; // local media lost (cleared app data) — skip, don't crash
    restored.push({ ...page, previewUrl: URL.createObjectURL(blob) });
  }
  return restored;
}

/** Rebuild the persisted record from the editor state (no blob writes). */
export function buildDraftRecord(input: {
  draftId: string;
  title: string;
  pages: Array<Omit<StoryDraftPage, 'mediaKey'>>;
  mediaRefs: Array<{ key: string; name: string; kind: string; isVideo: boolean; storageBytes: number }>;
  stickers: unknown[];
  selectedMusic: unknown | null;
  audience: string;
  textStoryContent: string;
  editorText: string;
  mode: string;
  created_at?: string;
}): StoryDraftRecord {
  const now = new Date().toISOString();
  const pages: StoryDraftPage[] = input.pages.map((page) => ({
    ...page,
    mediaKey: page.mediaKey ?? null,
  }));
  return {
    draft_id: input.draftId,
    title: input.title,
    thumbnail_url: null,
    mediaRefs: input.mediaRefs,
    metadata: {
      pages,
      stickers: input.stickers,
      selectedMusic: input.selectedMusic,
      audience: input.audience,
      textStoryContent: input.textStoryContent,
      textStoryContentTitle: input.title,
      editorText: input.editorText,
      mode: input.mode,
      savedAt: now,
    },
    storageBytes: input.mediaRefs.reduce((s, r) => s + (r.storageBytes || 0), 0),
    created_at: input.created_at || now,
    updated_at: now,
  };
}

export function newDraftId(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
