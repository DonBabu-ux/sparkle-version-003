import { create } from 'zustand';
import type {
  AudienceExclusions,
  AudienceKind,
  CaptionsState,
  MusicTrack,
  ReelClip,
  ReelCreatorState,
  ReelStage,
  SelectedMusic,
  ShareStoryMode,
  StickerOverlay,
  TextOverlay,
} from './types';

const MAX_MEDIA_DEFAULT = 10;
const MAX_CLIPS_TOTAL = 10;
const MAX_HASHTAGS = 5;
const MAX_MENTIONS = 10;

const initialCaptions: CaptionsState = {
  enabled: false,
  cues: [],
  text: '',
  source: null,
  status: 'idle',
};

// "Always share new reels" is a setting, not session state — persist it so it
// survives resets and app restarts. "Once" is deliberately never persisted.
const SHARE_STORY_KEY = 'sparkle_reel_share_story';

const readShareStorySetting = (): ShareStoryMode => {
  try {
    if (typeof localStorage === 'undefined') return 'off';
    return localStorage.getItem(SHARE_STORY_KEY) === 'always' ? 'always' : 'off';
  } catch {
    return 'off';
  }
};

const writeShareStorySetting = (mode: ShareStoryMode): void => {
  try {
    if (typeof localStorage === 'undefined') return;
    if (mode === 'always') localStorage.setItem(SHARE_STORY_KEY, 'always');
    else localStorage.removeItem(SHARE_STORY_KEY);
  } catch {
    // Storage unavailable (private mode) — setting stays session-only.
  }
};

const emptyState = (): ReelCreatorState => ({
  stage: 'create',
  previousStage: null,

  clips: [],
  selectedMusic: null,
  textOverlays: [],
  stickerOverlays: [],
  captions: initialCaptions,

  title: '',
  description: '',
  hashtags: [],
  mentions: [],

  audience: 'public',
  audienceExclusions: { hideFrom: [], showOnly: [] },
  commentsEnabled: true,
  watermark: true,
  saveToDevice: false,
  shareToStory: readShareStorySetting(),

  selectMultiple: false,
  selectionOrder: [],
  maxMedia: MAX_MEDIA_DEFAULT,

  draftId: null,
  dirty: false,
  submitting: false,
  submitProgress: 0,
  submitError: null,
  publishedMomentId: null,

  recordingDurationLimit: 15,
  keepOriginalSound: false,
  facingMode: 'environment',
  torchOn: false,
});

const clipDuration = (clip: ReelClip): number => {
  const end = clip.trimEnd ?? clip.durationSec;
  return Math.max(0, end - (clip.trimStart || 0));
};

