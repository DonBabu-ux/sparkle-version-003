import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { useReelCreatorStore, cycleDuration, DURATION_OPTIONS, asMusicTrack } from '../reelCreatorStore';
import { cuesFromText, makeCaptionsState } from '../services/captionsService';
import type { ReelClip } from '../types';

const clip = (id: string, durationSec = 10, trimStart = 0, trimEnd: number | null = null): ReelClip => ({
  id,
  kind: 'video',
  previewUrl: `blob:${id}`,
  file: new File(['x'], `${id}.mp4`, { type: 'video/mp4' }),
  storageKey: null,
  durationSec,
  trimStart,
  trimEnd,
  name: `${id}.mp4`,
});

const state = () => useReelCreatorStore.getState();

beforeEach(() => {
  state().resetSession();
});

describe('reelCreatorStore — clips', () => {
  it('adds clips, dedupes by id, and caps the session at 10', () => {
    const many = Array.from({ length: 14 }, (_, i) => clip(`c${i}`));
    state().addClips([...many, ...many.slice(0, 3)]); // repeats in the same call
    expect(state().clips).toHaveLength(10);
    expect(new Set(state().clips.map(c => c.id)).size).toBe(10);
  });

  it('removes a clip and drops it from the selection', () => {
    state().setSelectMultiple(true);
    state().addClips([clip('a'), clip('b')]);
    state().toggleSelection('a');
    state().toggleSelection('b');
    expect(state().selectionOrder).toHaveLength(2);
    state().removeClip('a');
    expect(state().clips.map(c => c.id)).toEqual(['b']);
    expect(state().selectionOrder).toEqual(['b']);
  });

  it('reorders clips to the requested order', () => {
    state().addClips([clip('a'), clip('b'), clip('c')]);
    state().reorderClips(['c', 'a', 'b']);
    expect(state().clips.map(c => c.id)).toEqual(['c', 'a', 'b']);
  });

  it('respects trims in totalDurationSec', () => {
    state().addClips([clip('a', 10), clip('b', 8, 1, 5), clip('img', 3)]);
    expect(state().totalDurationSec()).toBeCloseTo(10 + 4 + 3, 5);
  });

  it('refuses selection past maxMedia', () => {
    state().setSelectMultiple(true);
    state().addClips(Array.from({ length: 12 }, (_, i) => clip(`c${i}`)));
    for (let i = 0; i < 15; i++) state().toggleSelection(`c${i}`);
    expect(state().selectionOrder).toHaveLength(state().maxMedia);
  });
});

describe('reelCreatorStore — hashtags & mentions', () => {
  it('normalizes hashtags and stops at 5', () => {
    ['Travel', 'campus', 'food', 'music', 'nightlife', 'extra'].forEach(t => {
      state().addHashtag(t);
    });
    expect(state().hashtags).toEqual(['travel', 'campus', 'food', 'music', 'nightlife']);
    expect(state().addHashtag('travel')).toBe(false); // duplicate
    state().removeHashtag('#CAMPUS');
    expect(state().hashtags).not.toContain('campus');
  });

  it('normalizes mentions and stops at 10', () => {
    for (let i = 0; i < 13; i++) state().addMention(`User_${i}`);
    expect(state().mentions).toHaveLength(10);
    expect(state().mentions[0]).toBe('user_0');
    expect(state().addMention('user_0')).toBe(false);
  });

  it('drops hashtag characters the server would reject', () => {
    state().addHashtag('#Fun-Time!! 2024');
    expect(state().hashtags[0]).toBe('funtime2024');
  });
});

describe('reelCreatorStore — stages & session lifecycle', () => {
  it('records the previous stage and can go back', () => {
    state().setStage('camera');
    expect(state().stage).toBe('camera');
    expect(state().previousStage).toBe('create');
    state().setStage('preview');
    state().goBack();
    expect(state().stage).toBe('camera');
  });

  it('goBack falls back to create at the root', () => {
    state().setStage('compose');
    expect(state().previousStage).toBe('create');
    state().goBack();
    expect(state().stage).toBe('create');
    state().goBack(); // no remembered stage → stays at create
    expect(state().stage).toBe('create');
  });

  it('hasUnsavedChanges reflects real content only', () => {
    expect(state().hasUnsavedChanges()).toBe(false);
    state().setTitle('My reel');
    expect(state().hasUnsavedChanges()).toBe(true);
    state().resetSession();
    expect(state().hasUnsavedChanges()).toBe(false);
    expect(state().clips).toHaveLength(0);
    expect(state().stage).toBe('create');
  });

  it('loadDraft restores composer state and clears the dirty flag', () => {
    state().setTitle('Draft title');
    state().setAudience('close_friends');
    state().addHashtag('draft');
    state().loadDraft(
      {
        title: 'Restored',
        description: 'From server',
        audience: 'only_me',
        hashtags: ['restored'],
        captions: makeCaptionsState({ enabled: true, text: 'hi', status: 'ready' }),
        stage: 'compose',
      },
      'draft-123',
    );
    const s = state();
    expect(s.draftId).toBe('draft-123');
    expect(s.title).toBe('Restored');
    expect(s.audience).toBe('only_me');
    expect(s.hashtags).toEqual(['restored']);
    expect(s.stage).toBe('compose');
    expect(s.dirty).toBe(false);
  });

  it('keeps publish flags consistent while editing', () => {
    state().setCommentsEnabled(false);
    state().setWatermark(false);
    state().setShareToStory('once');
    expect(state().commentsEnabled).toBe(false);
    expect(state().watermark).toBe(false);
    expect(state().shareToStory).toBe('once');
  });
});

