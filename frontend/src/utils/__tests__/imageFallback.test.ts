import { describe, it, expect, vi } from 'vitest';
import {
    IMAGE_PLACEHOLDER,
    FALLBACK_ATTR,
    shouldSwapForFallback,
    applyImageFallback,
    installGlobalImageFallback
} from '../imageFallback';

const makeImg = (over: Record<string, unknown> = {}) => ({
    tagName: 'IMG',
    src: 'https://cdn.example.com/broken.jpg',
    getAttribute: (name: string) => (over as Record<string, string>)[name] ?? null,
    ...over
});

describe('imageFallback placeholder asset', () => {
    it('is an inline svg data URI (bundle-safe)', () => {
        expect(IMAGE_PLACEHOLDER.startsWith('data:image/svg+xml,')).toBe(true);
        const svg = decodeURIComponent(IMAGE_PLACEHOLDER.replace('data:image/svg+xml,', ''));
        expect(svg).toContain('<svg');
    });
});

describe('shouldSwapForFallback', () => {
    it('accepts plain <img> with a failing src', () => {
        expect(shouldSwapForFallback(makeImg())).toBe(true);
    });
    it('accepts lowercase tagName from real DOM', () => {
        expect(shouldSwapForFallback(makeImg({ tagName: 'img' }))).toBe(true);
    });
    it('rejects non-img resources (script/link/css)', () => {
        expect(shouldSwapForFallback(makeImg({ tagName: 'SCRIPT' }))).toBe(false);
        expect(shouldSwapForFallback(makeImg({ tagName: 'LINK' }))).toBe(false);
    });
    it('rejects empty/missing src', () => {
        expect(shouldSwapForFallback(makeImg({ src: '' }))).toBe(false);
        expect(shouldSwapForFallback({ tagName: 'IMG', getAttribute: () => null })).toBe(false);
    });
    it('rejects already-swapped placeholder (no infinite loop)', () => {
        expect(shouldSwapForFallback(makeImg({ src: IMAGE_PLACEHOLDER }))).toBe(false);
    });
    it('respects data-no-fallback opt-out', () => {
        expect(shouldSwapForFallback(makeImg({ [FALLBACK_ATTR]: 'true' }))).toBe(false);
    });
    it('rejects null/undefined', () => {
        expect(shouldSwapForFallback(null)).toBe(false);
        expect(shouldSwapForFallback(undefined)).toBe(false);
    });
});

describe('applyImageFallback', () => {
    it('swaps src to the placeholder and reports true', () => {
        const img = makeImg();
        expect(applyImageFallback(img)).toBe(true);
        expect(img.src).toBe(IMAGE_PLACEHOLDER);
    });
    it('is idempotent', () => {
        const img = makeImg();
        applyImageFallback(img);
        expect(applyImageFallback(img)).toBe(false);
        expect(img.src).toBe(IMAGE_PLACEHOLDER);
    });
});

describe('installGlobalImageFallback', () => {
    const makeWindow = () => {
        const listeners: Record<string, ((e: unknown) => void)[]> = {};
        return {
            addEventListener: vi.fn((type: string, cb: (e: unknown) => void, _cap: boolean) => {
                (listeners[type] ||= []).push(cb);
            }),
            removeEventListener: vi.fn(),
            _fire: (type: string, event: unknown) => (listeners[type] || []).forEach(cb => cb(event)),
            _listeners: listeners
        };
    };

    it('subscribes a capture-phase error listener on the window', () => {
        const w = makeWindow();
        installGlobalImageFallback(w as unknown as Window);
        expect(w.addEventListener).toHaveBeenCalledWith('error', expect.any(Function), true);
    });

    it('swaps failing IMG targets and leaves others alone', () => {
        const w = makeWindow();
        installGlobalImageFallback(w as unknown as Window);
        const img = makeImg();
        w._fire('error', { target: img });
        expect(img.src).toBe(IMAGE_PLACEHOLDER);
        const script = { tagName: 'SCRIPT', src: 'https://x/app.js' };
        w._fire('error', { target: script });
        expect(script.src).toBe('https://x/app.js');
    });

    it('unsubscribes on uninstall', () => {
        const w = makeWindow();
        const uninstall = installGlobalImageFallback(w as unknown as Window);
        uninstall();
        expect(w.removeEventListener).toHaveBeenCalledWith('error', expect.any(Function), true);
    });

    it('no-ops without a window (SSR/node)', () => {
        const uninstall = installGlobalImageFallback(undefined);
        expect(typeof uninstall).toBe('function');
        expect(() => uninstall()).not.toThrow();
    });
});
