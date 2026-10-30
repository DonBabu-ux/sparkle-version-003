import type { Dispatch, SetStateAction } from 'react';

/** A single media clip inside the reel session (source of truth = the File/Blob). */
export interface ReelClip {
  id: string;
  kind: 'video' | 'image';
  /** In-memory object URL for preview (recreated on draft resume). */
  previewUrl: string;
  /** The raw source blob. Null after draft resume until rehydrated from IndexedDB. */
  file: File | null;
  /** IndexedDB key (uploadFileDB / reelMediaDB) used to rehydrate after reload. */
  storageKey: string | null;
  durationSec: number;
  /** Trim window within the source (inclusive). Full clip when unset. */
  trimStart: number;
  trimEnd: number | null;
  width?: number;
  height?: number;
  name?: string;
}

export interface SelectedMusic {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  thumbnailUrl: string | null;
  durationSec?: number;
}

export interface TextOverlay {
  id: string;
  text: string;
  color: string;
  font: string;
  /** 0–1 normalized position on the canvas. */
  x: number;
  y: number;
  align: 'left' | 'center' | 'right';
  fontSize: number;
}

export interface StickerOverlay {
  id: string;
  /** Emoji character or sticker asset URL. */
  content: string;
  type: 'emoji' | 'gif';
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface CaptionCue {
  start: number;
  end: number;
  text: string;
}

export interface CaptionsState {
  enabled: boolean;
  cues: CaptionCue[];
  /** Full transcript text (reviewable/editable). */
  text: string;
  /** 'auto' = generated via STT; 'manual' = typed by the user. */
  source: 'auto' | 'manual' | null;
  status: 'idle' | 'generating' | 'ready' | 'error';
  error?: string;
}

export type AudienceKind = 'public' | 'friends' | 'close_friends' | 'only_me';

export interface AudienceExclusions {
  hideFrom: string[];
  showOnly: string[];
}

export type ShareStoryMode = 'off' | 'always' | 'once';

export type ReelStage =
  | 'create'      // main Create-reel page (music + gallery)
  | 'music'       // full-screen music discovery
  | 'camera'      // full-screen camera
  | 'preview'     // recorded/selected video preview + edit tools
  | 'text'        // transparent text overlay editor
  | 'clipEdit'    // full-screen trim / add-more editor
  | 'compose'     // New reel composer
  | 'audience'    // Who can see your post?
  | 'closeFriends'// Close Friends list editor
  | 'audienceList'// Do not show to / Only show to
  | 'shareStory'  // Share to story settings
  | 'mentions';   // Mention people picker

/** Serializable subset persisted to server drafts (no Blobs). */
export interface ReelDraftPayload {
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
}

/** Local-device draft record persisted in IndexedDB (sparkle-reel-drafts DB). */
export interface ReelDraftRecord {
  draft_id: string;
  title: string;
  thumbnail_url: string | null;
  media_refs: Array<{
    key: string;
    name: string;
    kind: string;
    storageBytes?: number;
    durationSec?: number;
    trimStart?: number;
    trimEnd?: number | null;
  }>;
  metadata: Partial<ReelDraftPayload>;
  storage_bytes: number;
  created_at: string;
  updated_at: string;
}

export interface ReelCreatorState {
  stage: ReelStage;
  previousStage: ReelStage | null;

  clips: ReelClip[];
  selectedMusic: SelectedMusic | null;
  textOverlays: TextOverlay[];
  stickerOverlays: StickerOverlay[];
  captions: CaptionsState;

  title: string;
  description: string;
  hashtags: string[];
  mentions: string[];

  audience: AudienceKind;
  audienceExclusions: AudienceExclusions;
  commentsEnabled: boolean;
  watermark: boolean;
  saveToDevice: boolean;
  shareToStory: ShareStoryMode;

  selectMultiple: boolean;
  selectionOrder: string[];
  maxMedia: number;

  draftId: string | null;
  dirty: boolean;
  submitting: boolean;
  submitProgress: number;
  submitError: string | null;
  publishedMomentId: string | null;

  // Camera sub-state
  recordingDurationLimit: number;
  keepOriginalSound: boolean;
  facingMode: 'user' | 'environment';
  torchOn: boolean;
}

export interface ReelCreatorActions {
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

  /** Compute total playable duration from clips (respecting trims). */
  totalDurationSec: () => number;
  hasUnsavedChanges: () => boolean;
  /** Reset the entire session (used after publish/discard). */
  resetSession: () => void;
  /** Restore from a draft payload (rehydrates blobs separately). */
  loadDraft: (payload: Partial<ReelDraftPayload>, draftId: string) => void;
}

export type ReelCreatorStore = ReelCreatorState & ReelCreatorActions;

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  thumbnailUrl: string | null;
  duration: number;
  albumTitle?: string;
}

export interface MediaSourceItem {
  id: string;
  name: string;
  /** 'camera-roll' | 'folder' | 'whatsapp' | 'screenshots' | ... */
  kind: string;
  itemCount?: number;
}

export interface GalleryItem {
  id: string;
  name: string;
  kind: 'video' | 'image';
  thumbnailUrl: string;
  durationSec?: number;
  file: File;
  width?: number;
  height?: number;
}

export type Setter<T> = Dispatch<SetStateAction<T>>;
