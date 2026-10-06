import { describe, it, expect, vi, beforeEach } from 'vitest';

// Minimal Audio stub for node environment (constructor uses `new Audio()`)
class FakeAudio {
    crossOrigin: string | null = null;
    loop = false;
    src = '';
    preload = '';
    volume = 1;
    currentTime = 0;
    muted = false;
    addEventListener() {}
    removeEventListener() {}
    play() { return Promise.resolve(); }
    pause() {}
    load() {}
}
vi.stubGlobal('Audio', FakeAudio);
vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {} });
vi.stubGlobal('AudioContext', undefined);

const { StoryAudioManager } = await import('../managers/StoryAudioManager');
const { audioEventBus } = await import('../EventBus');

describe('StoryAudioManager.getInstance (bare call contract)', () => {
    beforeEach(() => {
        (StoryAudioManager as unknown as { instance: unknown }).instance = null;
    });

    it('getInstance() with NO args succeeds (defaults to shared audioEventBus)', () => {
        expect(() => StoryAudioManager.getInstance()).not.toThrow();
        const m = StoryAudioManager.getInstance();
        expect(m).toBeTruthy();
    });

    it('is a proper singleton', () => {
        const a = StoryAudioManager.getInstance();
        const b = StoryAudioManager.getInstance();
        expect(a).toBe(b);
    });

    it('still accepts an explicit eventBus on first init', () => {
        const custom = new (audioEventBus.constructor as new () => typeof audioEventBus)();
        expect(() => StoryAudioManager.getInstance(undefined, custom)).not.toThrow();
        expect(StoryAudioManager.getInstance()).toBe(StoryAudioManager.getInstance());
    });
});
