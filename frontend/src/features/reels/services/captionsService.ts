import api from '../../../api/api';
import { logger } from '../../../utils/logger';
import type { CaptionCue, CaptionsState } from '../types';

/**
 * Automatic captions — real speech-to-text via the Sparkle backend
 * (OpenRouter Whisper when configured, Groq fallback). Never fabricates
 * transcript text.
 */

export async function transcribeMedia(file: File | Blob, filename = 'reel.mp4'): Promise<{
  ok: boolean;
  cues: CaptionCue[];
  text: string;
  errorMessage?: string;
  code?: string;
}> {
  const fd = new FormData();
  fd.append('media', file, filename);
  try {
    const { data } = await api.post('/reels/captions/transcribe', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 150_000,
    });
    if (data?.success === false) {
      return { ok: false, cues: [], text: '', errorMessage: data.message || 'Transcription failed', code: data.error };
    }
    const cues: CaptionCue[] = Array.isArray(data?.segments)
      ? data.segments
          .map((s: { start?: number; end?: number; text?: string }) => ({
            start: Number(s.start) || 0,
            end: Number(s.end) || 0,
            text: String(s.text || '').trim(),
          }))
          .filter((c: CaptionCue) => c.text)
      : [];
    return { ok: true, cues, text: String(data?.text || '') };
  } catch (err) {
    const response = (err as { response?: { data?: { message?: string; error?: string; status?: number } } }).response;
    logger.warn('[Captions] transcription failed:', response?.data || err);
    return {
      ok: false,
      cues: [],
      text: '',
      code: response?.data?.error || 'CAPTIONS_FAILED',
      errorMessage:
        response?.data?.message ||
        'Transcription failed. You can retry or write captions manually.',
    };
  }
}

/**
 * Build captions from typed text (manual mode). Splits into rough cues
 * spread across the reel duration so playback can display them.
 */
export function cuesFromText(text: string, durationSec: number): CaptionCue[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const perCue = Math.max(3, Math.round(words.length / Math.max(1, Math.ceil(durationSec / 3))));
  const cues: CaptionCue[] = [];
  const total = Math.max(durationSec, 3);
  let idx = 0;
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + perCue).join(' ');
    const start = (idx / Math.ceil(words.length / perCue)) * total;
    const end = ((idx + 1) / Math.ceil(words.length / perCue)) * total;
    cues.push({ start, end, text: chunk });
    i += perCue;
    idx += 1;
  }
  return cues;
}

export function makeCaptionsState(patch: Partial<CaptionsState>): CaptionsState {
  return {
    enabled: false,
    cues: [],
    text: '',
    source: null,
    status: 'idle',
    ...patch,
  };
}
