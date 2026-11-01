/**
 * Story UI polish — the pure logic added for the story composer/viewer work:
 * the editor undo/redo stack, the "story just posted" flag helper, and the
 * caption/save-to-device metadata mapping. Plus static guards that the wired-up
 * surfaces (share, save-to-highlight, highlight editor, highlight player
 * duration) stay wired.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    buildStoryUploadFields,
    canRedoSnapshot,
    canUndoSnapshot,
    consumeStoryPostedFlag,
    createSnapshotHistory,
    pushSnapshot,
    redoSnapshot,
    SNAPSHOT_HISTORY_LIMIT,
    STORY_POSTED_FLAG_KEY,
    undoSnapshot,
} from '../utils/storyCache';

const SRC = fileURLToPath(new URL('..', import.meta.url)); // frontend/src

function read(rel: string): string {
    return readFileSync(join(SRC, rel), 'utf8');
}

/** Minimal sessionStorage stand-in so the flag helper runs in node. */
function fakeStorage(initial: Record<string, string | null> = {}) {
    const data = new Map<string, string>(Object.entries(initial).filter(([, v]) => v != null) as [string, string][]);
    return {
        getItem: (key: string) => (data.has(key) ? (data.get(key) as string) : null),
        setItem: (key: string, value: string) => { data.set(key, value); },
        removeItem: (key: string) => { data.delete(key); },
        has: (key: string) => data.has(key),
    };
}

describe('story editor undo/redo stack', () => {
    it('starts empty with no steps available', () => {
        const h = createSnapshotHistory<string[]>(['a']);
        expect(h.present).toEqual(['a']);
        expect(canUndoSnapshot(h)).toBe(false);
        expect(canRedoSnapshot(h)).toBe(false);
        expect(undoSnapshot(h)).toBe(h);
        expect(redoSnapshot(h)).toBe(h);
    });

    it('undo returns the previous snapshot and redo restores it', () => {
        let h = createSnapshotHistory<string[]>([]);
        h = pushSnapshot(h, ['one']);
        h = pushSnapshot(h, ['one', 'two']);
        expect(h.present).toEqual(['one', 'two']);

        const undone = undoSnapshot(h);
        expect(undone.present).toEqual(['one']);
        expect(canRedoSnapshot(undone)).toBe(true);

        const redone = redoSnapshot(undone);
        expect(redone.present).toEqual(['one', 'two']);
        expect(canRedoSnapshot(redone)).toBe(false);
    });

    it('pushing after an undo drops the redo branch', () => {
        let h = createSnapshotHistory<string[]>([]);
        h = pushSnapshot(h, ['one']);
        h = undoSnapshot(h);
        h = pushSnapshot(h, ['two']);
        expect(h.present).toEqual(['two']);
        expect(canRedoSnapshot(h)).toBe(false);
        expect(undoSnapshot(h).present).toEqual([]);
    });

    it('re-pushing the identical array does not create a step', () => {
        const snapshot = ['one'];
        let h = createSnapshotHistory<string[]>(snapshot);
        h = pushSnapshot(h, snapshot);
        expect(canUndoSnapshot(h)).toBe(false);
        expect(h.past).toEqual([]);
    });

    it('caps the stack at the history limit, newest steps kept', () => {
        let h = createSnapshotHistory<number>(0);
        for (let i = 1; i <= SNAPSHOT_HISTORY_LIMIT + 10; i++) {
            h = pushSnapshot(h, i);
        }
        expect(h.past).toHaveLength(SNAPSHOT_HISTORY_LIMIT);
        expect(h.present).toBe(SNAPSHOT_HISTORY_LIMIT + 10);
        // Oldest surviving step is the most recently discarded one, not the seed.
        expect(h.past[h.past.length - 1]).toBe(SNAPSHOT_HISTORY_LIMIT + 9);
    });
});

describe('sparkle_story_posted flag', () => {
    it('reports and clears the flag in one call', () => {
        const storage = fakeStorage({ [STORY_POSTED_FLAG_KEY]: '1' });
        expect(consumeStoryPostedFlag(storage)).toBe(true);
        expect(storage.has(STORY_POSTED_FLAG_KEY)).toBe(false);
        // A second mount must not refetch again on the same flag.
        expect(consumeStoryPostedFlag(storage)).toBe(false);
    });

    it('returns false when the flag was never set', () => {
        expect(consumeStoryPostedFlag(fakeStorage())).toBe(false);
    });

    it('returns false when storage is unavailable', () => {
        expect(consumeStoryPostedFlag(undefined)).toBe(false);
    });
});

