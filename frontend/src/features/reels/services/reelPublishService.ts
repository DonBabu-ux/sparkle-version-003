import api from '../../../api/api';
import { AuthService } from '../../../services/AuthService';
import { logger } from '../../../utils/logger';
import { useReelCreatorStore } from '../reelCreatorStore';
import type { AudienceKind } from '../types';
import { renderReel, setOverlayState, canComposite } from './reelRenderer';
import { saveReelToDevice } from './shareService';

/**
 * Reel publication pipeline with real upload progress, idempotency,
 * retry-safe error classification, and separate story sharing.
 */

export interface PublishProgress {
  phase: 'rendering' | 'uploading' | 'publishing' | 'story' | 'done';
  /** 0–100 within the current phase, mapped to the overall bar by caller. */
  percent: number;
  overall: number;
}

export type PublishErrorCode =
  | 'VALIDATION'
  | 'NETWORK'
  | 'AUTH'
  | 'SERVER'
  | 'UNSUPPORTED'
  | 'CANCELLED';

export class PublishError extends Error {
  constructor(
    public code: PublishErrorCode,
    message: string,
    public retryable: boolean,
  ) {
    super(message);
    this.name = 'PublishError';
  }
}

const MAX_TOTAL_SEC = 60;
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function extractHashtags(text: string): string[] {
  return (text.match(/#[a-zA-Z0-9_]+/g) || []).map(t => t.slice(1).toLowerCase());
}

function extractMentions(text: string): string[] {
  return (text.match(/@([a-zA-Z0-9_.]+)/g) || []).map(t => t.slice(1).toLowerCase());
}

/** Server-side enforced audience names. */
export const AUDIENCE_LABELS: Record<AudienceKind, string> = {
  public: 'Public',
  friends: 'Friends',
  close_friends: 'Close Friends',
  only_me: 'Only me',
};

function validateState(state: ReturnType<typeof useReelCreatorStore.getState>): void {
  if (!state.clips.length) {
    throw new PublishError('VALIDATION', 'Add at least one photo or video first.', false);
  }
  const total = state.totalDurationSec();
  if (total > MAX_TOTAL_SEC + 0.5) {
    throw new PublishError(
      'VALIDATION',
      `Reel is ${total.toFixed(1)}s — maximum is ${MAX_TOTAL_SEC}s. Trim a clip and try again.`,
      false,
    );
  }
  if (state.title.trim().length > 250) {
    throw new PublishError('VALIDATION', 'Title is too long (max 250 characters).', false);
  }
  if (state.description.length > 5000) {
    throw new PublishError('VALIDATION', 'Description is too long (max 5000 characters).', false);
  }
  if (state.hashtags.length > 5) {
    throw new PublishError('VALIDATION', 'You can use up to 5 hashtags per reel.', false);
  }
  const missing = state.clips.find(c => !c.file && !c.storageKey);
  if (missing) {
    throw new PublishError('VALIDATION', 'One clip is missing its source file. Remove it or re-select it.', false);
  }
}

/**
 * Prepare the uploadable media:
 * - >1 clip or overlays/trims/captions present → composite into one video.
 * - single untouched clip → upload the original (preserves quality).
 */
async function prepareMedia(
  state: ReturnType<typeof useReelCreatorStore.getState>,
  onProgress: (p: PublishProgress) => void,
): Promise<{ file: File; wasComposited: boolean }> {
  const needsComposite =
    state.clips.length > 1 ||
    !!state.selectedMusic ||
    state.textOverlays.length > 0 ||
    state.stickerOverlays.length > 0 ||
    (state.captions.enabled && state.captions.cues.length > 0) ||
    state.clips.some(c => (c.trimStart || 0) > 0 || (c.trimEnd != null && c.trimEnd < c.durationSec));

  if (!needsComposite) {
    const clip = state.clips[0];
    if (clip.file) {
      if (clip.file.size > MAX_UPLOAD_BYTES) {
        throw new PublishError('VALIDATION', 'Video is larger than 100MB. Choose a shorter clip.', false);
      }
      onProgress({ phase: 'rendering', percent: 100, overall: 20 });
      return { file: clip.file, wasComposited: false };
    }
    throw new PublishError('VALIDATION', 'Source media is unavailable. Re-select this clip.', false);
  }

  if (!canComposite()) {
    throw new PublishError(
      'UNSUPPORTED',
      'This browser cannot combine clips or burn in edits. Remove extra clips/edits or use a newer device.',
      false,
    );
  }

  setOverlayState({
    textOverlays: state.textOverlays,
    stickerOverlays: state.stickerOverlays,
    cues: state.captions.enabled ? state.captions.cues : [],
  });

  let result;
  try {
    result = await renderReel(state.clips, {
      keepOriginalSound: state.keepOriginalSound || !state.selectedMusic,
      musicUrl: state.selectedMusic?.audioUrl || null,
      musicVolume: 0.9,
      width: 720,
      height: 1280,
      fps: 30,
      onProgress: (f) =>
        onProgress({ phase: 'rendering', percent: Math.round(f * 100), overall: Math.round(f * 30) }),
    });
  } catch (err) {
    const code = (err as Error).message || 'RENDER_FAILED';
    if (code === 'CANCELLED') throw new PublishError('CANCELLED', 'Publishing cancelled.', true);
    logger.warn('[ReelPublish] render failed:', code);
    throw new PublishError(
      code === 'COMPOSITE_UNSUPPORTED' || code === 'MEDIA_RECORDER_UNSUPPORTED' ? 'UNSUPPORTED' : 'SERVER',
      'Could not process the edits into a video on this device.',
      code !== 'COMPOSITE_UNSUPPORTED' && code !== 'MEDIA_RECORDER_UNSUPPORTED',
    );
  }

  const ext = result.mimeType.includes('mp4') ? 'mp4' : 'webm';
  const file = new File([result.blob], `sparkle-reel-${Date.now()}.${ext}`, {
    type: result.mimeType || `video/${ext}`,
  });
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new PublishError('VALIDATION', 'Processed video exceeds 100MB. Shorten the reel.', false);
  }
  return { file, wasComposited: true };
}

function uploadWithProgress(
  file: File,
  fields: Record<string, string>,
  onProgress: (p: PublishProgress) => void,
): Promise<{ data: unknown }> {
  return new Promise((resolve, reject) => {
    let hasRetriedAuth = false;

    const send = async () => {
      let token = '';
      try {
        token = await AuthService.getFreshToken();
      } catch (authErr) {
        reject(
          new PublishError(
            'AUTH',
            (authErr as Error).message || 'Session expired. Sign in again to publish.',
            false,
          ),
        );
        return;
      }

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${api.defaults.baseURL || '/api'}/moments`);
      xhr.responseType = 'json';
      xhr.timeout = 300_000;
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (ev) => {
        if (!ev.lengthComputable) return;
        const pct = Math.round((ev.loaded / ev.total) * 100);
        onProgress({ phase: 'uploading', percent: pct, overall: 30 + Math.round(pct * 0.55) });
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress({ phase: 'publishing', percent: 100, overall: 90 });
          resolve({ data: xhr.response });
          return;
        }
        if (xhr.status === 401 && !hasRetriedAuth) {
          hasRetriedAuth = true;
          void AuthService.refreshAccessToken()
            .then(() => send())
            .catch(() =>
              reject(new PublishError('AUTH', 'Session expired. Sign in again to publish.', false)),
            );
          return;
        }
        if (xhr.status === 401 || xhr.status === 403) {
          const body = xhr.response || {};
          if (body.deduplicated) {
            resolve({ data: body });
            return;
          }
          reject(new PublishError('AUTH', 'Your session expired. Sign in again to publish.', false));
        } else if (xhr.status === 429) {
          reject(new PublishError('NETWORK', 'Too many publishes. Wait a moment and retry.', true));
        } else if (xhr.status === 413) {
          reject(new PublishError('VALIDATION', 'The server rejected this file as too large.', false));
        } else if (xhr.status >= 500) {
          reject(new PublishError('SERVER', 'Server error while publishing. Retry shortly.', true));
        } else {
          const msg = (xhr.response && (xhr.response.error || xhr.response.message)) || `Upload failed (${xhr.status})`;
          reject(new PublishError('VALIDATION', String(msg), false));
        }
      };

      xhr.onerror = () =>
        reject(new PublishError('NETWORK', 'Network error during upload. Check your connection.', true));
      xhr.ontimeout = () =>
        reject(new PublishError('NETWORK', 'Upload timed out. Retry when you have a better connection.', true));
      xhr.onabort = () => reject(new PublishError('CANCELLED', 'Upload cancelled.', true));

      const fd = new FormData();
      fd.append('media', file, file.name);
      Object.entries(fields).forEach(([k, v]) => {
        if (v != null) fd.append(k, v);
      });
      xhr.send(fd);
    };

    void send();
  });
}

export interface PublishOutcome {
  momentId: string;
  wasComposited: boolean;
  storyShared: boolean;
  storyError?: string;
}

/**
 * Full publish flow. Idempotency key is stable per draft session so a
 * retry after a timeout cannot create a duplicate reel.
 */
export async function publishReel(
  onProgress: (p: PublishProgress) => void,
  idempotencyKey?: string,
): Promise<PublishOutcome> {
  const state = useReelCreatorStore.getState();
  validateState(state);

  const key = idempotencyKey || (state.draftId ? `d-${state.draftId}` : uuid());

  onProgress({ phase: 'rendering', percent: 0, overall: 0 });
  const { file, wasComposited } = await prepareMedia(state, onProgress);

  const captionParts: string[] = [];
  if (state.title.trim()) captionParts.push(state.title.trim());
  if (state.description.trim()) captionParts.push(state.description.trim());
  const baseCaption = captionParts.join('\n\n');

  // Hashtags/mentions: explicit picks merged with tags typed inside the
  // title/description so nothing the author wrote is silently dropped.
  const hashtags = [...new Set([...state.hashtags, ...extractHashtags(`${state.title} ${state.description}`)])].slice(0, 5);
  const mentions = [...new Set([...state.mentions, ...extractMentions(`${state.title} ${state.description}`)])].slice(0, 10);

  // Explicit hashtag picks also surface in the visible caption (tags typed
  // into the text are already there); metadata stays for discovery indexing.
  const tagLine = state.hashtags
    .filter(t => !baseCaption.toLowerCase().includes(`#${t}`))
    .map(t => `#${t}`)
    .join(' ');
  const caption = [baseCaption, tagLine].filter(Boolean).join('\n\n');

  const fields: Record<string, string> = {
    caption: caption.slice(0, 5000),
    title: state.title.trim().slice(0, 250),
    description: state.description.trim().slice(0, 5000),
    type: 'video',
    category: 'general',
    audience: state.audience,
    comments_enabled: state.commentsEnabled ? '1' : '0',
    watermark: state.watermark ? '1' : '0',
    duration_seconds: String(state.totalDurationSec().toFixed(2)),
    idempotency_key: key,
    hashtags: JSON.stringify(hashtags),
    ...(state.shareToStory !== 'off' ? { shared_to_story: '1' } : {}),
    overlays: JSON.stringify({
      text: state.textOverlays,
      stickers: state.stickerOverlays,
      hide_from: state.audienceExclusions.hideFrom,
      show_only: state.audienceExclusions.showOnly,
    }),
    clips_info: JSON.stringify(
      state.clips.map((c, i) => ({
        order: i,
        kind: c.kind,
        duration: c.durationSec,
        trim_start: c.trimStart,
        trim_end: c.trimEnd,
        name: c.name || null,
      })),
    ),
    music_info: state.selectedMusic
      ? JSON.stringify({
          id: state.selectedMusic.id,
          title: state.selectedMusic.title,
          artist: state.selectedMusic.artist,
          thumbnail: state.selectedMusic.thumbnailUrl,
        })
      : '',
    captions_info: state.captions.enabled
      ? JSON.stringify({ cues: state.captions.cues, source: state.captions.source, text: state.captions.text })
      : '',
  };

  // include explicit mentions alongside caption @handles
  if (mentions.length) {
    const mentionLine = mentions.map(m => `@${m}`).join(' ');
    fields.caption = fields.caption.includes(mentionLine)
      ? fields.caption
      : `${fields.caption}\n${mentionLine}`.trim();
  }

  let data: {
    moment?: { moment_id?: string; shared_to_story?: unknown };
    deduplicated?: boolean;
    story_created?: boolean;
  };
  try {
    const res = await uploadWithProgress(file, fields, onProgress);
    data = res.data as typeof data;
  } catch (err) {
    if (err instanceof PublishError) throw err;
    throw new PublishError('NETWORK', 'Upload failed. Retry when connected.', true);
  }

  const momentId = data?.moment?.moment_id || '';
  if (!momentId) {
    throw new PublishError('SERVER', 'The server did not confirm the reel. Retry — it will not duplicate.', true);
  }

  onProgress({ phase: 'done', percent: 100, overall: 100 });

  // Story sharing — reported separately; a failure never rolls back the reel.
  // The server can create the story from the already-uploaded media (no
  // second upload). Only if it didn't (e.g. legacy schema) fall back to the
  // client-side POST /stories re-upload.
  let storyShared = false;
  let storyError: string | undefined;
  if (state.shareToStory !== 'off') {
    onProgress({ phase: 'story', percent: 30, overall: 96 });
    const sharedFlag = data?.moment?.shared_to_story;
    const serverShared = data?.story_created === true || sharedFlag === 1 || sharedFlag === true || sharedFlag === '1';
    if (serverShared) {
      storyShared = true;
    } else {
      try {
        const fd = new FormData();
        fd.append('media', file, file.name);
        fd.append('text_content', state.title.trim() || state.description.trim() || '');
        await api.post('/stories', fd, { timeout: 180_000, headers: { 'Content-Type': 'multipart/form-data' } });
        storyShared = true;
      } catch (err) {
        storyError = 'The reel is published, but sharing to your story failed.';
        logger.warn('[ReelPublish] story share failed:', err);
      }
    }
  }

  // Optional "save to device" — publish already succeeded; a failure surfaces
  // as a toast but never blocks or rolls back the reel.
  let savedToDevice = false;
  let saveError: string | undefined;
  if (state.saveToDevice) {
    const EXT_BY_TYPE: Record<string, string> = {
      'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    };
    const ext = EXT_BY_TYPE[file.type] || (file.type.split('/')[1] || 'mp4');
    const saveOutcome = await saveReelToDevice(file, `sparkle-${momentId}.${ext}`);
    if (saveOutcome.status === 'shared') savedToDevice = true;
    else saveError = saveOutcome.message || 'Could not save the video to your device.';
  }

  return { momentId, wasComposited, storyShared, storyError, savedToDevice, saveError };
}
