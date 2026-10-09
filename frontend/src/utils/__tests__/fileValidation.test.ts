/**
 * C2.3 — client-side file validation (size + MIME) before upload.
 * Server enforces 10/15/100 MB multer limits; the client must fail fast
 * with a readable message instead of a confusing server/network error.
 */
import { describe, it, expect } from 'vitest';
import { validateFile } from '../fileValidation';

function makeFile(name: string, type: string, bytes: number): File {
    return new File([new Uint8Array(bytes)], name, { type });
}

describe('validateFile', () => {
    it('accepts an image within the size limit', () => {
        const r = validateFile(makeFile('a.png', 'image/png', 1024), { kind: 'image', maxSizeMB: 15 });
        expect(r.ok).toBe(true);
        expect(r.error).toBeUndefined();
    });

    it('rejects an oversized image with a readable message', () => {
        const r = validateFile(makeFile('big.png', 'image/png', 16 * 1024 * 1024), { kind: 'image', maxSizeMB: 15 });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/too large/i);
        expect(r.error).toMatch(/15\s*MB/);
    });

    it('rejects a non-image file when an image is required', () => {
        const r = validateFile(makeFile('doc.pdf', 'application/pdf', 10), { kind: 'image' });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/image/i);
    });

    it('accepts a video within the video limit', () => {
        const r = validateFile(makeFile('v.mp4', 'video/mp4', 50 * 1024 * 1024), { kind: 'video', maxSizeMB: 100 });
        expect(r.ok).toBe(true);
    });

    it('rejects an oversized video against the 100MB cap', () => {
        const r = validateFile(makeFile('v.mp4', 'video/mp4', 101 * 1024 * 1024), { kind: 'video', maxSizeMB: 100 });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/too large/i);
    });

    it('kind "any" accepts documents but still enforces size (10MB default)', () => {
        expect(validateFile(makeFile('d.pdf', 'application/pdf', 1024)).ok).toBe(true);
        const over = validateFile(makeFile('d.pdf', 'application/pdf', 11 * 1024 * 1024));
        expect(over.ok).toBe(false);
        expect(over.error).toMatch(/10\s*MB/);
    });

    it('never returns ok:false without a user-facing message', () => {
        const r = validateFile(makeFile('x.svg', 'image/svg+xml', 10), { kind: 'image' });
        expect(r.ok).toBe(false);
        expect(typeof r.error).toBe('string');
        expect(r.error!.length).toBeGreaterThan(8);
    });
});