describe('story upload field mapping', () => {
    it('maps caption, save-to-gallery, audience and duration onto backend names', () => {
        const fields = buildStoryUploadFields({
            caption: '  first story!  ',
            audience: 'followers',
            save_to_gallery: true,
            storyDuration: 10,
            stickers: '[]',
            storyLayers: '[]',
            parentStoryId: 'parent-1',
            musicInfo: '{"title":"x"}',
            textContent: 'hello',
            textConfig: '{}',
            storyTheme: 'neon',
        });
        expect(fields).toEqual({
            caption: '  first story!  ',
            audience: 'followers',
            save_to_gallery: 'true',
            story_duration: '10',
            stickers: '[]',
            story_layers: '[]',
            parent_story_id: 'parent-1',
            music_info: '{"title":"x"}',
            text_content: 'hello',
            text_config: '{}',
            story_theme: 'neon',
        });
    });

    it('omits absent and empty fields so defaults are never overwritten', () => {
        expect(buildStoryUploadFields({})).toEqual({});
        expect(buildStoryUploadFields({ caption: '', save_to_gallery: false })).toEqual({ save_to_gallery: 'false' });
    });

    it('keeps story_duration when it is explicitly zero', () => {
        expect(buildStoryUploadFields({ storyDuration: 0 })).toEqual({ story_duration: '0' });
    });
});

describe('story UI polish — wiring guards', () => {
    it('composer threads caption and save-to-gallery into the story metadata', () => {
        const body = read('pages/CreateStory.tsx');
        expect(body).toMatch(/caption:\s*[^,]*caption\.trim\(\)/);
        expect(body).toMatch(/save_to_gallery:\s*saveToGallery/);
        // The upload worker appends both fields (via buildStoryUploadFields).
        const worker = read('services/workers/StoryUploadWorker.ts');
        expect(worker).toMatch(/buildStoryUploadFields\(meta\)/);
        expect(worker).toMatch(/buildStoryUploadFields/);
    });

    it('StoryUploadWorker (and the metadata type) knows the new fields', () => {
        const worker = read('services/workers/StoryUploadWorker.ts');
        expect(worker).toMatch(/import \{ buildStoryUploadFields \} from '\.\.\/\.\.\/utils\/storyCache'/);
        const store = read('store/uploadStore.ts');
        expect(store).toMatch(/caption\?: string;/);
        expect(store).toMatch(/save_to_gallery\?: boolean;/);
    });

    it('StoryViewer wires the previously dead share controls', () => {
        const body = read('pages/StoryViewer.tsx');
        expect(body).toMatch(/navigator\.clipboard\.writeText/);
        expect(body).toMatch(/https:\/\/wa\.me\/\?text=/);
        expect(body).toMatch(/Share to WhatsApp Status/);
        // Decorative brand tiles are gone — the only footer actions are real.
        expect(body).not.toMatch(/name: 'Snapchat'/);
        expect(body).not.toMatch(/name: 'Messenger'/);
        expect(body).not.toMatch(/name: 'Instagram'/);
    });

    it('comments carousel pauses on explicitly disabled comments', () => {
        const body = read('pages/StoryViewer.tsx');
        expect(body).toMatch(/commentsExplicitlyOff/);
        expect(body).toMatch(/setActiveCommentIndex\(0\)/);
    });

    it('sticker layer renders above the nav tap zones', () => {
        const body = read('pages/StoryViewer.tsx');
        expect(body).toMatch(/z-30 pointer-events-none/);
        expect(body).toMatch(/<StickerRenderer/);
    });

    it('stickers picker offers a session Recent tab and no My Stickers stub', () => {
        const body = read('components/stories/StickerPicker.tsx');
        expect(body).toMatch(/recentStickers\?: RecentSticker\[\]/);
        expect(body).not.toMatch(/My Stickers/);
        expect(body).not.toMatch(/No stickers found/);
    });

    it('highlight player uses the real story duration', () => {
        const body = read('components/modals/HighlightPlayerModal.tsx');
        expect(body).toMatch(/story_duration\?: number;/);
        expect(body).toMatch(/imageDurationMs/);
        expect(body).toMatch(/FALLBACK_IMAGE_DURATION_MS/);
    });

    it('highlight editor hits the real highlight endpoints', () => {
        const body = read('components/modals/HighlightEditModal.tsx');
        expect(body).toMatch(/api\.put\(`\/highlights\/\$\{highlightId\}`/);
        expect(body).toMatch(/api\.post\(`\/highlights\/\$\{highlightId\}\/stories`/);
        expect(body).toMatch(/api\.delete\(`\/highlights\/\$\{highlightId\}\/stories\/\$\{storyId\}`/);
        expect(body).toMatch(/api\.get\('\/highlights\/archive'\)/);
        expect(body).toMatch(/showError\('Could not update this highlight'\)/);
    });

    it('profile highlights rail exposes the editor for the owner', () => {
        const body = read('pages/Profile.tsx');
        expect(body).toMatch(/HighlightEditModal/);
        expect(body).toMatch(/setEditingHighlight\(\{ id: h\.id, title: h\.title \}\)/);
    });

    it('dashboard consumes the posted flag through the shared helper', () => {
        const body = read('pages/Dashboard.tsx');
        expect(body).toMatch(/consumeStoryPostedFlag\(\)/);
        expect(body).not.toMatch(/sessionStorage\.getItem\('sparkle_story_posted'\)/);
    });
});
