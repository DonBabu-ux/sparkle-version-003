/**
 * reelRenderer pure-function tests (node environment — no DOM).
 * probeBlobHasAudio must degrade to `undefined` (unknown) instead of
 * throwing or lying when there is no document/video support.
 */
import { describe, it, expect } from 'vitest';
import { clipEffectiveDuration, probeBlobHasAudio } from '../services/reelRenderer';
import type { ReelClip } from '../types';

const clip = (over: Partial<ReelClip>): ReelClip =>
  ({
    id: 'c1',
    kind: 'video',
    previewUrl: '',
    file: null,
    storageKey: null,
    trimStart: 0,
    trimEnd: null,
    durationSec: 10,
    ...over,
  }) as ReelClip;

describe('reelRenderer — clipEffectiveDuration', () => {
  it('uses trim bounds when present', () => {
    expect(clipEffectiveDuration(clip({ trimStart: 2, trimEnd: 5 }))).toBe(3);
  });

  it('falls back to full duration when untrimmed', () => {
    expect(clipEffectiveDuration(clip({ trimStart: 0, trimEnd: null }))).toBe(10);
  });

  it('enforces minimum durations (images 3s, video 0.2s)', () => {
    expect(clipEffectiveDuration(clip({ kind: 'image', durationSec: 0, trimStart: 0, trimEnd: 0 }))).toBe(3);
    expect(clipEffectiveDuration(clip({ kind: 'video', durationSec: 0, trimStart: 0, trimEnd: 0 }))).toBe(0.2);
  });
});

describe('reelRenderer — probeBlobHasAudio (node env)', () => {
  it('returns undefined (unknown) when no DOM is available', async () => {
    const blob = new Blob([new Uint8Array([0, 1, 2])], { type: 'video/mp4' });
    await expect(probeBlobHasAudio(blob)).resolves.toBeUndefined();
  });
});
