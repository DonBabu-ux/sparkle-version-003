/**
 * Local sticker library — created stickers survive app restarts via IndexedDB.
 *
 * Flow:
 *   1. User creates a sticker in CreateStickerPage → `persistNewSticker(blob, meta)` stores
 *      the raw blob in the reel-media store and the metadata in sparkle-stickers.
 *   2. On any session open, `getLocalStickers()` reads all records, rebuilds preview URLs
 *      from stored blobs, and returns them for the sticker drawer.
 *   3. Once the server upload succeeds, the caller passes the returned server_id to
 *      `patchStickerServerId(stickerId, server_id)` so we can avoid re-uploading.
 */

import {
  saveLocalSticker,
  listLocalStickers,
  deleteLocalSticker,
  getReelMedia,
  saveReelMedia,
  newMediaKey,
  type LocalStickerRecord,
} from './reelMediaDB';
import { logger } from '../../../utils/logger';

export type { LocalStickerRecord };

export interface StickerLibraryItem {
  stickerId: string;
  serverId: string | null;
  previewUrl: string;  // object URL — revoke when done
  label: string;
  createdAt: string;
  meta: Record<string, unknown>;
}

/**
 * Load all locally-persisted stickers, regenerating fresh object URLs
 * from their stored blobs. Returns items sorted newest-first.
 *
 * Caller is responsible for revoking the returned previewUrl values when
 * the sticker drawer unmounts (URL.revokeObjectURL).
 */
export async function getLocalStickers(): Promise<StickerLibraryItem[]> {
  const records = await listLocalStickers();
  records.sort((a, b) => b.created_at.localeCompare(a.created_at));

  const result: StickerLibraryItem[] = [];
  for (const rec of records) {
    const blob = await getReelMedia(rec.blob_key);
    if (!blob) {
      // Blob was purged (storage cleanup) — remove the dangling record
      await deleteLocalSticker(rec.sticker_id).catch(() => {});
      continue;
    }
    result.push({
      stickerId: rec.sticker_id,
      serverId: rec.server_id,
      previewUrl: URL.createObjectURL(blob),
      label: rec.label,
      createdAt: rec.created_at,
      meta: rec.meta,
    });
  }
  return result;
}

/**
 * Persist a new sticker to local storage. Returns the local sticker ID.
 * Call this right after the user finalises the sticker canvas, before server upload.
 */
export async function persistNewSticker(
  blob: Blob,
  label: string,
  meta: Record<string, unknown> = {},
): Promise<string> {
  const blobKey = newMediaKey();
  await saveReelMedia(blobKey, blob);

  const stickerId = `sticker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const record: LocalStickerRecord = {
    sticker_id: stickerId,
    server_id: null,
    preview_url: '',   // not stored — regenerated on load
    blob_key: blobKey,
    label,
    created_at: new Date().toISOString(),
    meta,
  };
  await saveLocalSticker(record);
  logger.log('[StickerLib] persisted locally:', stickerId);
  return stickerId;
}

/**
 * After the server upload succeeds, record the server-assigned ID so the
 * sticker can be deduped on the server and not re-uploaded next session.
 */
export async function patchStickerServerId(stickerId: string, serverId: string): Promise<void> {
  try {
    const records = await listLocalStickers();
    const existing = records.find(r => r.sticker_id === stickerId);
    if (!existing) return;
    await saveLocalSticker({ ...existing, server_id: serverId });
    logger.log('[StickerLib] server_id patched:', stickerId, '->', serverId);
  } catch (err) {
    logger.warn('[StickerLib] patchStickerServerId failed:', err);
  }
}

/** Remove a sticker record and its blob from local storage. */
export async function removeLocalSticker(stickerId: string): Promise<void> {
  try {
    const records = await listLocalStickers();
    const rec = records.find(r => r.sticker_id === stickerId);
    if (rec) {
      const { deleteReelMedia } = await import('./reelMediaDB');
      await deleteReelMedia(rec.blob_key);
    }
    await deleteLocalSticker(stickerId);
  } catch (err) {
    logger.warn('[StickerLib] removeLocalSticker failed:', err);
  }
}