export const useReelCreatorStore = create<ReelCreatorState & {
  setStage: (stage: ReelStage) => void;
  goBack: () => void;
  addClips: (clips: ReelClip[]) => void;
  removeClip: (id: string) => void;
  reorderClips: (orderedIds: string[]) => void;
  updateClip: (id: string, patch: Partial<ReelClip>) => void;
  clearClips: () => void;
  toggleSelection: (clipId: string) => void;
  setSelectMultiple: (on: boolean) => void;
  commitSelection: () => ReelClip[];
  clearSelection: () => void;
  setMusic: (music: SelectedMusic | null) => void;
  addTextOverlay: (overlay: TextOverlay) => void;
  updateTextOverlay: (id: string, patch: Partial<TextOverlay>) => void;
  removeTextOverlay: (id: string) => void;
  addSticker: (sticker: StickerOverlay) => void;
  updateSticker: (id: string, patch: Partial<StickerOverlay>) => void;
  removeSticker: (id: string) => void;
  setCaptions: (captions: CaptionsState) => void;
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  setHashtags: (tags: string[]) => void;
  addHashtag: (tag: string) => boolean;
  removeHashtag: (tag: string) => void;
  setMentions: (mentions: string[]) => void;
  addMention: (username: string) => boolean;
  removeMention: (username: string) => void;
  setAudience: (audience: AudienceKind) => void;
  setAudienceExclusions: (ex: AudienceExclusions) => void;
  setCommentsEnabled: (on: boolean) => void;
  setWatermark: (on: boolean) => void;
  setSaveToDevice: (on: boolean) => void;
  setShareToStory: (mode: ShareStoryMode) => void;
  setRecordingDurationLimit: (sec: number) => void;
  setKeepOriginalSound: (on: boolean) => void;
  setFacingMode: (mode: 'user' | 'environment') => void;
  setTorchOn: (on: boolean) => void;
  setDraftId: (id: string | null) => void;
  setSubmitting: (on: boolean) => void;
  setSubmitProgress: (p: number) => void;
  setSubmitError: (err: string | null) => void;
  setPublishedMomentId: (id: string | null) => void;
  totalDurationSec: () => number;
  hasUnsavedChanges: () => boolean;
  resetSession: () => void;
  loadDraft: (payload: Partial<{
    title: string;
    description: string;
    music: SelectedMusic | null;
    clips: Array<Omit<ReelClip, 'file' | 'previewUrl'> & { previewUrl?: string }>;
    textOverlays: TextOverlay[];
    stickerOverlays: StickerOverlay[];
    captions: CaptionsState;
    audience: AudienceKind;
    audienceExclusions: AudienceExclusions;
    commentsEnabled: boolean;
    watermark: boolean;
    saveToDevice: boolean;
    shareToStory: ShareStoryMode;
    durationSec: number;
    hashtags: string[];
    mentions: string[];
    stage: ReelStage;
  }>, draftId: string) => void;
}>((set, get) => ({
  ...emptyState(),

  setStage: (stage) =>
    set((s) => ({ stage, previousStage: s.stage, dirty: true })),

  goBack: () =>
    set((s) => ({
      stage: s.previousStage && s.previousStage !== s.stage ? s.previousStage : 'create',
      previousStage: null,
    })),

  addClips: (clips) =>
    set((s) => {
      const existing = new Set(s.clips.map(c => c.id));
      const fresh = clips.filter(c => !existing.has(c.id)).slice(0, MAX_CLIPS_TOTAL - s.clips.length);
      if (!fresh.length) return s;
      return { clips: [...s.clips, ...fresh], dirty: true };
    }),

  removeClip: (id) =>
    set((s) => ({
      clips: s.clips.filter(c => c.id !== id),
      selectionOrder: s.selectionOrder.filter(x => x !== id),
      dirty: true,
    })),

  reorderClips: (orderedIds) =>
    set((s) => {
      const map = new Map(s.clips.map(c => [c.id, c]));
      const ordered = orderedIds.map(id => map.get(id)).filter(Boolean) as ReelClip[];
      // Append any clips not present in orderedIds (defensive)
      const rest = s.clips.filter(c => !orderedIds.includes(c.id));
      return { clips: [...ordered, ...rest], dirty: true };
    }),

  updateClip: (id, patch) =>
    set((s) => ({
      clips: s.clips.map(c => (c.id === id ? { ...c, ...patch } : c)),
      dirty: true,
    })),

  clearClips: () => set({ clips: [], selectionOrder: [], dirty: true }),

  toggleSelection: (clipId) =>
    set((s) => {
      if (!s.selectMultiple) return s;
      const has = s.selectionOrder.includes(clipId);
      if (has) {
        return { selectionOrder: s.selectionOrder.filter(x => x !== clipId), dirty: true };
      }
      if (s.selectionOrder.length >= s.maxMedia) return s;
      return { selectionOrder: [...s.selectionOrder, clipId], dirty: true };
    }),

  setSelectMultiple: (on) =>
    set((s) => ({ selectMultiple: on, selectionOrder: on ? s.selectionOrder : [] })),

  commitSelection: () => {
    const s = get();
    const ordered = s.selectionOrder
      .map(id => s.clips.find(c => c.id === id))
      .filter(Boolean) as ReelClip[];
    set({ selectMultiple: false, selectionOrder: [] });
    return ordered;
  },

  clearSelection: () => set({ selectionOrder: [], selectMultiple: false }),

  setMusic: (music) => set({ selectedMusic: music, dirty: true }),

  addTextOverlay: (overlay) =>
    set((s) => ({ textOverlays: [...s.textOverlays, overlay], dirty: true })),
  updateTextOverlay: (id, patch) =>
    set((s) => ({
      textOverlays: s.textOverlays.map(o => (o.id === id ? { ...o, ...patch } : o)),
      dirty: true,
    })),
  removeTextOverlay: (id) =>
    set((s) => ({ textOverlays: s.textOverlays.filter(o => o.id !== id), dirty: true })),

  addSticker: (sticker) =>
    set((s) => ({ stickerOverlays: [...s.stickerOverlays, sticker], dirty: true })),
  updateSticker: (id, patch) =>
    set((s) => ({
      stickerOverlays: s.stickerOverlays.map(o => (o.id === id ? { ...o, ...patch } : o)),
      dirty: true,
    })),
  removeSticker: (id) =>
    set((s) => ({ stickerOverlays: s.stickerOverlays.filter(o => o.id !== id), dirty: true })),

  setCaptions: (captions) => set({ captions, dirty: true }),

  setTitle: (title) => set({ title, dirty: true }),
  setDescription: (description) => set({ description, dirty: true }),

  setHashtags: (tags) =>
    set({ hashtags: [...new Set(tags.map(t => t.toLowerCase().replace(/^#/, '')))].slice(0, MAX_HASHTAGS), dirty: true }),

  addHashtag: (tag) => {
    // Mirror the server's sanitizeHashtag so what the composer shows is
    // exactly what gets stored ([a-z0-9_], max 100 chars).
    const clean = tag
      .toLowerCase()
      .replace(/^#/, '')
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 100);
    if (!clean) return false;
    const s = get();
    if (s.hashtags.includes(clean)) return false;
    if (s.hashtags.length >= MAX_HASHTAGS) return false;
    set({ hashtags: [...s.hashtags, clean], dirty: true });
    return true;
  },

  removeHashtag: (tag) =>
    set((s) => ({
      hashtags: s.hashtags.filter(
        t => t !== tag.toLowerCase().replace(/^#/, '').replace(/[^a-z0-9_]/g, ''),
      ),
      dirty: true,
    })),

  setMentions: (mentions) =>
    set({ mentions: [...new Set(mentions.map(m => m.replace(/^@/, '')))].slice(0, MAX_MENTIONS), dirty: true }),

  addMention: (username) => {
    const clean = username.replace(/^@/, '').trim().toLowerCase();
    if (!clean) return false;
    const s = get();
    if (s.mentions.includes(clean)) return false;
    if (s.mentions.length >= MAX_MENTIONS) return false;
    set({ mentions: [...s.mentions, clean], dirty: true });
    return true;
  },

  removeMention: (username) =>
    set((s) => ({
      mentions: s.mentions.filter(m => m !== username.replace(/^@/, '').toLowerCase()),
      dirty: true,
    })),

  setAudience: (audience) => set({ audience, dirty: true }),
  setAudienceExclusions: (audienceExclusions) => set({ audienceExclusions, dirty: true }),
  setCommentsEnabled: (commentsEnabled) => set({ commentsEnabled, dirty: true }),
  setWatermark: (watermark) => set({ watermark, dirty: true }),
  setSaveToDevice: (saveToDevice) => set({ saveToDevice, dirty: true }),
  setShareToStory: (shareToStory) => {
    writeShareStorySetting(shareToStory);
    set({ shareToStory, dirty: true });
  },

  setRecordingDurationLimit: (recordingDurationLimit) => set({ recordingDurationLimit, dirty: true }),
  setKeepOriginalSound: (keepOriginalSound) => set({ keepOriginalSound, dirty: true }),
  setFacingMode: (facingMode) => set({ facingMode, dirty: true }),
  setTorchOn: (torchOn) => set({ torchOn }),

  setDraftId: (draftId) => set({ draftId }),
  setSubmitting: (submitting) => set({ submitting }),
  setSubmitProgress: (submitProgress) => set({ submitProgress }),
  setSubmitError: (submitError) => set({ submitError }),
  setPublishedMomentId: (publishedMomentId) => set({ publishedMomentId }),

  totalDurationSec: () => get().clips.reduce((sum, c) => sum + clipDuration(c), 0),

  hasUnsavedChanges: () => {
    const s = get();
    return (
      s.clips.length > 0 ||
      !!s.selectedMusic ||
      s.textOverlays.length > 0 ||
      s.stickerOverlays.length > 0 ||
      s.captions.enabled ||
      s.title.trim().length > 0 ||
      s.description.trim().length > 0
    );
  },

  resetSession: () => set({ ...emptyState(), dirty: false }),

  loadDraft: (payload, draftId) =>
    set({
      ...emptyState(),
      draftId,
      title: payload.title || '',
      description: payload.description || '',
      selectedMusic: payload.music || null,
      clips: (payload.clips || []).map(c => ({
        ...c,
        previewUrl: c.previewUrl || '',
        file: null,
      })) as ReelClip[],
      textOverlays: payload.textOverlays || [],
      stickerOverlays: payload.stickerOverlays || [],
      captions: payload.captions || initialCaptions,
      audience: payload.audience || 'public',
      audienceExclusions: payload.audienceExclusions || { hideFrom: [], showOnly: [] },
      commentsEnabled: payload.commentsEnabled ?? true,
      watermark: payload.watermark ?? true,
      saveToDevice: payload.saveToDevice ?? false,
      shareToStory: payload.shareToStory || readShareStorySetting(),
      hashtags: payload.hashtags || [],
      mentions: payload.mentions || [],
      stage: payload.stage || 'compose',
      dirty: false,
    }),
}));

/** Convenience selector for the music track typed as MusicTrack. */
export const asMusicTrack = (m: SelectedMusic | null): MusicTrack | null =>
  m
    ? {
        id: m.id,
        title: m.title,
        artist: m.artist,
        audioUrl: m.audioUrl,
        thumbnailUrl: m.thumbnailUrl,
        duration: m.durationSec ?? 30,
      }
    : null;

export const DURATION_OPTIONS = [10, 15, 30, 60] as const;

export const cycleDuration = (current: number): number => {
  const idx = DURATION_OPTIONS.indexOf(current as (typeof DURATION_OPTIONS)[number]);
  return DURATION_OPTIONS[(idx + 1) % DURATION_OPTIONS.length];
};
