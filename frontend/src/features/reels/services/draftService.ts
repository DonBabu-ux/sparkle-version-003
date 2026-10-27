import { useReelCreatorStore } from '../reelCreatorStore';
import type { ReelClip, ReelDraftPayload, ReelDraftRecord } from '../types';
import {
  deleteLocalDraft, deleteReelMedia, getLocalDraft, getReelMedia,
  listLocalDrafts, newMediaKey, saveLocalDraft, saveReelMedia,
} from './reelMediaDB';

/**
 * Draft persistence is fully local: media blobs and metadata both live in
 * IndexedDB on this device. Nothing is sent to a server, so drafts keep
 * working offline and are private to whoever holds the device.
 */

export type DraftListItem = ReelDraftRecord;

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
}

/** Persist every clip blob locally; returns media_refs for the draft record. */
export async function persistDraftMedia(clips: ReelClip[]): Promise<Array<{ key: string; name: string; kind: string; durationSec: number; trimStart: number; trimEnd: number | null; storageBytes: number }>> {
  const refs = [];
  for (const clip of clips) {
    if (clip.file) {
      const key = clip.storageKey || newMediaKey();
      await saveReelMedia(key, clip.file);
      refs.push({
        key,
        name: clip.name || 'clip',
        kind: clip.kind,
        durationSec: clip.durationSec,
        trimStart: clip.trimStart,
        trimEnd: clip.trimEnd,
        storageBytes: clip.file.size,
      });
      if (clip.storageKey !== key) {
        useReelCreatorStore.getState().updateClip(clip.id, { storageKey: key });
      }
    } else if (clip.storageKey) {
      const existing = await getReelMedia(clip.storageKey);
      refs.push({
        key: clip.storageKey,
        name: clip.name || 'clip',
        kind: clip.kind,
        durationSec: clip.durationSec,
        trimStart: clip.trimStart,
        trimEnd: clip.trimEnd,
        storageBytes: existing?.size || 0,
      });
    }
  }
  return refs;
}

function buildPayload(state: ReturnType<typeof useReelCreatorStore.getState>): Omit<ReelDraftPayload, 'clips'> & {
  clips: ReelDraftPayload['clips'];
} {
  return {
    title: state.title,
    description: state.description,
    music: state.selectedMusic,
    clips: state.clips.map(c => ({
      id: c.id,
      kind: c.kind,
      previewUrl: '',
      storageKey: c.storageKey,
      durationSec: c.durationSec,
      trimStart: c.trimStart,
      trimEnd: c.trimEnd,
      width: c.width,
      height: c.height,
      name: c.name,
    })),
    textOverlays: state.textOverlays,
    stickerOverlays: state.stickerOverlays,
    captions: state.captions,
    audience: state.audience,
    audienceExclusions: state.audienceExclusions,
    commentsEnabled: state.commentsEnabled,
    watermark: state.watermark,
    saveToDevice: state.saveToDevice,
    shareToStory: state.shareToStory,
    durationSec: state.totalDurationSec(),
    hashtags: state.hashtags,
    mentions: state.mentions,
    stage: state.stage,
  };
}

export interface SaveDraftResult {
  draftId: string;
}

/** Save (or update) the current session as a local draft. */
export async function saveDraft(): Promise<SaveDraftResult> {
  const state = useReelCreatorStore.getState();
  const mediaRefs = await persistDraftMedia(state.clips);
  const previous = state.draftId
    ? await getLocalDraft(state.draftId).catch(() => undefined)
    : undefined;
  const now = new Date().toISOString();
  const draftId = previous?.draft_id || state.draftId || `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const record: ReelDraftRecord = {
    draft_id: draftId,
    title: state.title || '',
    thumbnail_url: previous?.thumbnail_url ?? null,
    media_refs: mediaRefs,
    metadata: buildPayload(state),
    storage_bytes: mediaRefs.reduce((s, r) => s + (r.storageBytes || 0), 0),
    created_at: previous?.created_at || now,
    updated_at: now,
  };
  await saveLocalDraft(record);
  useReelCreatorStore.getState().setDraftId(draftId);
  return { draftId };
}

export async function listDrafts(): Promise<{ drafts: DraftListItem[]; totalBytes: number }> {
  const drafts = await listLocalDrafts();
  const sorted = [...drafts].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
  return {
    drafts: sorted,
    totalBytes: sorted.reduce((s, d) => s + (Number(d.storage_bytes) || 0), 0),
  };
}

/**
 * Preview of the draft's first clip — the actual stored media, rendered as
 * image or video depending on what the user uploaded. Caller owns the URL
 * and must revoke it when done.
 */
export async function getDraftPreview(draft: DraftListItem): Promise<{ url: string; kind: 'image' | 'video' } | null> {
  const ref = (draft.media_refs || [])[0];
  if (!ref) return null;
  const blob = await getReelMedia(ref.key);
  if (!blob) return null;
  return { url: URL.createObjectURL(blob), kind: ref.kind === 'image' ? 'image' : 'video' };
}

export async function deleteDraft(draftId: string): Promise<void> {
  const record = await getLocalDraft(draftId).catch(() => undefined);
  if (record) {
    await Promise.all((record.media_refs || []).map(r => deleteReelMedia(r.key)));
    await deleteLocalDraft(draftId);
  }
}

/**
 * Rehydrate a draft: restore state, then load media blobs back from
 * IndexedDB and rebuild preview URLs. Returns the number of clips restored.
 */
export async function resumeDraft(draftId: string): Promise<number> {
  const draft = await getLocalDraft(draftId);
  if (!draft) throw new Error('Draft not found');

  const store = useReelCreatorStore.getState();
  store.loadDraft(draft.metadata || {}, draftId);

  const refs = Array.isArray(draft.media_refs) ? draft.media_refs : [];
  const restored: ReelClip[] = [];
  for (const ref of refs) {
    const blob = await getReelMedia(ref.key);
    if (!blob) continue; // local media lost (cleared app data) — skip, don't crash
    const file = new File([blob], ref.name || 'clip', { type: blob.type || (ref.kind === 'image' ? 'image/jpeg' : 'video/mp4') });
    restored.push({
      id: `${draftId}-${ref.key}`,
      kind: ref.kind === 'image' ? 'image' : 'video',
      previewUrl: URL.createObjectURL(file),
      file,
      storageKey: ref.key,
      durationSec: ref.durationSec ?? (ref.kind === 'image' ? 3 : 0),
      trimStart: ref.trimStart ?? 0,
      trimEnd: ref.trimEnd ?? null,
      name: ref.name,
    });
  }
  if (restored.length) {
    useReelCreatorStore.setState({ clips: restored });
  }
  return restored.length;
}