describe('recording duration cycle', () => {
  it('cycles 10 → 15 → 30 → 60 → 10', () => {
    expect(DURATION_OPTIONS).toEqual([10, 15, 30, 60]);
    expect(cycleDuration(10)).toBe(15);
    expect(cycleDuration(15)).toBe(30);
    expect(cycleDuration(30)).toBe(60);
    expect(cycleDuration(60)).toBe(10);
    // Unknown value restarts the cycle from the first option
    expect(cycleDuration(7)).toBe(10);
  });
});

describe('music track helper', () => {
  it('maps SelectedMusic back to a MusicTrack shape', () => {
    state().setMusic({
      id: 't1',
      title: 'Song',
      artist: 'Artist',
      audioUrl: '/music/t1.mp3',
      thumbnailUrl: null,
      durationSec: 30,
    });
    const track = asMusicTrack(state().selectedMusic);
    expect(track).toMatchObject({ id: 't1', duration: 30 });
    expect(asMusicTrack(null)).toBeNull();
  });
});

describe('captionsService — pure helpers', () => {
  it('splits text into cues across the given duration', () => {
    const cues = cuesFromText('hello world from sparkle', 9);
    expect(cues.length).toBeGreaterThan(0);
    expect(cues[0].start).toBe(0);
    expect(cues[cues.length - 1].end).toBeLessThanOrEqual(9);
    expect(cues.map(c => c.text).join(' ')).toContain('sparkle');
  });

  it('makeCaptionsState normalizes a partial patch', () => {
    const s = makeCaptionsState({ enabled: true, text: 'hi', status: 'ready', source: 'manual' });
    expect(s).toMatchObject({ enabled: true, text: 'hi', status: 'ready', source: 'manual' });
    expect(Array.isArray(s.cues)).toBe(true);
  });
});

describe('share-to-story setting persistence', () => {
  const KEY = 'sparkle_reel_share_story';
  const memory = new Map<string, string>();
  const storageStub = {
    getItem: (k: string) => (memory.has(k) ? memory.get(k)! : null),
    setItem: (k: string, v: string) => { memory.set(k, String(v)); },
    removeItem: (k: string) => { memory.delete(k); },
    clear: () => { memory.clear(); },
    key: (i: number) => [...memory.keys()][i] ?? null,
    get length() { return memory.size; },
  } as unknown as Storage;
  const g = globalThis as { localStorage?: Storage };
  const original = g.localStorage;

  beforeAll(() => { g.localStorage = storageStub; });
  afterAll(() => {
    if (original) g.localStorage = original;
    else delete g.localStorage;
    state().resetSession();
  });
  beforeEach(() => {
    memory.clear();
    state().resetSession();
  });

  it('persists "always" and restores it across session resets', () => {
    state().setShareToStory('always');
    expect(memory.get(KEY)).toBe('always');
    state().resetSession();
    expect(state().shareToStory).toBe('always');
  });

  it('"once" applies for this session only and is never persisted', () => {
    state().setShareToStory('once');
    expect(memory.has(KEY)).toBe(false);
    state().resetSession();
    expect(state().shareToStory).toBe('off');
  });

  it('turning the setting off clears the stored preference', () => {
    state().setShareToStory('always');
    state().setShareToStory('off');
    expect(memory.has(KEY)).toBe(false);
    state().resetSession();
    expect(state().shareToStory).toBe('off');
  });

  it('restores "always" from storage when a draft omits the field', () => {
    state().setShareToStory('always');
    state().loadDraft({ title: 'old draft' }, 'draft-x');
    expect(state().shareToStory).toBe('always');
    state().loadDraft({ title: 'draft with choice', shareToStory: 'off' }, 'draft-y');
    expect(state().shareToStory).toBe('off');
  });
});
